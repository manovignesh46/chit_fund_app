import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';
import { getTransactionClass, getTransactionPartnerId } from '../../../lib/transactionHelpers';
import { buildTransactionWhereClause } from '../../../lib/transactionWhereBuilder';

// GET /api/transactions
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    
    // Extract filter params
    const partner = searchParams.get('partner');
    const type = searchParams.get('type');
    const member = searchParams.get('member');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const advType = searchParams.get('advType');
    const advMember = searchParams.get('advMember');
    const advEntity = searchParams.get('advEntity');
    const advSubType = searchParams.get('advSubType');

    const skip = (page - 1) * pageSize;

    // Use shared builder for consistent filtering
    const where = await buildTransactionWhereClause(currentUserId, {
        partner: partner || undefined,
        type: type || undefined,
        member: member || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        advType: advType || undefined,
        advMember: advMember || undefined,
        advEntity: advEntity || undefined,
        advSubType: advSubType || undefined
    });

    // 1. Fetch Transactions
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          partner: true,
          // Include linked entities to derive Member Name
          repayment: {
            include: {
                loan: {
                    include: {
                        borrower: true // GlobalMember
                    }
                }
            }
          },
          contribution: {
            include: {
                member: {
                    include: {
                        globalMember: true // GlobalMember
                    }
                }
            }
          },
          auction: {
            include: {
                winner: {
                    include: {
                        globalMember: true // GlobalMember
                    }
                }
            }
          },
          loan: {
             include: {
                 borrower: true // GlobalMember
             }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    // 2. Calculate Running Balances
    // Strategy: Get current balance for ALL partners, then reverse-calculate history.
    
    // a. Get Current Balances for relevant partners
    // We need balances for ALL partners because even if we filter by one, the logic holds.
    // Optimization: If filtering by one, we only strictly need one. But for "All", we need all.
    const partnerBalancesRaw = await prisma.partnerBalance.findMany({
        where: { createdById: currentUserId }
    });
    // Create Map: PartnerId -> CurrentBalance
    const partnerBalanceMap = new Map<number, number>();
    let currentTotalBalance = 0;
    
    partnerBalancesRaw.forEach(pb => {
        partnerBalanceMap.set(pb.partnerId, pb.balance);
        currentTotalBalance += pb.balance;
    });

    // b. Calculate 'Newer' Adjustment (Sum of transactions we skipped)
    // We need to fetch the skipped transactions to know their amounts and signs and WHICH PARTNER they affected.
    const adjustmentsMap = new Map<number, number>(); // PartnerId -> AdjustmentAmount
    let totalAdjustment = 0;

    if (skip > 0) {
        const newerTransactions = await prisma.transaction.findMany({
            where, // Same filter (so if filtered by partner, we only get that partner's newer txs)
            select: { amount: true, transactionClass: true, partnerId: true },
            orderBy: { date: 'desc' },
            take: skip
        });
        
        newerTransactions.forEach(t => {
            const sign = t.transactionClass === 'CREDIT' ? 1 : -1;
            const val = t.amount * sign;
            
            // Update Global Total Adjustment
            if (t.transactionClass !== 'TRANSFER') {
                totalAdjustment += val;
                
                // Update Partner Specific Adjustment
                if (t.partnerId) {
                    const currentAdj = adjustmentsMap.get(t.partnerId) || 0;
                    adjustmentsMap.set(t.partnerId, currentAdj + val);
                }
            }
        });
    }

    // c. Prepare Running Balances for the start of this page
    // For every partner in the map, the "Start Page Balance" is Current - Adjustment.
    // (If a partner had no newer transactions, Adjustment is 0, so Start = Current).
    const runningPartnerBalances = new Map<number, number>();
    partnerBalanceMap.forEach((balance, pId) => {
        const adj = adjustmentsMap.get(pId) || 0;
        runningPartnerBalances.set(pId, balance - adj);
    });

    let runningTotalBalance = currentTotalBalance - totalAdjustment;

    // d. Inject Balances
    const transactionsWithBalance = transactions.map(t => {
        const sign = t.transactionClass === 'CREDIT' ? 1 : -1;
        const amount = t.amount;
        
        // 1. Get the balance for THIS transaction's partner at this moment
        let pBalance = null;
        if (t.partnerId) {
             pBalance = runningPartnerBalances.get(t.partnerId);
             // If for some reason the partner isn't in PartnerBalance table (rare), default to something or null.
             if (pBalance === undefined) {
                 // Try to estimate? Or just leave null.
                 // If we are filtering, we might have it.
                 // If we are "All", and this partner was deleted or has no balance entry?
                 pBalance = null;
             }
        }

        const txWithBal = {
            ...t,
            partnerBalance: pBalance, 
            totalBalance: runningTotalBalance
        };

        // 2. Update Running Balances (Reverse Step for Next Iteration/Older Item)
        if (t.transactionClass !== 'TRANSFER') {
            const val = amount * sign;
            
            // Global Total
            runningTotalBalance -= val;
            
            // Partner Specific
            if (t.partnerId && runningPartnerBalances.has(t.partnerId)) {
                const current = runningPartnerBalances.get(t.partnerId)!;
                runningPartnerBalances.set(t.partnerId, current - val);
            }
        }
        
        return txWithBal;
    });

    return NextResponse.json({
      transactions: transactionsWithBalance,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create standalone transaction (e.g., Transfer, Expense, Deposit)
export async function POST(request: NextRequest) {
    try {
        const currentUserId = await getCurrentUserId(request);
        if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const {
            type, // e.g., 'PARTNER_TO_PARTNER', 'EXPENSE', 'DEPOSIT'
            amount,
            partnerId,
            date,
            note,
            // For transfers:
            toPartnerId, 
            fromPartnerId 
        } = body;
        
        let txClass = getTransactionClass(type, toPartnerId, fromPartnerId);
        let pid = partnerId;

        // Special handling for partner transfer if needed
        // If type is PARTNER_TO_PARTNER, we might want to ensure logic works with new single partnerId schema?
        // Actually, a REAL transfer between partners should probably be TWO transactions or handled carefully.
        // In this new schema, 'PARTNER_TO_PARTNER' implies we might need to debit one and credit another?
        
        // Simpler approach for now:
        // If it's a generic internal record, we just save it.
        // But if we want to affect balances correctly:
        // DEPOSIT -> CREDIT partner
        // EXPENSE -> DEBIT partner
        
        // If the user selects explicit Credit/Debit from UI:
        // We trust the `partnerId` and `type` map to a class.
        
        // Let's rely on body.transactionClass if provided, else helper
        if (body.transactionClass) txClass = body.transactionClass;

        if (!pid && toPartnerId) pid = toPartnerId; 

         const result = await prisma.$transaction(async (tx) => {
             const newTx = await tx.transaction.create({
                 data: {
                     type,
                     amount: parseFloat(amount),
                     transactionClass: txClass,
                     partnerId: parseInt(pid),
                     date: new Date(date),
                     note,
                     createdById: currentUserId
                 }
             });

             // Update Balance
             if (txClass !== 'TRANSFER') {
                 const balanceChange = txClass === 'CREDIT' ? parseFloat(amount) : -parseFloat(amount);
                 await tx.partnerBalance.upsert({
                     where: {
                        partnerId_createdById: {
                            partnerId: parseInt(pid),
                            createdById: currentUserId
                        }
                     },
                     create: {
                         partnerId: parseInt(pid),
                         balance: balanceChange,
                         createdById: currentUserId,
                         lastTransactionId: newTx.id
                     },
                     update: {
                         balance: { increment: balanceChange },
                         lastTransactionId: newTx.id,
                         lastUpdated: new Date()
                     }
                 });
             } else {
                 // Logic for TRANSFER (Partner to Partner)
                 // If we have fromPartnerId and toPartnerId
                 if (fromPartnerId && toPartnerId) {
                     // 1. Debit fromPartner
                     await tx.partnerBalance.update({
                         where: { partnerId_createdById: { partnerId: parseInt(fromPartnerId), createdById: currentUserId } },
                         data: { balance: { decrement: parseFloat(amount) } }
                     });
                     // 2. Credit toPartner
                     await tx.partnerBalance.update({
                         where: { partnerId_createdById: { partnerId: parseInt(toPartnerId), createdById: currentUserId } },
                         data: { balance: { increment: parseFloat(amount) } }
                     });
                     
                     // We created the main transaction above linked to 'pid' (maybe one of them).
                     // Ideally transfers create a matching pair, or we just track the 'main' one.
                     // For now, let's keep it simple.
                 }
             }

             return newTx;
         });

         return NextResponse.json(result, { status: 201 });

    } catch (e) {
        console.error(e);
         return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}