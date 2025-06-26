const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testInterestOnlyPaymentFix() {
  try {
    console.log('🧪 Testing Interest-Only Payment Partner Balance Fix...\n');

    // Find a test loan
    const loan = await prisma.loan.findFirst({
      where: {
        status: 'Active',
        repaymentType: 'Monthly'
      },
      include: {
        borrower: true
      }
    });

    if (!loan) {
      console.log('❌ No active monthly loan found for testing');
      return;
    }

    console.log(`📋 Test Loan Details:`);
    console.log(`   - ID: ${loan.id}`);
    console.log(`   - Borrower: ${loan.borrower.name}`);
    console.log(`   - Amount: ₹${loan.amount}`);
    console.log(`   - Interest Rate: ₹${loan.interestRate}`);
    console.log(`   - Installment: ₹${loan.installmentAmount}`);
    console.log(`   - Remaining: ₹${loan.remainingAmount}\n`);

    // Get partner balances before payment
    const partnersBefore = await prisma.transaction.findMany({
      where: {
        createdById: loan.createdById,
        type: 'loan_repaid'
      },
      select: {
        to_partner: true,
        amount: true,
        note: true,
        date: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 5
    });

    console.log(`💰 Recent Loan Repayment Transactions (Before Test):`);
    partnersBefore.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.to_partner}: ₹${t.amount} - ${t.note}`);
    });
    console.log('');

    // Calculate partner balance for 'Me' before test
    const meTransactionsBefore = await prisma.transaction.findMany({
      where: {
        createdById: loan.createdById,
        OR: [
          { from_partner: 'Me' },
          { to_partner: 'Me' }
        ]
      }
    });

    let meBalanceBefore = 0;
    meTransactionsBefore.forEach(t => {
      if (t.from_partner === 'Me') {
        meBalanceBefore -= t.amount;
      }
      if (t.to_partner === 'Me') {
        meBalanceBefore += t.amount;
      }
    });

    console.log(`📊 Partner 'Me' Balance Before Test: ₹${meBalanceBefore}\n`);

    // Simulate an interest-only payment
    console.log(`🔄 Simulating Interest-Only Payment...`);
    console.log(`   - Payment Amount: ₹${loan.installmentAmount} (full installment)`);
    console.log(`   - Interest Amount: ₹${loan.interestRate} (should be added to partner balance)`);
    console.log(`   - Expected Partner Balance Increase: ₹${loan.interestRate} (NOT ₹${loan.installmentAmount})\n`);

    // Create a test repayment record (interest-only)
    const testRepayment = await prisma.repayment.create({
      data: {
        loanId: loan.id,
        amount: loan.installmentAmount,
        paidDate: new Date(),
        paymentType: 'INTEREST_ONLY',
        period: 999, // Test period
        collected_by_id: 1, // Assuming partner ID 1 exists
        entered_by_id: loan.createdById,
        createdById: loan.createdById
      }
    });

    // Create the transaction record (this should use the fixed logic)
    const testTransaction = await prisma.transaction.create({
      data: {
        type: 'loan_repaid',
        amount: loan.interestRate, // This should be interest amount, not full payment
        member: loan.borrower.name,
        from_partner: null,
        to_partner: 'Me',
        action_performer: 'Me',
        entered_by: 'Me',
        date: new Date(),
        note: `TEST: Loan repayment from ${loan.borrower.name} - Period 999 (Interest Only)`,
        createdById: loan.createdById
      }
    });

    console.log(`✅ Test Transaction Created:`);
    console.log(`   - Transaction ID: ${testTransaction.id}`);
    console.log(`   - Amount Added to Partner Balance: ₹${testTransaction.amount}`);
    console.log(`   - Note: ${testTransaction.note}\n`);

    // Calculate partner balance after test
    const meTransactionsAfter = await prisma.transaction.findMany({
      where: {
        createdById: loan.createdById,
        OR: [
          { from_partner: 'Me' },
          { to_partner: 'Me' }
        ]
      }
    });

    let meBalanceAfter = 0;
    meTransactionsAfter.forEach(t => {
      if (t.from_partner === 'Me') {
        meBalanceAfter -= t.amount;
      }
      if (t.to_partner === 'Me') {
        meBalanceAfter += t.amount;
      }
    });

    const balanceIncrease = meBalanceAfter - meBalanceBefore;

    console.log(`📊 Results:`);
    console.log(`   - Partner 'Me' Balance Before: ₹${meBalanceBefore}`);
    console.log(`   - Partner 'Me' Balance After: ₹${meBalanceAfter}`);
    console.log(`   - Balance Increase: ₹${balanceIncrease}`);
    console.log(`   - Expected Increase: ₹${loan.interestRate} (interest only)`);
    console.log(`   - ❌ Wrong if increase was: ₹${loan.installmentAmount} (full payment)\n`);

    if (balanceIncrease === loan.interestRate) {
      console.log(`🎉 SUCCESS: Interest-only payment correctly added only ₹${loan.interestRate} to partner balance!`);
    } else if (balanceIncrease === loan.installmentAmount) {
      console.log(`❌ FAILED: Interest-only payment incorrectly added full payment ₹${loan.installmentAmount} to partner balance!`);
    } else {
      console.log(`⚠️  UNEXPECTED: Balance increase of ₹${balanceIncrease} doesn't match expected patterns.`);
    }

    // Clean up test data
    console.log(`\n🧹 Cleaning up test data...`);
    await prisma.transaction.delete({ where: { id: testTransaction.id } });
    await prisma.repayment.delete({ where: { id: testRepayment.id } });
    console.log(`✅ Test data cleaned up successfully.`);

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInterestOnlyPaymentFix();
