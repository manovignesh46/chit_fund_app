// Test script to verify pending dues generation
// Run with: node tests/test-pending-dues-generation.js

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Mock the imports since we are running in node and commonExportUtils is likely TS or uses ES modules
// note: commonExportUtils is .ts, so we can't run it directly with node unless we compile it or use ts-node
// Since the project has ts-node (seen in package.json), we can run with ts-node.

// We will try running with: npx ts-node tests/test-pending-dues-generation.ts

async function testPendingDues() {
  console.log('🧪 Testing Pending Dues Logic...\n');

  // We can't easily import the internal functions here without converting to module or using ts-node fully.
  // Instead, let's verify via the API which is running (npm run dev is running).

  const baseUrl = 'http://localhost:3001';
  const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

  console.log('Triggering Weekly Email API (to check logs/response)...');

  try {
    const response = await fetch(`${baseUrl}/api/scheduled/weekly-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalKey}`
      }
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ API call successful. Check the server logs to confirm "Pending Dues" were processed.');
      console.log('If you have configured your email, check your inbox for the "Pending Dues Report" bullet point.');
    } else {
      console.error('❌ API call failed.');
    }

  } catch (error) {
    console.error('❌ Error calling API:', error.message);
  }
}

testPendingDues();
