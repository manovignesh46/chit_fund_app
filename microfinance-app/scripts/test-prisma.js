// test-prisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('--- Starting Prisma Test Script ---');
  try {
    // Make sure a User with id: 1 and a Partner with id: 3 exist in your database
    // Also ensure a GlobalMember with id: 1 exists, or change the ID below.
    const loan = await prisma.loan.create({
      data: {
        borrowerId: 1,
        loanType: "Monthly",
        amount: 10000,
        interestRate: 200,
        documentCharge: 500,
        installmentAmount: 2200,
        duration: 5,
        disbursementDate: new Date("2025-06-29T00:00:00.000Z"),
        repaymentType: "Monthly",
        remainingAmount: 10000,
        status: "Active",
        purpose: "prisma-test-script",
        createdById: 1,
        nextPaymentDate: new Date("2025-07-29T00:00:00.000Z"),
        disbursed_by_id: 3,
        entered_by_id: 3,
        transaction: {
          create: {
            type: "LOAN_DISBURSEMENT",
            amount: 10000,
            date: new Date("2025-06-29T00:00:00.000Z"),
            note: "Loan disbursed via test script",
            createdById: 1,
            action_performer: "Mano",
            entered_by: "Mano"
          }
        }
      },
      include: {
        borrower: true,
        transaction: true
      }
    });
    console.log('✅ Successfully created loan:', loan);
  } catch (error) {
    console.error('❌ Error in test script:', error);
  } finally {
    await prisma.$disconnect();
    console.log('--- Test Script Finished ---');
  }
}

main();