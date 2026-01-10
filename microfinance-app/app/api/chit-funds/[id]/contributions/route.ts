import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../../config/config';

// GET contributions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const chitFundId = parseInt(params.id);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const skip = (page - 1) * pageSize;

    const [contributions, totalCount] = await Promise.all([
      prisma.contribution.findMany({
        where: { chitFundId },
        include: {
            member: { include: { globalMember: true } },
            transaction: true
        },
        orderBy: { paidDate: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.contribution.count({ where: { chitFundId } })
    ]);

    return NextResponse.json({
        contributions,
        totalCount,
        page, 
        pageSize,
        totalPages: Math.ceil(totalCount/pageSize)
    });
  } catch(error) {
      console.error(error);
      return NextResponse.json({ error: 'Failed to list contributions' }, { status: 500 });
  }
}

// POST contribution
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const chitFundId = parseInt(params.id);
    const body = await request.json();
    const { 
        memberId, 
        width_month, // month index 1..N
        amount, 
        paidDate,
        partnerId  // Who collected it / credited to
    } = body;

    if (!memberId || !amount || !partnerId) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Verify ownership
    const cf = await prisma.chitFund.findUnique({where:{id: chitFundId}});
    if (!cf || cf.createdById !== currentUserId) return NextResponse.json({error:'Not found'}, {status:404});

    const member = await prisma.member.findUnique({
        where: { id: parseInt(memberId) },
        include: { globalMember: true }
    });
    if(!member) return NextResponse.json({error:'Member not found'}, {status:404});

    const contribution = await prisma.$transaction(async (tx) => {
        // 1. Create Transaction (CREDIT to Partner, usually)
        // Contribution comes IN, so it increases Partner Balance (Cash/Bank)
        const trans = await tx.transaction.create({
            data: {
                type: TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION,
                amount: parseFloat(amount),
                transactionClass: 'CREDIT',
                partnerId: parseInt(partnerId),
                date: new Date(paidDate || new Date()),
                note: `Chit Contribution: ${cf.name} - Month ${width_month} - ${member.globalMember.name}`,
                createdById: currentUserId
            }
        });

        // 2. Update Partner Balance
        await tx.partnerBalance.upsert({
            where: {
                partnerId_createdById: {
                    partnerId: parseInt(partnerId),
                    createdById: currentUserId
                }
            },
            create: {
                partnerId: parseInt(partnerId),
                balance: parseFloat(amount),
                createdById: currentUserId,
                lastTransactionId: trans.id
            },
            update: {
                balance: { increment: parseFloat(amount) },
                lastTransactionId: trans.id,
                lastUpdated: new Date()
            }
        });

        // 3. Create Contribution Record
        const newContrib = await tx.contribution.create({
            data: {
                amount: parseFloat(amount),
                month: parseInt(width_month || '0'), 
                paidDate: new Date(paidDate),
                memberId: parseInt(memberId),
                chitFundId,
                transactionId: trans.id,
                createdById: currentUserId
            }
        });
        
        return newContrib;
    });

    return NextResponse.json(contribution, { status: 201 });

  } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Failed to create contribution' }, { status: 500 });
  }
}
