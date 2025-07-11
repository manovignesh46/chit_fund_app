// Script to verify that dashboard Outstanding Loan Amount is correctly calculated
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Since we can't directly import from TypeScript files in a Node.js script,
// we'll manually calculate the outstanding loan amount here

async function verifyDashboardLoanAmount() {
  console.log('Verifying dashboard Outstanding Loan Amount calculation...');
  
  try {
    // Get all loans with their repayments
    const loans = await prisma.loan.findMany({
      where: {
        status: 'Active'
      },
      select: {
        id: true,
        amount: true,
        interestRate: true,
        documentCharge: true,
        repaymentType: true,
        disbursementDate: true,
        remainingAmount: true,
        repayments: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            paidDate: true,
            period: true
          }
        }
      }
    });
    
    console.log(`Found ${loans.length} active loans`);
    
    // Calculate the expected Outstanding Loan Amount manually
    const expectedOutstandingAmount = loans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
    
    console.log(`Outstanding Loan Amount (sum of all loans' remainingAmount): ${expectedOutstandingAmount}`);
    
    // Print details for each loan
    console.log('\nLoan details:');
    loans.forEach(loan => {
      console.log(`Loan ID ${loan.id}: remainingAmount = ${loan.remainingAmount}`);
    });
    
    console.log('\nThis value should match the "Outstanding Loan Amount" shown on the dashboard.');
    console.log('If it does not match, there might be an issue with how the dashboard is calculating this value.');
  } catch (error) {
    console.error('Error during dashboard verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
verifyDashboardLoanAmount();
