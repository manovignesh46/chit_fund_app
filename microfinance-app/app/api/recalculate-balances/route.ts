import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

/**
 * API endpoint to recalculate all transaction balances for the current user
 * This is equivalent to running the fix-balances.js script
 */
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔧 Starting balance recalculation for user ID: ${currentUserId}`);

    // Get all transactions for this user, ordered by creation time
    const transactions = await prisma.transaction.findMany({
      where: { createdById: currentUserId },
      orderBy: [
        { createdAt: 'asc' }
      ],
      include: {
        fromPartner: true,
        toPartner: true
      }
    });

    console.log(`  Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      return NextResponse.json({ 
        message: 'No transactions to process',
        transactionsProcessed: 0 
      });
    }

    // Initialize running balances
    let totalBalance = 0;
    const partnerBalances = new Map<number, number>();

    // Process each transaction in chronological order
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      // Calculate balance changes based on transaction type
      let totalBalanceChange = 0;
      const affectedPartners = new Map<number, number>(); // partnerId -> balanceChange
      
      switch (transaction.type) {
        case 'collection':
        case 'CHIT_CONTRIBUTION':
        case 'LOAN_REPAYMENT':
        case 'DOCUMENT_CHARGE':
          // Money coming in - increases total and receiving partner's balance
          totalBalanceChange = transaction.amount;
          if (transaction.to_partner_id) {
            affectedPartners.set(transaction.to_partner_id, transaction.amount);
          }
          break;

        case 'expense':
        case 'LOAN_DISBURSEMENT':
        case 'AUCTION_PAYOUT':
          // Money going out - decreases total and sending partner's balance
          totalBalanceChange = -transaction.amount;
          if (transaction.from_partner_id) {
            affectedPartners.set(transaction.from_partner_id, -transaction.amount);
          }
          break;

        case 'transfer':
        case 'PARTNER_TO_PARTNER':
          // Internal transfer - no change to total, but affects both partners
          totalBalanceChange = 0;
          if (transaction.from_partner_id) {
            affectedPartners.set(transaction.from_partner_id, -transaction.amount);
          }
          if (transaction.to_partner_id) {
            affectedPartners.set(transaction.to_partner_id, transaction.amount);
          }
          break;

        case 'balance_adjustment':
          // Manual adjustment - affects total and target partner
          totalBalanceChange = transaction.amount;
          if (transaction.to_partner_id) {
            affectedPartners.set(transaction.to_partner_id, transaction.amount);
          }
          break;

        case 'RECORD_AMOUNT':
          // Record amount - can be either credit (to_partner) or debit (from_partner)
          if (transaction.to_partner_id) {
            // Money coming in to to_partner (credit)
            totalBalanceChange = transaction.amount;
            affectedPartners.set(transaction.to_partner_id, transaction.amount);
          } else if (transaction.from_partner_id) {
            // Money going out from from_partner (debit)
            totalBalanceChange = -transaction.amount;
            affectedPartners.set(transaction.from_partner_id, -transaction.amount);
          }
          break;

        default:
          console.log(`  ⚠️  Unknown transaction type: ${transaction.type}`);
          break;
      }

      // Update total balance
      totalBalance += totalBalanceChange;

      // Update partner balances
      for (const [partnerId, balanceChange] of affectedPartners) {
        const currentBalance = partnerBalances.get(partnerId) || 0;
        partnerBalances.set(partnerId, currentBalance + balanceChange);
      }

      // Determine which partner balance to store in the transaction record
      // Priority: to_partner_id, then from_partner_id
      const primaryPartnerId = transaction.to_partner_id || transaction.from_partner_id;
      const transactionPartnerBalance = primaryPartnerId ? (partnerBalances.get(primaryPartnerId) || 0) : 0;

      // Update the transaction record
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          partnerBalance: transactionPartnerBalance,
          totalBalance: totalBalance
        }
      });
    }

    console.log(`  ✅ Balance recalculation completed`);
    console.log(`  📊 Final total balance: ₹${totalBalance.toLocaleString()}`);

    // Get partner balances for response
    const partners = await prisma.partner.findMany({
      where: { createdById: currentUserId },
      select: { id: true, name: true }
    });

    const partnerBalanceData = partners.map(partner => ({
      name: partner.name,
      balance: partnerBalances.get(partner.id) || 0
    }));

    return NextResponse.json({
      message: 'Balance recalculation completed successfully',
      transactionsProcessed: transactions.length,
      finalTotalBalance: totalBalance,
      partnerBalances: partnerBalanceData
    });

  } catch (error) {
    console.error('❌ Error during balance recalculation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to recalculate balances', details: errorMessage },
      { status: 500 }
    );
  }
}
