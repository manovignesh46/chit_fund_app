// Script to manually trigger the Monthly/Weekly Financial Report email
// Includes "Pending Dues" sheet.
// Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/trigger-manual-report.js

// Usage: 
// npx ts-node scripts/trigger-manual-report.js [weekly|monthly]

import { getFinancialDataForExport, generateCommonExcelReport } from '../lib/commonExportUtils';
import { sendEmail, emailTemplates } from '../lib/emailConfig';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();
const prisma = new PrismaClient();

async function run() {
  const reportType = process.argv[2] || 'monthly'; // default to monthly
  console.log(`🚀 Starting Manual ${reportType.toUpperCase()} Report Trigger...`);

  try {
    // 1. Get Admin User
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (!adminUser) {
      console.error('❌ No admin user found.');
      return;
    }

    // 2. Determine Date Range
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (reportType === 'weekly') {
      // Last full week (Mon-Sun)
      const currentDay = now.getDay(); // 0=Sun
      const daysToLastSunday = currentDay === 0 ? 7 : currentDay;
      endDate = new Date(now);
      endDate.setDate(now.getDate() - daysToLastSunday);
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Last full month
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);

      // If running in same month (e.g. testing), maybe just default to "Last 30 Days" if valid month logic isn't desired?
      // But user asked for "Monthly" email logic.
      // Let's stick to strict last month for consistency with the automated job.
    }

    console.log(`📅 Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);

    // 3. Fetch Data
    console.log('📊 Fetching financial data (including pending dues)...');
    const financialData = await getFinancialDataForExport(adminUser.id, startDate, endDate, 'single');

    console.log(`   - Found ${financialData.pendingDues?.length || 0} pending dues items.`);

    // 4. Generate Excel
    console.log('metrics: ', financialData.pendingDues);
    console.log('📑 Generating Excel report...');
    const periodLabel = reportType === 'weekly' ? 'Weekly Report' : 'Monthly Report';
    const excelBuffer = await generateCommonExcelReport(financialData, startDate, endDate, periodLabel, 'Custom Range');

    // 5. Send Email
    const recipients = process.env.DEFAULT_EMAIL_RECIPIENTS
      ? process.env.DEFAULT_EMAIL_RECIPIENTS.split(',')
      : [adminUser.email];

    console.log(`📧 Sending email to: ${recipients.join(', ')}`);

    const today = new Date().toISOString().split('T')[0];
    const fileName = `Manual_${periodLabel}_${today}.xlsx`;

    // Send email with attachment
    const emailTemplate = emailTemplates.dashboardExport(
      adminUser.name || 'Admin',
      `[MANUAL] ${periodLabel}`,
      `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
    );

    await sendEmail({
      to: recipients,
      subject: `[MANUAL TEST] ${periodLabel} with Pending Dues`,
      html: emailTemplate.html.replace('Dashboard Export Report', `${periodLabel} (Manual Trigger)`),
      text: emailTemplate.text,
      attachments: [{
        filename: fileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    console.log('✅ Email sent successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
