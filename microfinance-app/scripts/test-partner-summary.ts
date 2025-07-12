// Script to test the partner monthly summary system
// Run with: node scripts/test-partner-summary.js

const { PrismaClient } = require('@prisma/client');
const { getCurrentMonth, getPreviousMonth } = require('../lib/partnerSummaryUtils');
const { calculatePartnerMonthlySummary } = require('../lib/partnerSummaryService');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing partner monthly summary system...');

    // Get all active partners
    const partners = await prisma.partner.findMany({
      where: { isActive: true },
    });

    if (partners.length === 0) {
      console.log('No active partners found. Please create some partners first.');
      return;
    }

    // Get current and previous month
    const currentMonth = getCurrentMonth();
    const prevMonth = getPreviousMonth(currentMonth);

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

main()
  .catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
