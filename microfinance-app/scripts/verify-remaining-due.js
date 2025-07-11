// Script to verify that all loans have the remainingDue field properly set

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRemainingDue() {
  console.log('Verifying remainingDue field for all loans...');
  
  try {
    // Get all loans
    const loans = await prisma.loan.findMany({
      select: {
        id: true,
        borrowerId: true,
        amount: true,
        duration: true,
        remainingAmount: true,
        remainingDue: true,
        status: true
      }
    });
    
    console.log(`Found ${loans.length} loans to verify`);
    
    let missingRemainingDue = 0;
    let nullRemainingDue = 0;
    let zeroRemainingDue = 0;
    let validRemainingDue = 0;
    
    // Check each loan
    for (const loan of loans) {
      console.log(`Loan ID ${loan.id}: remainingDue=${loan.remainingDue}, remainingAmount=${loan.remainingAmount}`);
      
      if (loan.remainingDue === undefined) {
        console.log(`  MISSING: Loan ID ${loan.id} is missing the remainingDue field`);
        missingRemainingDue++;
      } else if (loan.remainingDue === null) {
        console.log(`  NULL: Loan ID ${loan.id} has a null remainingDue value`);
        nullRemainingDue++;
      } else if (loan.remainingDue === 0 && loan.status === 'Active') {
        console.log(`  ZERO: Loan ID ${loan.id} has a zero remainingDue value but is Active`);
        zeroRemainingDue++;
      } else {
        console.log(`  VALID: Loan ID ${loan.id} has a valid remainingDue value: ${loan.remainingDue}`);
        validRemainingDue++;
      }
    }
    
    console.log('Verification summary:');
    console.log(`  Total loans: ${loans.length}`);
    console.log(`  Loans with missing remainingDue: ${missingRemainingDue}`);
    console.log(`  Loans with null remainingDue: ${nullRemainingDue}`);
    console.log(`  Active loans with zero remainingDue: ${zeroRemainingDue}`);
    console.log(`  Loans with valid remainingDue: ${validRemainingDue}`);
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
verifyRemainingDue();
