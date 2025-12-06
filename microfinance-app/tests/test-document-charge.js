#!/usr/bin/env node

/**
 * Test script to verify Document Charge implementation
 * This script demonstrates the correct handling of document charges in loan creation
 */

console.log('🧪 Document Charge Implementation Test\n');
console.log('=' .repeat(60));

// Test Case 1: Loan with Document Charge
console.log('\n📋 Test Case 1: Loan with Document Charge');
console.log('-'.repeat(60));

const loanAmount = 30000;
const documentCharge = 1000;
const actualDisbursement = loanAmount - documentCharge;

console.log('Input:');
console.log(`  Loan Amount: ₹${loanAmount.toLocaleString()}`);
console.log(`  Document Charge: ₹${documentCharge.toLocaleString()}`);
console.log(`  Actual Cash Given to Member: ₹${actualDisbursement.toLocaleString()}`);

console.log('\nExpected Transactions Created:');
console.log('  Transaction 1 (LOAN_DISBURSEMENT):');
console.log(`    Type: LOAN_DISBURSEMENT`);
console.log(`    Amount: ₹${actualDisbursement.toLocaleString()}`);
console.log(`    From Partner: Partner1`);
console.log(`    Effect: Partner balance decreases by ₹${actualDisbursement.toLocaleString()}`);

console.log('\n  Transaction 2 (DOCUMENT_CHARGE):');
console.log(`    Type: DOCUMENT_CHARGE`);
console.log(`    Amount: ₹${documentCharge.toLocaleString()}`);
console.log(`    To Partner: Partner1`);
console.log(`    Effect: Partner balance increases by ₹${documentCharge.toLocaleString()}`);

const netChange = -actualDisbursement + documentCharge;
console.log(`\n  Net Partner Balance Change: ₹${netChange.toLocaleString()}`);

// Test Case 2: Loan without Document Charge
console.log('\n\n📋 Test Case 2: Loan without Document Charge');
console.log('-'.repeat(60));

const loanAmount2 = 25000;
const documentCharge2 = 0;

console.log('Input:');
console.log(`  Loan Amount: ₹${loanAmount2.toLocaleString()}`);
console.log(`  Document Charge: ₹${documentCharge2}`);

console.log('\nExpected Transactions Created:');
console.log('  Transaction 1 (LOAN_DISBURSEMENT):');
console.log(`    Type: LOAN_DISBURSEMENT`);
console.log(`    Amount: ₹${loanAmount2.toLocaleString()}`);
console.log(`    From Partner: Partner1`);
console.log(`    Effect: Partner balance decreases by ₹${loanAmount2.toLocaleString()}`);

console.log('\n  Transaction 2 (DOCUMENT_CHARGE):');
console.log(`    NOT CREATED (documentCharge = 0)`);

console.log(`\n  Net Partner Balance Change: ₹${-loanAmount2.toLocaleString()}`);

// Balance Calculation Example
console.log('\n\n💰 Balance Calculation Example');
console.log('-'.repeat(60));

const initialBalance = 100000;
console.log(`Initial Partner Balance: ₹${initialBalance.toLocaleString()}`);

console.log(`\nAfter Loan Disbursement (₹${actualDisbursement.toLocaleString()}):`);
const afterDisbursement = initialBalance - actualDisbursement;
console.log(`  Balance: ₹${afterDisbursement.toLocaleString()}`);

console.log(`\nAfter Document Charge Income (₹${documentCharge.toLocaleString()}):`);
const afterDocCharge = afterDisbursement + documentCharge;
console.log(`  Balance: ₹${afterDocCharge.toLocaleString()}`);

console.log(`\nFinal Partner Balance: ₹${afterDocCharge.toLocaleString()}`);
console.log(`Net Change: ₹${(afterDocCharge - initialBalance).toLocaleString()}`);

// API Request Example
console.log('\n\n🌐 API Request Example');
console.log('-'.repeat(60));

const exampleRequest = {
  borrowerName: "John Doe",
  contact: "9876543210",
  loanType: "Monthly",
  amount: "30000",
  interestRate: "2",
  documentCharge: "1000",
  duration: "12",
  disbursementDate: "2025-12-05",
  repaymentType: "Monthly",
  purpose: "Business"
};

console.log('POST /api/loans/consolidated?action=create');
console.log('Headers: { "x-active-partner": "Partner1" }');
console.log('\nRequest Body:');
console.log(JSON.stringify(exampleRequest, null, 2));

// Verification Checklist
console.log('\n\n✅ Verification Checklist');
console.log('-'.repeat(60));
console.log('After creating a loan, verify:');
console.log('  [ ] Two transactions created (if documentCharge > 0)');
console.log('  [ ] LOAN_DISBURSEMENT amount = loanAmount - documentCharge');
console.log('  [ ] DOCUMENT_CHARGE amount = documentCharge');
console.log('  [ ] Partner balance correctly updated');
console.log('  [ ] Both transactions visible in transaction list');
console.log('  [ ] Can filter by DOCUMENT_CHARGE type');
console.log('  [ ] DOCUMENT_CHARGE shows as "Credit" transaction');
console.log('  [ ] LOAN_DISBURSEMENT shows as "Debit" transaction');

console.log('\n' + '='.repeat(60));
console.log('✅ Test Summary Complete');
console.log('\nTo test in the application:');
console.log('1. Start the application: npm run dev');
console.log('2. Navigate to "New Loan" page');
console.log('3. Create a loan with a document charge');
console.log('4. Check the transaction list for both transactions');
console.log('5. Verify partner balance is correct');
console.log('6. Filter by "DOCUMENT_CHARGE" type to see all doc charges');
console.log('='.repeat(60) + '\n');
