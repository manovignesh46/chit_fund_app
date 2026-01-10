import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

// GET /api/partners
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {
      createdById: currentUserId,
    };
    if (activeOnly) {
        where.isActive = true;
    }

    const partners = await prisma.partner.findMany({
      where,
      include: {
        partnerBalances: {
            where: { createdById: currentUserId }
        }
      },
      orderBy: { name: 'asc' },
    });
    
    // Transform to include flat balance for easier FE consumption
    const partnersWithBalance = partners.map(p => ({
        ...p,
        currentBalance: p.partnerBalances[0]?.balance || 0
    }));

    return NextResponse.json(partnersWithBalance);
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}

// POST /api/partners
export async function POST(request: NextRequest) {
    try {
        const currentUserId = await getCurrentUserId(request);
        if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { name, code } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const partner = await prisma.$transaction(async (tx) => {
            const newPartner = await tx.partner.create({
                data: {
                    name,
                    code,
                    isActive: true,
                    createdById: currentUserId
                }
            });

            // Initialize balance
            await tx.partnerBalance.create({
                data: {
                    partnerId: newPartner.id,
                    balance: 0,
                    createdById: currentUserId
                }
            });

            return newPartner;
        });

        return NextResponse.json(partner, { status: 201 });
    } catch(error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
    }
}