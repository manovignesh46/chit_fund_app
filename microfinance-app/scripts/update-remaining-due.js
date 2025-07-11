/**
 * Script to update the remainingDue field for all loans
 * This script will update the remainingDue column for all loans in the database
 * based on disbursementDate, duration, repaymentType, and existing repayments
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function calculateRemainingDue(loanId) {
  try {
    // Get the loan with its repayments
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        repayments: true
      }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // If loan is not active or has been fully paid, no remaining due
    if (loan.status !== 'Active' || loan.remainingAmount <= 0) {
      // Update the loan with remainingDue = 0
      await prisma.loan.update({
        where: { id: loanId },
        data: { 
          remainingDue: 0,
          // Also update remainingAmount to make sure it's consistent
          remainingAmount: 0
        }
      });
      return 0;
    }

    // Count the number of full repayments (excluding interest-only payments)
    const fullRepayments = loan.repayments.filter(
      (r) => r.paymentType !== 'INTEREST_ONLY'
    ).length;

    // Calculate remaining due (total duration minus full repayments)
    const remainingDue = Math.max(0, loan.duration - fullRepayments);
    
    // Calculate remaining amount based on installment amount and remaining due
    // This ensures consistency between remainingDue and remainingAmount
    const updatedRemainingAmount = remainingDue * (loan.installmentAmount - loan.interestRate);

    // Update the loan with the new remainingDue value and adjusted remainingAmount
    await prisma.loan.update({
      where: { id: loanId },
      data: { 
        remainingDue,
        remainingAmount: updatedRemainingAmount
      }
    });

    console.log(`Updated loan ${loanId}: remainingDue=${remainingDue}, remainingAmount=${updatedRemainingAmount}`);

    return remainingDue;
  } catch (error) {
    console.error('Error calculating remaining due payments:', error);
    throw error;
  }
}

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
