const prisma = require('./prisma');

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

/**
 * Calculate the number of remaining due payments for a loan
 * @param loanId The ID of the loan
 * @param tx Optional transaction for atomic operations
 * @returns The number of remaining due payments
 */
exports.calculateRemainingDue = async function(loanId, tx) {
  try {
    // Use the provided transaction object or the global prisma instance
    const db = tx || prismaAny;
    
    // Ensure db is valid
    if (!db || typeof db !== 'object') {
      console.error('Invalid database client:', db);
      throw new Error('Invalid database client provided');
    }
    
    let loan;
    
    // Handle case where db might not have loan property
    if (!db.loan) {
      console.warn('Using fallback to prismaAny for loan operations');
      // Get the loan with its repayments using the global prisma instance
      loan = await prismaAny.loan.findUnique({
        where: { id: loanId },
        include: {
          repayments: true
        }
      });
    } else {
      // Normal case: use the provided db object
      loan = await db.loan.findUnique({
        where: { id: loanId },
        include: {
          repayments: true
        }
      });
    }
    
    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // If loan is not active or has been fully paid, no remaining due
    if (loan.status !== 'Active' || loan.remainingAmount <= 0) {
      // If using a transaction, update through it
      const updateData = { remainingDue: 0, remainingAmount: 0 };
      
      if (tx && tx.loan) {
        await tx.loan.update({
          where: { id: loanId },
          data: updateData
        });
      } else {
        // Otherwise use the global prisma instance
        await prismaAny.loan.update({
          where: { id: loanId },
          data: updateData
        });
      }
      return 0;
    }

    // Count the number of full repayments (excluding interest-only payments)
    const fullRepayments = loan.repayments.filter(
      (r: any) => r.paymentType !== 'INTEREST_ONLY'
    ).length;

    // Calculate remaining due (total duration minus full repayments)
    const remainingDue = Math.max(0, loan.duration - fullRepayments);
    
    // Calculate remaining amount based on full installment amount and remaining due
    // This ensures consistency between remainingDue and remainingAmount
    const updatedRemainingAmount = remainingDue * loan.installmentAmount;

    // Update the loan with the new remainingDue value and adjusted remainingAmount
    const updateData = { 
      remainingDue,
      remainingAmount: updatedRemainingAmount
    };
    
    // If using a transaction, update through it
    if (tx && tx.loan) {
      await tx.loan.update({
        where: { id: loanId },
        data: updateData
      });
    } else {
      // Otherwise use the global prisma instance
      await prismaAny.loan.update({
        where: { id: loanId },
        data: updateData
      });
    }

    console.log(`Updated loan ${loanId}: remainingDue=${remainingDue}, remainingAmount=${updatedRemainingAmount}`);
    return remainingDue;
  } catch (error) {
    console.error('Error calculating remaining due payments:', error);
    throw error;
  }
}
