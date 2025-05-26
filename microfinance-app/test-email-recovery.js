// Test script for email recovery functionality
// Run with: node test-email-recovery.js

const { 
  findMissedMonthlyEmails, 
  findMissedWeeklyEmails,
  getMonthlyPeriod,
  getWeeklyPeriod,
  getExpectedMonthlyEmailDates,
  getExpectedWeeklyEmailDates
} = require('./lib/emailRecovery');

async function testEmailRecovery() {
  console.log('🧪 Testing Email Recovery System...\n');

  try {
    // Test period generation
    console.log('📅 Testing Period Generation:');
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthlyPeriod = getMonthlyPeriod(lastMonth);
    const weeklyPeriod = getWeeklyPeriod(now);
    
    console.log(`Monthly period for last month: ${monthlyPeriod}`);
    console.log(`Weekly period for this week: ${weeklyPeriod}\n`);

    // Test expected dates calculation
    console.log('📊 Testing Expected Dates Calculation:');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // 3 months ago
    const endDate = new Date();
    
    const expectedMonthlyDates = getExpectedMonthlyEmailDates(startDate, endDate);
    const expectedWeeklyDates = getExpectedWeeklyEmailDates(startDate, endDate);
    
    console.log(`Expected monthly emails (last 3 months): ${expectedMonthlyDates.length}`);
    expectedMonthlyDates.forEach(date => {
      console.log(`  - ${date.toLocaleDateString()} (${getMonthlyPeriod(date)})`);
    });
    
    console.log(`\nExpected weekly emails (last 3 months): ${expectedWeeklyDates.length}`);
    expectedWeeklyDates.slice(-5).forEach(date => { // Show last 5
      console.log(`  - ${date.toLocaleDateString()} (${getWeeklyPeriod(date)})`);
    });

    // Test missed email detection
    console.log('\n🔍 Testing Missed Email Detection:');
    const missedMonthly = await findMissedMonthlyEmails();
    const missedWeekly = await findMissedWeeklyEmails();
    
    console.log(`Missed monthly emails: ${missedMonthly.length}`);
    missedMonthly.forEach(period => {
      console.log(`  - ${period}`);
    });
    
    console.log(`Missed weekly emails: ${missedWeekly.length}`);
    missedWeekly.forEach(period => {
      console.log(`  - ${period}`);
    });

    if (missedMonthly.length === 0 && missedWeekly.length === 0) {
      console.log('✅ No missed emails found - system is working correctly!');
    } else {
      console.log('⚠️  Found missed emails - recovery system would trigger');
    }

    console.log('\n✅ Email Recovery System Test Completed Successfully!');

  } catch (error) {
    console.error('❌ Error testing email recovery system:', error);
  }
}

// Run the test
testEmailRecovery();
