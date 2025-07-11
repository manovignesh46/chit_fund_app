// Script to directly update remainingDue for a specific loan

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRemainingDue() {
  const loanId = 10; // Example loan ID
  const newRemainingDue = 5; // Example new value
  
  try {
    console.log(`Updating loan ID ${loanId} with remainingDue=${newRemainingDue}...`);
    
    // First, get the current loan details
    const currentLoan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        remainingDue: true,
        remainingAmount: true
      }
    });
    
    console.log('Current loan details:', currentLoan);
    
    // Update the loan with a new remainingDue value
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingDue: newRemainingDue
      },
      select: {
        id: true,
        remainingDue: true,
        remainingAmount: true
      }
    });
    
    console.log('Updated loan details:', updatedLoan);
    console.log('Update successful!');
  } catch (error) {
    console.error('Error updating remainingDue:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
updateRemainingDue();
