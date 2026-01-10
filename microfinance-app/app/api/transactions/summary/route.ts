import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../config/config';
import { buildTransactionWhereClause } from '../../../../lib/transactionWhereBuilder';

// GET /api/transactions/summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partner = searchParams.get('partner');
    const type = searchParams.get('type');
    const member = searchParams.get('member');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // Advanced filter params
    const advType = searchParams.get('advType');
    const advMember = searchParams.get('advMember');
    const advEntity = searchParams.get('advEntity');
    const advSubType = searchParams.get('advSubType');

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Build where clause using the same common utility as main transactions API
    const where = await buildTransactionWhereClause(currentUserId, {
      partner,
      type,
      member,
      startDate,
      endDate,
      advType,
      advMember,
      advEntity,
      advSubType
    });

    // Fetch all transactions that match the filter
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true }
        },
        partner: {
            select: { name: true }
        }
      }
    });

    // Calculate summary statistics
    let totalLoanRepayment = 0;
    let totalLoanDisbursement = 0;
    let totalChitContributions = 0;
    let totalAuctionPayouts = 0;
    let totalRecordedAmountCredit = 0;
    let totalRecordedAmountDebit = 0;
    let totalPartnerTransfers = 0;
    let totalDocumentCharges = 0;
    let totalAmount = 0;

    // Partner breakdown tracking
    const partnerStats: { [key: string]: {
      balance: number;
      totalCredits: number;
      totalDebits: number;
      transactionCount: number;
      loanRepayments: number;
      loanDisbursements: number;
      chitContributions: number;
      auctionPayouts: number;
      recordedAmounts: number;
      partnerTransfersIn: number;
      partnerTransfersOut: number;
      documentCharges: number;
    } } = {};

    // Process each transaction
    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount || 0);
      const signedAmount = transaction.amount || 0;
      // Use transactionClass to identify credit/debit
      const isCredit = transaction.transactionClass === 'CREDIT';

      // Categorize by transaction type
      switch (transaction.type) {
        case TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT:
          totalLoanRepayment += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT:
          totalLoanDisbursement += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.DOCUMENT_CHARGE:
          totalDocumentCharges += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION:
          totalChitContributions += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT:
          totalAuctionPayouts += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT:
          if (isCredit) {
              totalRecordedAmountCredit += amount;
          } else {
              totalRecordedAmountDebit += amount;
          }
          break;
        case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
          totalPartnerTransfers += amount;
          break;
      }

    //   // Track partner statistics
      const partnerName = transaction.partner?.name || 'Unknown';
      
      if (partnerName) {
        if (!partnerStats[partnerName]) {
          partnerStats[partnerName] = {
            balance: 0,
            totalCredits: 0,
            totalDebits: 0,
            transactionCount: 0,
            loanRepayments: 0,
            loanDisbursements: 0,
            chitContributions: 0,
            auctionPayouts: 0,
            recordedAmounts: 0,
            partnerTransfersIn: 0,
            partnerTransfersOut: 0,
            documentCharges: 0
          };
        }

        partnerStats[partnerName].transactionCount++;

        // Add to specific transaction type totals for this partner
        switch (transaction.type) {
          case TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT:
            partnerStats[partnerName].loanRepayments += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT:
            partnerStats[partnerName].loanDisbursements += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.DOCUMENT_CHARGE:
            partnerStats[partnerName].documentCharges += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION:
            partnerStats[partnerName].chitContributions += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT:
            partnerStats[partnerName].auctionPayouts += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT:
             // Record Amount Logic based on Class
             if (isCredit) {
                 partnerStats[partnerName].recordedAmounts += amount;
             } else {
                 partnerStats[partnerName].recordedAmounts -= amount;
             }
            break;
          case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
            if (isCredit) {
                partnerStats[partnerName].partnerTransfersIn += amount;
            } else {
                partnerStats[partnerName].partnerTransfersOut += amount;
            }
            break;
        }

        // Determine if this is a credit or debit for the partner
        if (isCredit) {
          partnerStats[partnerName].totalCredits += amount;
          partnerStats[partnerName].balance += amount; // Assuming amount is absolute usually, but balance needs signed?
          // If transaction.amount is signed, we can use it directly?
          // But above we used Math.abs for stats.
          // transactionClass is definitive.
        } else {
          partnerStats[partnerName].totalDebits += amount;
          partnerStats[partnerName].balance -= amount;
        }
      }
    }

    // Calculate total amount as (Credits - Debits)
    // Credits: Loan Repayments + Document Charges + Chit Contributions + Recorded Amount Credits
    // Debits: Loan Disbursements + Auction Payouts + Recorded Amount Debits
    const netRecordedAmount = totalRecordedAmountCredit - totalRecordedAmountDebit;
    totalAmount = (totalLoanRepayment + totalDocumentCharges + totalChitContributions + totalRecordedAmountCredit) - (totalLoanDisbursement + totalAuctionPayouts + totalRecordedAmountDebit);

    // Calculate balance difference as net transaction amount
    const balanceDifference = totalAmount;

    // Partner breakdown without opening/closing balances
    const partnerBreakdown = Object.entries(partnerStats).map(([name, stats]) => {
      return {
        partnerName: name,
        balance: stats.balance,
        totalCredits: stats.totalCredits,
        totalDebits: stats.totalDebits,
        transactionCount: stats.transactionCount,
        loanRepayments: stats.loanRepayments,
        loanDisbursements: stats.loanDisbursements,
        chitContributions: stats.chitContributions,
        auctionPayouts: stats.auctionPayouts,
        recordedAmounts: stats.recordedAmounts,
        partnerTransfers: stats.partnerTransfersIn - stats.partnerTransfersOut,
        documentCharges: stats.documentCharges,
        partnerTotalAmount: (stats.loanRepayments + stats.documentCharges + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts) + (stats.partnerTransfersIn - stats.partnerTransfersOut)
      };
    });

    const totalNetPartnerTransfers = partnerBreakdown.reduce((sum, partner) => sum + partner.partnerTransfers, 0);
    const finalTotalAmount = totalAmount + totalNetPartnerTransfers;

    const summaryData = {
      totalLoanRepayment,
      totalLoanDisbursement,
      totalDocumentCharges,
      totalChitContributions,
      totalAuctionPayouts,
      totalRecordedAmount: netRecordedAmount,
      totalPartnerTransfers: totalNetPartnerTransfers,
      totalAmount: finalTotalAmount,
      totalTransactions: transactions.length,
      partnerBreakdown,
      balanceDifference
    };

    return NextResponse.json(summaryData);

  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction summary' },
      { status: 500 }
    );
  }
}

// Helper function to determine credit/debit status for a partner
function getCreditDebitStatus(transaction: any, partnerName: string): boolean {
  // Returns true for credit, false for debit
  
  if (transaction.type === 'PARTNER_TO_PARTNER') {
    if (transaction.from_partner && !transaction.to_partner) {
      return transaction.from_partner !== partnerName; // Debit for from_partner
    } else if (transaction.to_partner && !transaction.from_partner) {
      return transaction.to_partner === partnerName; // Credit for to_partner
    } else if (transaction.from_partner && transaction.to_partner) {
      return transaction.to_partner === partnerName; // Credit for to_partner, debit for from_partner
    }
  }

  if (transaction.type === 'RECORD_AMOUNT') {
    if (transaction.to_partner === partnerName) return true; // Credit
    if (transaction.from_partner === partnerName) return false; // Debit
  }

  // For other transaction types, use standardized logic
  const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
  const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
  
  if (creditTypes.includes(transaction.type)) return true;
  if (debitTypes.includes(transaction.type)) return false;
  
  // Fallback to amount sign
  return (transaction.amount || 0) >= 0;
}
