// Script to check partner monthly summaries
// Run with: node scripts/check-partner-summaries.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking partner monthly summaries...');

    // Get all partner monthly summaries
    const summaries = await prisma.partnerMonthlySummary.findMany({
      include: {
        partner: true
      }
    });

    console.log(`Found ${summaries.length} summaries.`);

    summaries.forEach(summary => {
      console.log(`Partner: ${summary.partner.name} | Month: ${summary.month}`);
      console.log(`  Closing Balance: ${summary.closingBalance}`);
      console.log(`  Loan Repayment: ${summary.loanRepayment}`);
      console.log(`  Loan Disbursement: ${summary.loanDisbursement}`);
      console.log(`  Chit Contributions: ${summary.chitContributions}`);
      console.log(`  Auction Payout: ${summary.auctionPayout}`);
      console.log(`  Remaining Amount: ${summary.remainingAmount}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error checking partner monthly summaries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
