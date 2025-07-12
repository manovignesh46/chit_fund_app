// Script to test the partner monthly summary system
// Run with: node scripts/test-partner-summary.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing partner monthly summary system...');

    // Get current and previous month
    const currentMonth = getCurrentMonth();
    const prevMonth = getPreviousMonth(currentMonth);

    // Get all active partners
    const partners = await prisma.partner.findMany({
      where: { isActive: true },
    });

    if (partners.length === 0) {
      console.log('No active partners found. Please create some partners first.');
      return;
    }

    console.log(`Calculating summaries for ${partners.length} partners for months: ${prevMonth} and ${currentMonth}`);

    // Calculate summaries for all partners for both months
    for (const partner of partners) {
      console.log(`Processing partner: ${partner.name} (ID: ${partner.id})`);
      
      // Process previous month first to establish closing balance
      console.log(`  Calculating for month: ${prevMonth}`);
      const prevMonthSummary = await calculatePartnerMonthlySummary(partner.id, prevMonth);
      console.log(`  Previous month summary:`, {
        month: prevMonthSummary.month,
        closingBalance: prevMonthSummary.closingBalance,
        loanRepayment: prevMonthSummary.loanRepayment,
        loanDisbursement: prevMonthSummary.loanDisbursement,
        chitContributions: prevMonthSummary.chitContributions,
        auctionPayout: prevMonthSummary.auctionPayout,
        remainingAmount: prevMonthSummary.remainingAmount,
      });
      
      // Then process current month
      console.log(`  Calculating for month: ${currentMonth}`);
      const currentMonthSummary = await calculatePartnerMonthlySummary(partner.id, currentMonth);
      console.log(`  Current month summary:`, {
        month: currentMonthSummary.month,
        closingBalance: currentMonthSummary.closingBalance,
        loanRepayment: currentMonthSummary.loanRepayment,
        loanDisbursement: currentMonthSummary.loanDisbursement,
        chitContributions: currentMonthSummary.chitContributions,
        auctionPayout: currentMonthSummary.auctionPayout,
        remainingAmount: currentMonthSummary.remainingAmount,
      });
    }

    console.log('Partner monthly summary calculation completed successfully.');
  } catch (error) {
    console.error('Error testing partner monthly summary:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Utility functions from partnerSummaryUtils.js
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  
  if (month === 1) {
    // If January, go to December of previous year
    return `${year - 1}-12`;
  } else {
    // Otherwise, go to previous month of same year
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }
}

// Function from partnerSummaryService.js
async function calculatePartnerMonthlySummary(partnerId, month) {
  try {
    // Get previous month's summary for closing balance
    const prevMonth = getPreviousMonth(month);
    const prevSummary = await prisma.partnerMonthlySummary.findUnique({
      where: {
        partnerId_month: {
          partnerId,
          month: prevMonth
        }
      }
    });

    // Calculate this month's data
    const startDate = new Date(`${month}-01`);
    const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const endDate = new Date(lastDay);
    endDate.setHours(23, 59, 59, 999);

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
        partnerId_month: {
          partnerId,
          month
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
        month,
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

main()
  .catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
