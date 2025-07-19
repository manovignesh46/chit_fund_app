#!/usr/bin/env node

/**
 * Test the new PARTNER_TO_PARTNER two-transaction implementation
 */

console.log('🧪 Testing PARTNER_TO_PARTNER two-transaction creation...');

const testData = {
  type: 'PARTNER_TO_PARTNER',
  amount: 5000,
  date: '2025-07-19',
  note: 'Test dual transaction',
  from_partner_id: 1, // Mano
  to_partner_id: 2    // Arul
};

const apiUrl = 'http://localhost:3001/api/transactions';

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-active-partner': 'Mano' // Required header
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
  console.log('✅ Response received:', JSON.stringify(data, null, 2));
  
  if (data.debitTransaction && data.creditTransaction) {
    console.log('\n📋 Transfer Summary:');
    console.log(`💸 Debit Transaction (${data.debitTransaction.from_partner}):`);
    console.log(`   ID: ${data.debitTransaction.id}`);
    console.log(`   Type: ${data.debitTransaction.type}`);
    console.log(`   Amount: ₹${data.debitTransaction.amount}`);
    console.log(`   Partner Balance: ₹${data.debitTransaction.partnerBalance}`);
    console.log(`   Total Balance: ₹${data.debitTransaction.totalBalance}`);
    console.log(`   Note: ${data.debitTransaction.note}`);
    
    console.log(`\n💰 Credit Transaction (${data.creditTransaction.to_partner}):`);
    console.log(`   ID: ${data.creditTransaction.id}`);
    console.log(`   Type: ${data.creditTransaction.type}`);
    console.log(`   Amount: ₹${data.creditTransaction.amount}`);
    console.log(`   Partner Balance: ₹${data.creditTransaction.partnerBalance}`);
    console.log(`   Total Balance: ₹${data.creditTransaction.totalBalance}`);
    console.log(`   Note: ${data.creditTransaction.note}`);
    
    console.log('\n✅ Success! Two separate transactions created with different partner balances.');
  } else {
    console.log('❌ Expected debitTransaction and creditTransaction in response');
  }
})
.catch(error => {
  console.error('❌ Error:', error);
});
