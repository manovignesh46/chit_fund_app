const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Test connection
    console.log('Testing database connection...');
    
    // Create a test user
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      },
    });
    
    console.log('Created test user:', user);
    
    // Create a test chit fund
    const chitFund = await prisma.chitFund.create({
      data: {
        name: 'Test Chit Fund',
        totalAmount: 100000,
        monthlyContribution: 5000,
        duration: 20,
        membersCount: 20,
        status: 'Active',
        startDate: new Date(),
        nextAuctionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        description: 'This is a test chit fund',
      },
    });
    
    console.log('Created test chit fund:', chitFund);
    
    // Create a test loan
    const loan = await prisma.loan.create({
      data: {
        borrowerName: 'Test Borrower',
        contact: '1234567890',
        loanType: 'Personal',
        amount: 50000,
        interestRate: 12,
        duration: 12,
        disbursementDate: new Date(),
        repaymentType: 'Monthly',
        remainingAmount: 50000,
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'Active',
        purpose: 'This is a test loan',
      },
    });
    
    console.log('Created test loan:', loan);
    
    console.log('Database connection test successful!');
  } catch (error) {
    console.error('Database connection test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
