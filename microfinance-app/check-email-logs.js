// Check email logs in database
// Run with: node check-email-logs.js

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkEmailLogs() {
  console.log('📊 Checking Email Logs in Database...\n');

  try {
    // Get all email logs
    const emailLogs = await prisma.emailLog.findMany({
      orderBy: { sentDate: 'desc' },
      take: 10
    });

    if (emailLogs.length === 0) {
      console.log('📭 No email logs found in database');
      console.log('This might indicate that emails are being sent but not logged properly');
    } else {
      console.log(`📧 Found ${emailLogs.length} email log entries:\n`);
      
      emailLogs.forEach((log, index) => {
        const recipients = JSON.parse(log.recipients);
        console.log(`${index + 1}. ${log.emailType.toUpperCase()} Email - ${log.period}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Sent: ${log.sentDate.toLocaleString()}`);
        console.log(`   Recipients: ${recipients.join(', ')}`);
        console.log(`   File: ${log.fileName || 'N/A'}`);
        console.log(`   Recovery: ${log.isRecovery ? 'Yes' : 'No'}`);
        if (log.errorMessage) {
          console.log(`   Error: ${log.errorMessage}`);
        }
        console.log('');
      });
    }

    // Check recent logs (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentLogs = await prisma.emailLog.findMany({
      where: {
        sentDate: {
          gte: yesterday
        }
      },
      orderBy: { sentDate: 'desc' }
    });

    console.log(`📅 Recent emails (last 24 hours): ${recentLogs.length}`);
    
    if (recentLogs.length > 0) {
      recentLogs.forEach(log => {
        const recipients = JSON.parse(log.recipients);
        console.log(`   - ${log.emailType} (${log.period}): ${log.status} to ${recipients.length} recipients`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking email logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkEmailLogs().catch(console.error);
