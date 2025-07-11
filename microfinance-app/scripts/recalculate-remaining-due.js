// Script to recalculate remainingDue and remainingAmount for all loans
// using the updated calculation logic

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
      await prisma.loan.update({
        where: { id: loanId },
        data: { remainingDue: 0, remainingAmount: 0 }
      });
      return 0;
    }

    // Count the number of full repayments (excluding interest-only payments)
    const fullRepayments = loan.repayments.filter(
      (r) => r.paymentType !== 'INTEREST_ONLY'
    ).length;

    // Calculate remaining due (total duration minus full repayments)
    const remainingDue = Math.max(0, loan.duration - fullRepayments);
    
    // Calculate remaining amount based on full installment amount and remaining due
    // This ensures consistency between remainingDue and remainingAmount
    const updatedRemainingAmount = remainingDue * loan.installmentAmount;

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

async function recalculateAllLoans() {
  console.log('Starting recalculation of remainingDue and remainingAmount for all loans...');
  
  try {
    // Get all active loans
    const loans = await prisma.loan.findMany({
      where: {
        status: 'Active'
      }
    });
    
    console.log(`Found ${loans.length} active loans to process`);
    
    // Process each loan
    for (const loan of loans) {
      console.log(`Processing loan ID ${loan.id} for borrower ${loan.borrowerId}`);
      
      try {
        // Call the calculateRemainingDue function to update the loan
        await calculateRemainingDue(loan.id);
        console.log(`Successfully recalculated loan ID ${loan.id}`);
      } catch (err) {
        console.error(`Error recalculating loan ID ${loan.id}:`, err);
      }
    }
    
    console.log('Recalculation complete!');
  } catch (error) {
    console.error('Error during loan recalculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
recalculateAllLoans();
