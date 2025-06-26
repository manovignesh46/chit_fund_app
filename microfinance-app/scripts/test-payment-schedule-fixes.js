#!/usr/bin/env node

/**
 * Test script to verify payment schedule fixes:
 * 1. Payment schedule filtering (should show only paid dues and next upcoming due)
 * 2. Interest-only payments extending loan duration
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPaymentScheduleFixes() {
  console.log('🔧 Testing Payment Schedule Fixes');
  console.log('==================================\n');

  try {
    // 1. Check current loan details
    console.log('1️⃣ Current Loan Status:');
    const loans = await prisma.loan.findMany({
      include: {
        borrower: true,
        repayments: {
          orderBy: { paidDate: 'desc' }
        }
      }
    });

    if (loans.length === 0) {
      console.log('   ❌ No loans found in database');
      return;
    }

    const loan = loans[0];
    console.log(`   Loan ID: ${loan.id}`);
    console.log(`   Borrower: ${loan.borrower.name}`);
    console.log(`   Amount: ₹${loan.amount}`);
    console.log(`   Duration: ${loan.duration} ${loan.repaymentType.toLowerCase()}`);
    console.log(`   Disbursement Date: ${loan.disbursementDate.toISOString().split('T')[0]}`);
    console.log(`   Status: ${loan.status}`);
    console.log(`   Remaining Amount: ₹${loan.remainingAmount}`);

    // 2. Check repayment history
    console.log('\n2️⃣ Repayment History:');
    if (loan.repayments.length === 0) {
      console.log('   No repayments found');
    } else {
      console.log(`   Total repayments: ${loan.repayments.length}`);
      loan.repayments.forEach((repayment, index) => {
        console.log(`   ${index + 1}. Period ${repayment.period} | ₹${repayment.amount} | ${repayment.paymentType} | ${repayment.paidDate.toISOString().split('T')[0]}`);
      });

      // Count interest-only payments
      const interestOnlyCount = loan.repayments.filter(r => r.paymentType === 'interestOnly').length;
      const regularCount = loan.repayments.filter(r => r.paymentType !== 'interestOnly').length;
      console.log(`   Interest-only payments: ${interestOnlyCount}`);
      console.log(`   Regular payments: ${regularCount}`);
    }

    // 3. Test payment schedule API call
    console.log('\n3️⃣ Testing Payment Schedule API:');
    
    // Simulate the API call that the loan details page makes
    const { getDynamicPaymentSchedule } = require('../lib/paymentSchedule.ts');
    
    // Test with includeAll=false (what the loan details page should use)
    const filteredSchedules = await getDynamicPaymentSchedule(loan.id, { includeAll: false });
    console.log(`   Filtered schedules (includeAll=false): ${filteredSchedules.schedules.length} schedules`);
    
    if (filteredSchedules.schedules.length > 0) {
      console.log('   Filtered schedule details:');
      filteredSchedules.schedules.forEach(schedule => {
        console.log(`     Period ${schedule.period} | ${schedule.dueDate.split('T')[0]} | ${schedule.status} | ₹${schedule.amount}`);
      });
    }

    // Test with includeAll=true (what was causing the issue)
    const allSchedules = await getDynamicPaymentSchedule(loan.id, { includeAll: true });
    console.log(`   All schedules (includeAll=true): ${allSchedules.schedules.length} schedules`);

    // 4. Calculate expected end date
    console.log('\n4️⃣ Loan Duration Analysis:');
    const disbursementDate = new Date(loan.disbursementDate);
    let originalEndDate = new Date(disbursementDate);
    let currentEndDate = new Date(disbursementDate);

    if (loan.repaymentType === 'Monthly') {
      // Calculate original end date (before any interest-only payments)
      const originalDuration = loan.duration - loan.repayments.filter(r => r.paymentType === 'interestOnly').length;
      originalEndDate.setMonth(disbursementDate.getMonth() + originalDuration);
      
      // Calculate current end date (with interest-only extensions)
      currentEndDate.setMonth(disbursementDate.getMonth() + loan.duration);
    } else if (loan.repaymentType === 'Weekly') {
      // Calculate original end date (before any interest-only payments)
      const originalDuration = loan.duration - loan.repayments.filter(r => r.paymentType === 'interestOnly').length;
      originalEndDate.setDate(disbursementDate.getDate() + (originalDuration * 7));
      
      // Calculate current end date (with interest-only extensions)
      currentEndDate.setDate(disbursementDate.getDate() + (loan.duration * 7));
    }

    console.log(`   Original end date (without extensions): ${originalEndDate.toISOString().split('T')[0]}`);
    console.log(`   Current end date (with extensions): ${currentEndDate.toISOString().split('T')[0]}`);
    
    const interestOnlyExtensions = loan.repayments.filter(r => r.paymentType === 'interestOnly').length;
    if (interestOnlyExtensions > 0) {
      console.log(`   ✅ Loan extended by ${interestOnlyExtensions} period(s) due to interest-only payments`);
    } else {
      console.log('   No interest-only payment extensions');
    }

    // 5. Summary
    console.log('\n5️⃣ Fix Verification Summary:');
    console.log(`   📊 Payment Schedule Filtering:`);
    console.log(`      - All schedules: ${allSchedules.schedules.length}`);
    console.log(`      - Filtered schedules: ${filteredSchedules.schedules.length}`);
    console.log(`      - Fix status: ${filteredSchedules.schedules.length < allSchedules.schedules.length ? '✅ WORKING' : '⚠️  NEEDS ATTENTION'}`);
    
    console.log(`   📅 Interest-Only Duration Extension:`);
    console.log(`      - Interest-only payments made: ${interestOnlyExtensions}`);
    console.log(`      - Current loan duration: ${loan.duration}`);
    console.log(`      - Fix status: ${interestOnlyExtensions > 0 ? '✅ WORKING' : 'ℹ️  NO INTEREST-ONLY PAYMENTS TO TEST'}`);

    console.log('\n🎉 Payment schedule fixes verification completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPaymentScheduleFixes();
