// Script to verify that repayments are correctly updating remainingDue and remainingAmount
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyLoanCalculations() {
  console.log('Verifying loan calculations for all active loans...');
  
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
    
    // Process each loan
    for (const loan of loans) {
      console.log(`\nVerifying loan ID ${loan.id} for borrower ${loan.borrowerId}:`);
      
      try {
        // Count full repayments (excluding interest-only)
        const fullRepayments = loan.repayments.filter(
          (r) => r.paymentType !== 'INTEREST_ONLY'
        ).length;
        
        // Calculate expected remaining due
        const expectedRemainingDue = Math.max(0, loan.duration - fullRepayments);
        
        // Calculate expected remaining amount
        const expectedRemainingAmount = expectedRemainingDue * loan.installmentAmount;
        
        // Compare with actual values
        const actualRemainingDue = loan.remainingDue;
        const actualRemainingAmount = loan.remainingAmount;
        
        console.log(`  Duration: ${loan.duration}`);
        console.log(`  Full repayments: ${fullRepayments}`);
        console.log(`  Installment amount: ${loan.installmentAmount}`);
        console.log(`  Expected remainingDue: ${expectedRemainingDue}`);
        console.log(`  Actual remainingDue: ${actualRemainingDue}`);
        console.log(`  Expected remainingAmount: ${expectedRemainingAmount}`);
        console.log(`  Actual remainingAmount: ${actualRemainingAmount}`);
        
        if (expectedRemainingDue !== actualRemainingDue || 
            Math.abs(expectedRemainingAmount - actualRemainingAmount) > 0.01) {
          console.log(`  ❌ MISMATCH FOUND for loan ID ${loan.id}`);
          
          if (expectedRemainingDue !== actualRemainingDue) {
            console.log(`    remainingDue mismatch: expected ${expectedRemainingDue}, got ${actualRemainingDue}`);
          }
          
          if (Math.abs(expectedRemainingAmount - actualRemainingAmount) > 0.01) {
            console.log(`    remainingAmount mismatch: expected ${expectedRemainingAmount}, got ${actualRemainingAmount}`);
          }
        } else {
          console.log(`  ✅ Calculations are correct for loan ID ${loan.id}`);
        }
      } catch (err) {
        console.error(`  Error verifying loan ID ${loan.id}:`, err);
      }
    }
    
    console.log('\nVerification complete!');
  } catch (error) {
    console.error('Error during loan verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
verifyLoanCalculations();
