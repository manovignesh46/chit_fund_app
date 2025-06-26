#!/usr/bin/env node

/**
 * Simple test to check current loan status and verify fixes
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLoanStatus() {
  console.log('🔍 Simple Loan Status Check');
  console.log('============================\n');

  try {
    // Get current loan with repayments
    const loan = await prisma.loan.findFirst({
      include: {
        borrower: true,
        repayments: {
          orderBy: { paidDate: 'desc' }
        }
      }
    });

    if (!loan) {
      console.log('❌ No loans found');
      return;
    }

    console.log('📊 Current Loan Details:');
    console.log(`   ID: ${loan.id}`);
    console.log(`   Borrower: ${loan.borrower.name}`);
    console.log(`   Amount: ₹${loan.amount}`);
    console.log(`   Duration: ${loan.duration} ${loan.repaymentType.toLowerCase()}`);
    console.log(`   Disbursement: ${loan.disbursementDate.toISOString().split('T')[0]}`);
    console.log(`   Remaining: ₹${loan.remainingAmount}`);
    console.log(`   Status: ${loan.status}`);

    console.log('\n💰 Repayment Summary:');
    console.log(`   Total repayments: ${loan.repayments.length}`);
    
    const interestOnlyCount = loan.repayments.filter(r => r.paymentType === 'interestOnly' || r.paymentType === 'INTEREST_ONLY').length;
    const regularCount = loan.repayments.length - interestOnlyCount;
    
    console.log(`   Regular payments: ${regularCount}`);
    console.log(`   Interest-only payments: ${interestOnlyCount}`);

    if (loan.repayments.length > 0) {
      console.log('\n📋 Recent Repayments:');
      loan.repayments.slice(0, 5).forEach((repayment, index) => {
        console.log(`   ${index + 1}. Period ${repayment.period} | ₹${repayment.amount} | ${repayment.paymentType} | ${repayment.paidDate.toISOString().split('T')[0]}`);
      });
    }

    // Calculate expected end date
    console.log('\n📅 Duration Analysis:');
    const disbursementDate = new Date(loan.disbursementDate);
    let endDate = new Date(disbursementDate);
    
    if (loan.repaymentType === 'Monthly') {
      endDate.setMonth(disbursementDate.getMonth() + loan.duration);
    } else if (loan.repaymentType === 'Weekly') {
      endDate.setDate(disbursementDate.getDate() + (loan.duration * 7));
    }
    
    console.log(`   Expected end date: ${endDate.toISOString().split('T')[0]}`);
    console.log(`   Interest-only extensions: ${interestOnlyCount} period(s)`);

    // Test summary
    console.log('\n✅ Test Summary:');
    console.log('   1. Payment Schedule Fix: Changed includeAll from true to false');
    console.log('   2. Interest-Only Extension: Added duration increment logic');
    console.log('   3. Ready for testing in browser at http://localhost:3002');

    console.log('\n🔧 Next Steps:');
    console.log('   1. Visit loan details page to verify payment schedule shows only relevant entries');
    console.log('   2. Create an interest-only payment to test duration extension');
    console.log('   3. Check that loan duration increases after interest-only payment');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLoanStatus();
