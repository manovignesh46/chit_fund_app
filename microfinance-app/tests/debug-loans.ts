// Debug script to check PaymentSchedule data
// Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' tests/debug-loans.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('🔍 Inspecting Loan and PaymentSchedule Data...');

  try {
    // 1. Check Active Loans
    const activeLoans = await prisma.loan.findMany({
        where: { status: 'Active' },
        take: 5
    });
    console.log(`\nFound ${activeLoans.length} active loans (showing max 5):`);
    activeLoans.forEach(l => console.log(` - ID: ${l.id}, Amount: ${l.amount}, Status: '${l.status}'`));

    if (activeLoans.length === 0) {
        console.log('⚠️ No active loans found. This might be why no dues are showing.');
        // Check if there are ANY loans
        const allLoans = await prisma.loan.findMany({ take: 3 });
        console.log(`Checking any loans: Found ${allLoans.length}. Statuses: ${allLoans.map(l => `'${l.status}'`).join(', ')}`);
        return;
    }

    // 2a. Check if ANY schedules exist in the entire table
    const allSchedulesCount = await prisma.paymentSchedule.count();
    console.log(`\n\n🔎 Total PaymentSchedule records in DB: ${allSchedulesCount}`);

    if (allSchedulesCount > 0) {
        const sampleSchedules = await prisma.paymentSchedule.findMany({ take: 3, include: { loan: true } });
        console.log('Sample Schedules from DB:');
        sampleSchedules.forEach(s => {
             console.log(` - ID: ${s.id}, LoanID: ${s.loanId}, Due: ${s.dueDate}, Status: '${s.status}'`);
        });
    }

    // 2. Check schedules for Loan ID 1
    const loanId = activeLoans[0].id;
    console.log(`\nChecking schedules for Loan ID ${loanId}:`);
    
    const schedules = await prisma.paymentSchedule.findMany({
        where: { loanId: loanId }
    });
    
    console.log(`Found ${schedules.length} schedules.`);
    
    // Check for overdue
    const now = new Date();
    const overdue = schedules.filter(s => new Date(s.dueDate) <= now && s.status !== 'Paid');
    
    console.log(`\nDebug Analysis:`);
    console.log(`- Current Date: ${now.toISOString()}`);
    console.log(`- Total Schedules: ${schedules.length}`);
    console.log(`- Overdue Schedules (JS Filter): ${overdue.length}`);
    
    console.log('\nSample Schedules:');
    schedules.forEach(s => {
        const isDue = new Date(s.dueDate) <= now;
        const isPaid = s.status === 'Paid';
        console.log(` - Schedule ID: ${s.id}, Due: ${s.dueDate.toISOString().split('T')[0]}, Status: '${s.status}', IsDue: ${isDue}, IsPaid: ${isPaid}`);
    });

    // 3. Test the exact query we are using in commonExportUtils (simulated)
    console.log('\nTesting Query Logic:');
    const queryResult = await prisma.paymentSchedule.findMany({
      where: {
        loan: {
          status: 'Active'
        },
        dueDate: {
          lte: now
        },
        status: {
          not: 'Paid'
        }
      }
    });
    console.log(`Query returned ${queryResult.length} records.`);
    if (queryResult.length === 0) {
        console.log('Query matched NOTHING. Let us check case sensitivity or values.');
    } else {
        console.log('Query actually matched items! Why were they not in the report?');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
