import { PrismaClient } from '@prisma/client';
import { getPreviousMonth, monthStart, monthEnd, extractMonthYear, formatMonthYear } from './partnerSummaryUtils';
import prisma from './prisma';

/**
 * Calculate and update partner's monthly summary
 */
export async function calculatePartnerMonthlySummary(partnerId: number, month: string) {
  try {
    // Extract month and year from month string
    const { month: monthNum, year } = extractMonthYear(month);
    
    // Get previous month's summary for closing balance
    const prevMonth = getPreviousMonth(month);
    const prevMonthData = extractMonthYear(prevMonth);

    const prevSummary = await prisma.partnerMonthlySummary.findUnique({
      where: {
        partnerId_month_year: {
          partnerId,
          month: prevMonthData.month,
          year: prevMonthData.year
        }
      }
    });

    // Calculate this month's data
    const startDate = monthStart(month);
    const endDate = monthEnd(month);

    // Get loan repayments collected by this partner in this month
    const loanRepayment = await prisma.repayment.aggregate({
      _sum: { amount: true },
      where: {
        collected_by_id: partnerId,
        paidDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get loans disbursed by this partner in this month
    const loanDisbursement = await prisma.loan.aggregate({
      _sum: { amount: true },
      where: {
        disbursed_by_id: partnerId,
        disbursementDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get chit contributions collected by this partner in this month
    const chitContributions = await prisma.contribution.aggregate({
      _sum: { amount: true },
      where: {
        collected_by_id: partnerId,
        paidDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get auction payouts disbursed by this partner in this month
    const auctionPayout = await prisma.auction.aggregate({
      _sum: { amount: true },
      where: {
        disbursed_by_id: partnerId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Set defaults for null aggregation results
    const loanRepaymentSum = loanRepayment._sum.amount ?? 0;
    const loanDisbursementSum = loanDisbursement._sum.amount ?? 0;
    const chitContributionsSum = chitContributions._sum.amount ?? 0;
    const auctionPayoutSum = auctionPayout._sum.amount ?? 0;
    
    // Use previous month's remaining amount as this month's closing balance
    // Default to 0 if no previous month summary exists
    const closingBalance = prevSummary?.remainingAmount ?? 0;
    
    // Calculate remaining amount using all collected and disbursed amounts
    const remainingAmount = closingBalance 
      + loanRepaymentSum 
      - loanDisbursementSum 
      + chitContributionsSum 
      - auctionPayoutSum;

    // Upsert the partner monthly summary
    const summary = await prisma.partnerMonthlySummary.upsert({
      where: {
        partnerId_month_year: {
          partnerId,
          month: monthNum,
          year
        }
      },
      update: {
        closingBalance,
        loanRepayment: loanRepaymentSum,
        loanDisbursement: loanDisbursementSum,
        chitContributions: chitContributionsSum,
        auctionPayout: auctionPayoutSum,
        remainingAmount
      },
      create: {
        partnerId,
        month: monthNum,
        year,
        closingBalance,
        loanRepayment: loanRepaymentSum,
        loanDisbursement: loanDisbursementSum,
        chitContributions: chitContributionsSum,
        auctionPayout: auctionPayoutSum,
        remainingAmount
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating partner monthly summary:', error);
    throw error;
  }
}

/**
 * Get partner monthly summary by partner ID and month
 */
export async function getPartnerMonthlySummary(partnerId: number, month: string) {
  try {
    // Extract month and year
    const { month: monthNum, year } = extractMonthYear(month);
    
    // First check if summary exists
    const existingSummary = await prisma.partnerMonthlySummary.findUnique({
      where: {
        partnerId_month_year: {
          partnerId,
          month: monthNum,
          year
        }
      }
    });

    // If it doesn't exist, calculate it
    if (!existingSummary) {
      return calculatePartnerMonthlySummary(partnerId, month);
    }

    return existingSummary;
  } catch (error) {
    console.error('Error getting partner monthly summary:', error);
    throw error;
  }
}

/**
 * Get all partners' monthly summaries for a specific month
 */
export async function getAllPartnersMonthlySummary(month: string) {
  try {
    // Get all active partners
    const partners = await prisma.partner.findMany({
      where: { isActive: true }
    });

    // Get or calculate summaries for all partners
    const summaries = await Promise.all(
      partners.map(partner => getPartnerMonthlySummary(partner.id, month))
    );

    return summaries;
  } catch (error) {
    console.error('Error getting all partners monthly summaries:', error);
    throw error;
  }
}

/**
 * Recalculate monthly summaries for a partner
 * This is useful after data corrections
 */
export async function recalculatePartnerSummaries(partnerId: number, months: string[]) {
  try {
    // Sort months chronologically to ensure closing balances are correct
    const sortedMonths = [...months].sort();
    
    for (const month of sortedMonths) {
      await calculatePartnerMonthlySummary(partnerId, month);
    }
    
    return true;
  } catch (error) {
    console.error('Error recalculating partner summaries:', error);
    throw error;
  }
}
