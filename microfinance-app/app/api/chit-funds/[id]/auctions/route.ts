import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../../config/config';

// POST /api/chit-funds/[id]/auctions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
    try {
        const currentUserId = await getCurrentUserId(request);
        if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const chitFundId = parseInt(params.id);
        const body = await request.json();
        const {
            month,
            date,
            winnerId,
            amount, // Auction amount
            lowestBid,
            highestBid,
            numberOfBidders,
            notes,
            partnerId // Partner paying out the auction money
        } = body;

        // Validation
        if (!winnerId || !amount || !partnerId) {
             return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const cf = await prisma.chitFund.findUnique({where:{id: chitFundId}});
        if(!cf || cf.createdById !== currentUserId) return NextResponse.json({error:'Not found'}, {status:404});

        const winner = await prisma.member.findUnique({
            where: { id: parseInt(winnerId) },
            include: { globalMember: true }
        });
        if(!winner) return NextResponse.json({error: 'Winner not found'}, {status:404});

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Transaction (DEBIT) - Money leaving the company/partner
            const trans = await tx.transaction.create({
                data: {
                    type: TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT, // e.g. AUCTION_PAYOUT
                    amount: parseFloat(amount),
                    transactionClass: 'DEBIT',
                    partnerId: parseInt(partnerId),
                    date: new Date(date),
                    note: `Auction Payout: ${cf.name} - Month ${month} - ${winner.globalMember.name}`,
                    createdById: currentUserId
                }
            });

            // 2. Update Partner Balance (Decrement)
            await tx.partnerBalance.upsert({
                where: {
                    partnerId_createdById: {
                        partnerId: parseInt(partnerId),
                        createdById: currentUserId
                    }
                },
                create: {
                   partnerId: parseInt(partnerId),
                   balance: -parseFloat(amount),
                   createdById: currentUserId,
                   lastTransactionId: trans.id
                },
                update: {
                    balance: { decrement: parseFloat(amount) },
                    lastTransactionId: trans.id,
                    lastUpdated: new Date()
                }
            });

            // 3. Create Auction Record
            const auction = await tx.auction.create({
                data: {
                    chitFundId,
                    month: parseInt(month),
                    date: new Date(date),
                    winnerId: parseInt(winnerId),
                    amount: parseFloat(amount), // Payout Amount
                    lowestBid: lowestBid ? parseFloat(lowestBid) : null,
                    highestBid: highestBid ? parseFloat(highestBid) : null,
                    numberOfBidders: numberOfBidders ? parseInt(numberOfBidders) : null,
                    notes,
                    transactionId: trans.id
                }
            });

            return auction;
        });

        return NextResponse.json(result, { status: 201 });

    } catch (error) {
        console.error("Auction Error:", error);
        return NextResponse.json({ error: 'Failed to create auction' }, { status: 500 });
    }
}

// GET auctions
export async function GET(request: NextRequest, { params }: {params: {id: string}}) {
     try {
        const currentUserId = await getCurrentUserId(request);
        if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const chitFundId = parseInt(params.id);
        const auctions = await prisma.auction.findMany({
            where: { chitFundId },
            include: {
                winner: { include: { globalMember: true } },
                transaction: true
            },
            orderBy: { month: 'asc' }
        });
        
        return NextResponse.json(auctions);

     } catch(e) {
         console.error(e);
         return NextResponse.json({error: 'Failed to fetch auctions'}, {status: 500});
     }
}
