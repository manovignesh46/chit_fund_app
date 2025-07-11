// Script to verify that the remainingDue and remainingAmount calculations
// are correct for all loans in the system

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyLoanCalculations() {
  console.log('Starting verification of remainingDue and remainingAmount for all loans...');
  
  try {
    // Get all active loans with their repayments
    const loans = await prisma.loan.findMany({
      where: {
        status: 'Active'
      },
      include: {
        repayments: true
      }
    });
    
    console.log(`Found ${loans.length} active loans to verify`);
    
    let issuesFound = 0;
    
    // Process each loan
    for (const loan of loans) {
      console.log(`\nVerifying loan ID ${loan.id} for borrower ${loan.borrowerId}`);
      
      try {
        // Count full repayments (excluding interest-only payments)
        const fullRepayments = loan.repayments.filter(
          (r) => r.paymentType !== 'INTEREST_ONLY'
        ).length;
        
        // Calculate expected remaining due
        const expectedRemainingDue = Math.max(0, loan.duration - fullRepayments);
        
        // Calculate expected remaining amount
        const expectedRemainingAmount = expectedRemainingDue * loan.installmentAmount;
        
        // Compare with actual values in the database
        const actualRemainingDue = loan.remainingDue;
        const actualRemainingAmount = loan.remainingAmount;
        
        // Check if values match
        const remainingDueMatches = expectedRemainingDue === actualRemainingDue;
        const remainingAmountMatches = Math.abs(expectedRemainingAmount - actualRemainingAmount) < 0.01; // Allow for small floating point differences
        
        if (remainingDueMatches && remainingAmountMatches) {
          console.log(`✅ Loan ID ${loan.id}: Calculations are correct`);
          console.log(`   remainingDue: ${actualRemainingDue}, remainingAmount: ${actualRemainingAmount.toFixed(2)}`);
        } else {
          console.log(`❌ Loan ID ${loan.id}: Calculation mismatch!`);
          console.log(`   Expected remainingDue: ${expectedRemainingDue}, Actual: ${actualRemainingDue}`);
          console.log(`   Expected remainingAmount: ${expectedRemainingAmount.toFixed(2)}, Actual: ${actualRemainingAmount.toFixed(2)}`);
          issuesFound++;
        }
      } catch (err) {
        console.error(`Error verifying loan ID ${loan.id}:`, err);
        issuesFound++;
      }
    }
    
    if (issuesFound === 0) {
      console.log('\n✅ All loans have correct remainingDue and remainingAmount values!');
    } else {
      console.log(`\n❌ Found ${issuesFound} loans with calculation issues. Consider running the recalculation script.`);
    }
  } catch (error) {
    console.error('Error during loan verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyLoanCalculations();
