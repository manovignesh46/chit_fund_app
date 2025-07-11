// Script to check loan 9 details
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLoan() {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: 9 },
      include: { repayments: true }
    });
    
    console.log('Loan 9 details:');
    console.log(`  ID: ${loan.id}`);
    console.log(`  Amount: ${loan.amount}`);
    console.log(`  Duration: ${loan.duration}`);
    console.log(`  Installment Amount: ${loan.installmentAmount}`);
    console.log(`  Remaining Due: ${loan.remainingDue}`);
    console.log(`  Remaining Amount: ${loan.remainingAmount}`);
    
    console.log('\nRepayments:');
    loan.repayments.forEach(r => {
      console.log(`  ID: ${r.id}, Amount: ${r.amount}, Type: ${r.paymentType}, Date: ${r.paidDate}`);
    });
    
    // Count full repayments
    const fullRepayments = loan.repayments.filter(r => r.paymentType !== 'INTEREST_ONLY').length;
    console.log(`\nFull repayments: ${fullRepayments}`);
    
    // Calculate expected remaining due
    const expectedRemainingDue = Math.max(0, loan.duration - fullRepayments);
    console.log(`Expected remaining due: ${expectedRemainingDue}`);
    
    // Calculate expected remaining amount
    const expectedRemainingAmount = expectedRemainingDue * loan.installmentAmount;
    console.log(`Expected remaining amount: ${expectedRemainingAmount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
checkLoan();
