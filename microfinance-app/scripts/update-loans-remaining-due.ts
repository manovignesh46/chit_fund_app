/**
 * Script to update the remainingDue field for all loans
 * This script will update the remainingDue column for all loans in the database
 * based on disbursementDate, duration, repaymentType, and existing repayments
 */

const prisma = require('../lib/prisma');
const { calculateRemainingDue } = require('../lib/loanCalculations');

async function updateAllLoansRemainingDue() {
  try {
    console.log('Starting to update remainingDue for all loans...');
    
    // Get all loans
    const loans = await prisma.loan.findMany({
      select: {
        id: true,
        status: true,
        borrower: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`Found ${loans.length} loans to process`);
    
    // Process each loan
    for (const loan of loans) {
      try {
        // Calculate and update remainingDue
        const remainingDue = await calculateRemainingDue(loan.id);
        
        console.log(`Updated loan ID ${loan.id} for ${loan.borrower.name}: remainingDue = ${remainingDue}`);
      } catch (error) {
        console.error(`Error processing loan ID ${loan.id}:`, error);
      }
    }
    
    console.log('Finished updating remainingDue for all loans');
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateAllLoansRemainingDue()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
