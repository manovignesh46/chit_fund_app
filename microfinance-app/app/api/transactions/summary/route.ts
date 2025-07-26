import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../config/config';

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

    // Build where clause for filtering
    const where: any = {
      createdById: currentUserId
    };

    // Apply filters
    if (partner && partner !== 'ALL') {
      where.OR = [
        { action_performer: partner },
        { from_partner: partner },
        { to_partner: partner }
      ];
    }

    if (type) {
      where.type = type;
    }

    if (member) {
      where.note = {
        contains: member,
        mode: 'insensitive'
      };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    // Advanced filters
    if (advType || advMember || advEntity || advSubType) {
      if (advType === 'loan') {
        if (advSubType === 'disbursement') {
          where.type = TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT;
        } else if (advSubType === 'repayment') {
          where.type = TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT;
        } else if (!advSubType) {
          where.type = {
            in: [TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT, TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT]
          };
        }
        
        // Filter by specific loan entity if provided
        if (advEntity) {
          const loanId = parseInt(advEntity);
          
          // For loan-related transactions, we need to check:
          // 1. Direct loan relation (for disbursements)
          // 2. Repayment relation where repayment belongs to the loan (for repayments)
          if (advSubType === 'disbursement') {
            where.loan = { id: loanId };
          } else if (advSubType === 'repayment') {
            where.repayment = { loanId: loanId };
          } else {
            // No specific subtype - show both disbursement and repayment
            where.OR = [
              { loan: { id: loanId } }, // Direct loan relation (disbursements)
              { repayment: { loanId: loanId } } // Repayment relation (repayments)
            ];
          }
        }
      } else if (advType === 'chit') {
        if (advSubType === 'contribution') {
          where.type = TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION;
        } else if (advSubType === 'auction') {
          where.type = TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT;
        } else if (!advSubType) {
          where.type = {
            in: [TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION, TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT]
          };
        }
      }

      if (advMember) {
        where.note = {
          contains: advMember,
          mode: 'insensitive'
        };
      }

      // Entity filtering for chit funds only (loan entity filtering is handled above)
      if (advEntity && advType === 'chit') {
        // For chit fund filtering, we need to check both contribution and auction relations
        where.OR = [
          { contribution: { chitFundId: parseInt(advEntity) } },
          { auction: { chitFundId: parseInt(advEntity) } }
        ];
      }
    }

    // Fetch all transactions that match the filter
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true }
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
    } } = {};

    // Process each transaction
    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount || 0);
      const signedAmount = transaction.amount || 0;

      // Categorize by transaction type
      switch (transaction.type) {
        case TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT:
          totalLoanRepayment += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT:
          totalLoanDisbursement += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION:
          totalChitContributions += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT:
          totalAuctionPayouts += amount;
          break;
        case TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT:
          // For recorded amounts, determine if it's a credit or debit based on from_partner/to_partner
          if (transaction.to_partner) {
            // Money going TO a partner (credit to the system)
            totalRecordedAmountCredit += amount;
          } else if (transaction.from_partner) {
            // Money coming FROM a partner (debit from the system)
            totalRecordedAmountDebit += amount;
          } else {
            // If neither from_partner nor to_partner is specified, use amount sign as fallback
            if (signedAmount >= 0) {
              totalRecordedAmountCredit += amount;
            } else {
              totalRecordedAmountDebit += amount;
            }
          }
          break;
        case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
          totalPartnerTransfers += amount;
          break;
      }

      // Track partner statistics
      const getPartnerForTransaction = (t: any) => {
        if (t.type === 'PARTNER_TO_PARTNER') {
          if (t.from_partner && !t.to_partner) return t.from_partner;
          if (t.to_partner && !t.from_partner) return t.to_partner;
          if (partner && partner !== 'ALL') {
            return partner; // Use filtered partner
          }
          return t.from_partner || t.to_partner;
        }
        return t.action_performer;
      };

      const partnerName = getPartnerForTransaction(transaction);
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
            partnerTransfersOut: 0
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
          case TRANSACTION_TYPES_CONFIG.CHIT_CONTRIBUTION:
            partnerStats[partnerName].chitContributions += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.AUCTION_PAYOUT:
            partnerStats[partnerName].auctionPayouts += amount;
            break;
          case TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT:
            // Calculate net recorded amount for this partner based on from_partner/to_partner logic
            if (transaction.to_partner === partnerName) {
              // Money going TO this partner (positive for partner)
              partnerStats[partnerName].recordedAmounts += amount;
            } else if (transaction.from_partner === partnerName) {
              // Money coming FROM this partner (negative for partner)
              partnerStats[partnerName].recordedAmounts -= amount;
            } else if (partnerName === transaction.action_performer) {
              // If this partner is the action performer but not from/to, use signed amount
              partnerStats[partnerName].recordedAmounts += signedAmount;
            }
            break;
          case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
            // Track incoming vs outgoing transfers for net calculation
            if (transaction.to_partner === partnerName) {
              partnerStats[partnerName].partnerTransfersIn += amount;
            } else if (transaction.from_partner === partnerName) {
              partnerStats[partnerName].partnerTransfersOut += amount;
            }
            break;
        }

        // Determine if this is a credit or debit for the partner
        const isCredit = getCreditDebitStatus(transaction, partnerName);
        if (isCredit) {
          partnerStats[partnerName].totalCredits += amount;
          partnerStats[partnerName].balance += signedAmount; // Use signed amount for accurate balance
        } else {
          partnerStats[partnerName].totalDebits += amount;
          partnerStats[partnerName].balance += signedAmount; // Use signed amount for accurate balance
        }
      }
    }

    // Calculate total amount as (Credits - Debits)
    // Credits: Loan Repayments + Chit Contributions + Recorded Amount Credits
    // Debits: Loan Disbursements + Auction Payouts + Recorded Amount Debits
    const netRecordedAmount = totalRecordedAmountCredit - totalRecordedAmountDebit;
    totalAmount = (totalLoanRepayment + totalChitContributions + totalRecordedAmountCredit) - (totalLoanDisbursement + totalAuctionPayouts + totalRecordedAmountDebit);

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
        partnerTotalAmount: (stats.loanRepayments + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts) + (stats.partnerTransfersIn - stats.partnerTransfersOut)
      };
    });

    const totalNetPartnerTransfers = partnerBreakdown.reduce((sum, partner) => sum + partner.partnerTransfers, 0);
    const finalTotalAmount = totalAmount + totalNetPartnerTransfers;

    const summaryData = {
      totalLoanRepayment,
      totalLoanDisbursement,
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
  const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION'];
  const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
  
  if (creditTypes.includes(transaction.type)) return true;
  if (debitTypes.includes(transaction.type)) return false;
  
  // Fallback to amount sign
  return (transaction.amount || 0) >= 0;
}
