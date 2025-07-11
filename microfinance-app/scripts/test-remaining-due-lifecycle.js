// Script to test the complete lifecycle of remainingDue in a loan

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLoanRemainingDueLifecycle() {
  console.log('Testing remainingDue field lifecycle...');
  
  try {
    // 1. Get an existing user for createdById
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found to use as createdById');
    }
    
    // 2. Get an existing global member for borrowerId
    const borrower = await prisma.globalMember.findFirst();
    if (!borrower) {
      throw new Error('No global member found to use as borrowerId');
    }
    
    // 3. Create a test loan with remainingDue explicitly set
    console.log('Creating test loan...');
    const testLoan = await prisma.loan.create({
      data: {
        borrowerId: borrower.id,
        loanType: 'Monthly',
        amount: 10000,
        interestRate: 500,
        installmentAmount: 1000,
        duration: 12,
        disbursementDate: new Date(),
        repaymentType: 'Monthly',
        remainingAmount: 12000,
        remainingDue: 12, // Explicitly set remainingDue
        status: 'Active',
        createdById: user.id
      },
      select: {
        id: true,
        remainingDue: true,
        remainingAmount: true,
        duration: true
      }
    });
    
    console.log('Test loan created:', testLoan);
    
    // 4. Update the loan's remainingDue
    console.log('Updating test loan remainingDue...');
    const updatedLoan = await prisma.loan.update({
      where: { id: testLoan.id },
      data: {
        remainingDue: 10 // Change to a different value
      },
      select: {
        id: true,
        remainingDue: true,
        remainingAmount: true
      }
    });
    
    console.log('Test loan updated:', updatedLoan);
    
    // 5. Retrieve the loan and check if remainingDue is present
    console.log('Retrieving test loan...');
    const retrievedLoan = await prisma.loan.findUnique({
      where: { id: testLoan.id }
    });
    
    console.log('Test loan retrieved:', {
      id: retrievedLoan.id,
      remainingDue: retrievedLoan.remainingDue,
      hasRemainingDue: 'remainingDue' in retrievedLoan,
      remainingDueType: typeof retrievedLoan.remainingDue
    });
    
    // 6. Try to retrieve the loan with explicit select for remainingDue
    console.log('Retrieving test loan with explicit select...');
    const explicitRetrievedLoan = await prisma.loan.findUnique({
      where: { id: testLoan.id },
      select: {
        id: true,
        remainingDue: true,
        remainingAmount: true
      }
    });
    
    console.log('Test loan retrieved with explicit select:', explicitRetrievedLoan);
    
    // 7. Clean up by deleting the test loan
    console.log('Cleaning up test loan...');
    await prisma.loan.delete({
      where: { id: testLoan.id }
    });
    
    console.log('Test complete! Test loan deleted.');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLoanRemainingDueLifecycle();
