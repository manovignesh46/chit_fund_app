import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Email log interface
export interface EmailLogEntry {
  emailType: 'monthly' | 'weekly';
  period: string;
  sentDate: Date;
  status: 'sent' | 'failed' | 'recovered';
  recipients: string[];
  fileName?: string;
  isRecovery?: boolean;
  errorMessage?: string;
}

// Function to log email send
export async function logEmailSend(entry: EmailLogEntry): Promise<void> {
  try {
    await prisma.emailLog.upsert({
      where: {
        emailType_period: {
          emailType: entry.emailType,
          period: entry.period
        }
      },
      update: {
        sentDate: entry.sentDate,
        status: entry.status,
        recipients: JSON.stringify(entry.recipients),
        fileName: entry.fileName,
        isRecovery: entry.isRecovery || false,
        errorMessage: entry.errorMessage,
        updatedAt: new Date()
      },
      create: {
        emailType: entry.emailType,
        period: entry.period,
        sentDate: entry.sentDate,
        status: entry.status,
        recipients: JSON.stringify(entry.recipients),
        fileName: entry.fileName,
        isRecovery: entry.isRecovery || false,
        errorMessage: entry.errorMessage
      }
    });

    console.log(`Email log recorded: ${entry.emailType} for period ${entry.period}`);
  } catch (error) {
    console.error('Error logging email send:', error);
  }
}

// Function to get email logs
export async function getEmailLogs(emailType?: 'monthly' | 'weekly', limit: number = 50) {
  try {
    const logs = await prisma.emailLog.findMany({
      where: emailType ? { emailType } : undefined,
      orderBy: { sentDate: 'desc' },
      take: limit
    });

    return logs.map(log => ({
      ...log,
      recipients: JSON.parse(log.recipients)
    }));
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return [];
  }
}

// Function to generate period string for monthly emails
export function getMonthlyPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Function to generate period string for weekly emails
export function getWeeklyPeriod(date: Date): string {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Function to calculate expected monthly email dates
export function getExpectedMonthlyEmailDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const day = parseInt(process.env.AUTO_MONTHLY_EMAIL_DAY || '1', 10);
  const hour = parseInt(process.env.AUTO_MONTHLY_EMAIL_HOUR || '9', 10);
  const timezone = process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata';

  let current = new Date(startDate);
  current.setDate(day);
  current.setHours(hour, 0, 0, 0);

  // If the day has already passed in the start month, move to next month
  if (current < startDate) {
    current.setMonth(current.getMonth() + 1);
  }

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}

// Function to calculate expected weekly email dates
export function getExpectedWeeklyEmailDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const dayOfWeek = parseInt(process.env.AUTO_WEEKLY_EMAIL_DAY || '0', 10);
  const hour = parseInt(process.env.AUTO_WEEKLY_EMAIL_HOUR || '18', 10);

  let current = new Date(startDate);

  // Find the first occurrence of the target day of week
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  current.setHours(hour, 0, 0, 0);

  // If this time has already passed, move to next week
  if (current < startDate) {
    current.setDate(current.getDate() + 7);
  }

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

// Function to find missed monthly emails
export async function findMissedMonthlyEmails(): Promise<string[]> {
  try {
    const isEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      return [];
    }

    // Get the date range to check (last 3 months to current)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    // Get expected email dates
    const expectedDates = getExpectedMonthlyEmailDates(startDate, endDate);

    // Get actual sent emails
    const sentLogs = await prisma.emailLog.findMany({
      where: {
        emailType: 'monthly',
        sentDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const sentPeriods = new Set(sentLogs.map(log => log.period));
    const missedPeriods: string[] = [];

    // Check each expected date
    for (const expectedDate of expectedDates) {
      // Only check dates that are in the past (with 24 hour buffer to account for timezone differences)
      const bufferDate = new Date();
      bufferDate.setHours(bufferDate.getHours() - 24);

      if (expectedDate <= bufferDate) {
        const period = getMonthlyPeriod(expectedDate);
        if (!sentPeriods.has(period)) {
          missedPeriods.push(period);
        }
      }
    }

    return missedPeriods;
  } catch (error) {
    console.error('Error finding missed monthly emails:', error);
    return [];
  }
}

// Function to find missed weekly emails
export async function findMissedWeeklyEmails(): Promise<string[]> {
  try {
    const isEnabled = process.env.AUTO_WEEKLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      return [];
    }

    // Get the date range to check (last 4 weeks to current)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (4 * 7));

    // Get expected email dates
    const expectedDates = getExpectedWeeklyEmailDates(startDate, endDate);

    // Get actual sent emails
    const sentLogs = await prisma.emailLog.findMany({
      where: {
        emailType: 'weekly',
        sentDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const sentPeriods = new Set(sentLogs.map(log => log.period));
    const missedPeriods: string[] = [];

    // Check each expected date
    for (const expectedDate of expectedDates) {
      // Only check dates that are in the past (with 24 hour buffer to account for timezone differences)
      const bufferDate = new Date();
      bufferDate.setHours(bufferDate.getHours() - 24);

      if (expectedDate <= bufferDate) {
        const period = getWeeklyPeriod(expectedDate);
        if (!sentPeriods.has(period)) {
          missedPeriods.push(period);
        }
      }
    }

    return missedPeriods;
  } catch (error) {
    console.error('Error finding missed weekly emails:', error);
    return [];
  }
}

// Find missed DB backups (monthly)
export async function findMissedMonthlyDbBackups(): Promise<string[]> {
  try {
    const isEnabled = process.env.AUTO_MONTHLY_DB_BACKUP_ENABLED === 'true';
    if (!isEnabled) return [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const expectedDates = getExpectedMonthlyEmailDates(startDate, endDate); // Reuse monthly logic
    const sentLogs = await prisma.emailLog.findMany({
      where: {
        emailType: 'monthly',
        fileName: { contains: 'db-backup' },
        sentDate: { gte: startDate, lte: endDate }
      }
    });
    const sentPeriods = new Set(sentLogs.map(log => log.period));
    const missedPeriods: string[] = [];
    for (const expectedDate of expectedDates) {
      const bufferDate = new Date();
      bufferDate.setHours(bufferDate.getHours() - 24);
      if (expectedDate <= bufferDate) {
        const period = getMonthlyPeriod(expectedDate);
        if (!sentPeriods.has(period)) missedPeriods.push(period);
      }
    }
    return missedPeriods;
  } catch (error) {
    console.error('Error finding missed monthly DB backups:', error);
    return [];
  }
}

// Send recovery DB backup for a specific period
export async function sendRecoveryMonthlyDbBackup(period: string): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3001';
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';
    const response = await fetch(`${baseUrl}/api/scheduled/db-backup/recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalKey}`
      },
      body: JSON.stringify({ period })
    });
    if (response.ok) {
      console.log(`Recovered DB backup for ${period}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`Failed to recover DB backup for ${period}:`, error);
      return false;
    }
  } catch (error) {
    console.error('Error sending recovery DB backup:', error);
    return false;
  }
}

// Function to send recovery email for a specific monthly period
export async function sendRecoveryMonthlyEmail(period: string): Promise<boolean> {
  try {
    console.log(`Sending recovery monthly email for period: ${period}`);

    // Import the required functions dynamically to avoid circular dependencies
    const { sendEmail, emailTemplates } = await import('./emailConfig');
    const prisma = (await import('./prisma')).default;
    const XLSX = await import('xlsx');

    // Parse period to get date range
    const { startDate, endDate } = parsePeriodToDateRange(period);

    // Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, name: true, email: true }
    });

    if (!adminUser) {
      console.error('No admin user found for recovery email');
      return false;
    }

    // Get financial data for the specified period
    const financialData = await getFinancialDataForRecovery(adminUser.id, startDate, endDate, 'monthly');

    // Generate Excel file
    const { generateMonthlyExcelReportForRecovery } = await import('./emailRecoveryExcel');
    const excelBuffer = await generateMonthlyExcelReportForRecovery(financialData, startDate, endDate, XLSX);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Format month/year for email
    const monthYear = startDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    // Send recovery email with attachment
    const emailTemplate = emailTemplates.dashboardExport(
      adminUser.name || 'Admin',
      `Recovery Monthly Financial Report`,
      monthYear
    );

    // Customize the email template for recovery emails
    const recoveryEmailSubject = `[RECOVERY] Monthly Financial Report - ${monthYear}`;
    const recoveryEmailHtml = emailTemplate.html.replace(
      '<h2 style="color: #2563eb;">Dashboard Export Report</h2>',
      '<h2 style="color: #f59e0b;">🔄 Recovery Monthly Financial Report</h2>'
    ).replace(
      '<p>Please find attached your requested dashboard export report.</p>',
      `<p>This is a <strong>recovery email</strong> for your monthly financial report. This email was sent because the original scheduled email was missed due to server downtime or technical issues.</p><p style="background-color: #fef3c7; padding: 10px; border-radius: 5px; border-left: 4px solid #f59e0b;"><strong>Note:</strong> This report covers the period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>`
    );

    const fileName = `Recovery_Monthly_Report_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}.xlsx`;

    await sendEmail({
      to: recipients,
      subject: recoveryEmailSubject,
      html: recoveryEmailHtml,
      text: `[RECOVERY] ${emailTemplate.text}`,
      attachments: [{
        filename: fileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    // Log the successful recovery email send
    await logEmailSend({
      emailType: 'monthly',
      period: period,
      sentDate: new Date(),
      status: 'recovered',
      recipients: recipients,
      fileName: fileName,
      isRecovery: true
    });

    console.log(`✅ Recovery monthly email sent successfully for ${period}`);
    return true;

  } catch (error) {
    console.error(`Error sending recovery monthly email for ${period}:`, error);

    // Log the failed recovery attempt
    try {
      const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
      const recipients = defaultRecipients
        ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
        : [];

      await logEmailSend({
        emailType: 'monthly',
        period: period,
        sentDate: new Date(),
        status: 'failed',
        recipients: recipients,
        isRecovery: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Error logging failed recovery email:', logError);
    }

    return false;
  }
}

// Function to send recovery email for a specific weekly period
export async function sendRecoveryWeeklyEmail(period: string): Promise<boolean> {
  try {
    console.log(`Sending recovery weekly email for period: ${period}`);

    // Import the required functions dynamically to avoid circular dependencies
    const { sendEmail, emailTemplates } = await import('./emailConfig');
    const prisma = (await import('./prisma')).default;
    const XLSX = await import('xlsx');

    // Parse period to get date range
    const { startDate, endDate } = parseWeeklyPeriodToDateRange(period);

    // Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, name: true, email: true }
    });

    if (!adminUser) {
      console.error('No admin user found for recovery email');
      return false;
    }

    // Get financial data for the specified week
    const financialData = await getWeeklyFinancialDataForRecovery(adminUser.id, startDate, endDate);

    // Generate Excel file
    const { generateWeeklyExcelReportForRecovery } = await import('./emailRecoveryExcel');
    const excelBuffer = await generateWeeklyExcelReportForRecovery(financialData, startDate, endDate, XLSX);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Format week range for email
    const weekRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

    // Send recovery email with attachment
    const emailTemplate = emailTemplates.dashboardExport(
      adminUser.name || 'Admin',
      `Recovery Weekly Financial Report`,
      weekRange
    );

    // Customize the email template for recovery emails
    const recoveryEmailSubject = `[RECOVERY] Weekly Financial Report - ${weekRange}`;
    const recoveryEmailHtml = emailTemplate.html.replace(
      '<h2 style="color: #2563eb;">Dashboard Export Report</h2>',
      '<h2 style="color: #f59e0b;">🔄 Recovery Weekly Financial Report</h2>'
    ).replace(
      '<p>Please find attached your requested dashboard export report.</p>',
      `<p>This is a <strong>recovery email</strong> for your weekly financial report. This email was sent because the original scheduled email was missed due to server downtime or technical issues.</p><p style="background-color: #fef3c7; padding: 10px; border-radius: 5px; border-left: 4px solid #f59e0b;"><strong>Note:</strong> This report covers the week from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>`
    );

    const fileName = `Recovery_Weekly_Report_${startDate.getFullYear()}_W${getWeekNumberFromDate(startDate)}.xlsx`;

    await sendEmail({
      to: recipients,
      subject: recoveryEmailSubject,
      html: recoveryEmailHtml,
      text: `[RECOVERY] ${emailTemplate.text}`,
      attachments: [{
        filename: fileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    // Log the successful recovery email send
    await logEmailSend({
      emailType: 'weekly',
      period: period,
      sentDate: new Date(),
      status: 'recovered',
      recipients: recipients,
      fileName: fileName,
      isRecovery: true
    });

    console.log(`✅ Recovery weekly email sent successfully for ${period}`);
    return true;

  } catch (error) {
    console.error(`Error sending recovery weekly email for ${period}:`, error);

    // Log the failed recovery attempt
    try {
      const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
      const recipients = defaultRecipients
        ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
        : [];

      await logEmailSend({
        emailType: 'weekly',
        period: period,
        sentDate: new Date(),
        status: 'failed',
        recipients: recipients,
        isRecovery: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Error logging failed recovery weekly email:', logError);
    }

    return false;
  }
}

// Main function to check and send all missed emails
export async function checkAndSendMissedEmails(): Promise<void> {
  try {
    // Check if recovery is enabled
    const recoveryEnabled = process.env.EMAIL_RECOVERY_ENABLED !== 'false'; // Default to true
    if (!recoveryEnabled) {
      console.log('Email recovery is disabled');
      return;
    }

    console.log('Checking for missed emails...');

    // Find missed monthly emails
    const missedMonthly = await findMissedMonthlyEmails();
    if (missedMonthly.length > 0) {
      console.log(`Found ${missedMonthly.length} missed monthly emails:`, missedMonthly);

      for (const period of missedMonthly) {
        const success = await sendRecoveryMonthlyEmail(period);
        if (success) {
          console.log(`✓ Recovered monthly email for ${period}`);
        } else {
          console.log(`✗ Failed to recover monthly email for ${period}`);
        }

        // Add delay between recovery emails to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Find missed weekly emails
    const missedWeekly = await findMissedWeeklyEmails();
    if (missedWeekly.length > 0) {
      console.log(`Found ${missedWeekly.length} missed weekly emails:`, missedWeekly);

      for (const period of missedWeekly) {
        const success = await sendRecoveryWeeklyEmail(period);
        if (success) {
          console.log(`✓ Recovered weekly email for ${period}`);
        } else {
          console.log(`✗ Failed to recover weekly email for ${period}`);
        }

        // Add delay between recovery emails
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (missedMonthly.length === 0 && missedWeekly.length === 0) {
      console.log('No missed emails found');
    }

  } catch (error) {
    console.error('Error checking and sending missed emails:', error);
  }
}

// Extend main recovery to include DB backups
export async function checkAndSendMissedEmailsAndBackups(): Promise<void> {
  await checkAndSendMissedEmails();
  try {
    const missedDbBackups = await findMissedMonthlyDbBackups();
    if (missedDbBackups.length > 0) {
      console.log(`Found ${missedDbBackups.length} missed DB backups:`, missedDbBackups);
      for (const period of missedDbBackups) {
        const success = await sendRecoveryMonthlyDbBackup(period);
        if (success) {
          console.log(`✓ Recovered DB backup for ${period}`);
        } else {
          console.log(`✗ Failed to recover DB backup for ${period}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else {
      console.log('No missed DB backups found');
    }
  } catch (error) {
    console.error('Error checking and sending missed DB backups:', error);
  }
}

// Helper function to parse period string and get date range
function parsePeriodToDateRange(period: string): { startDate: Date; endDate: Date } {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

// Helper function to parse weekly period string and get date range
function parseWeeklyPeriodToDateRange(period: string): { startDate: Date; endDate: Date } {
  const [year, weekStr] = period.split('-W');
  const weekNumber = parseInt(weekStr, 10);

  // Calculate the first day of the year
  const firstDayOfYear = new Date(parseInt(year), 0, 1);

  // Calculate the first Monday of the year
  const firstMonday = new Date(firstDayOfYear);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  firstMonday.setDate(firstDayOfYear.getDate() + daysToFirstMonday);

  // Calculate the start date (Monday) of the specified week
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  startDate.setHours(0, 0, 0, 0);

  // Calculate the end date (Sunday) of the specified week
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

// Helper function to get week number from date
function getWeekNumberFromDate(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Financial data function for recovery (monthly)
async function getFinancialDataForRecovery(userId: number, startDate: Date, endDate: Date, duration: string) {
  const prisma = (await import('./prisma')).default;
  const transactions: any[] = [];

  // Get loans data for the period
  const loans = await prisma.loan.findMany({
    where: {
      createdById: userId,
      disbursementDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      repayments: true,
      borrower: true
    }
  });

  // Get chit funds data for the period
  const chitFunds = await prisma.chitFund.findMany({
    where: {
      createdById: userId,
      startDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      auctions: true,
      contributions: true
    }
  });

  // Calculate financial metrics
  let totalCashInflow = 0;
  let totalCashOutflow = 0;
  let loanProfit = 0;
  let chitFundProfit = 0;

  // Process loans
  loans.forEach(loan => {
    totalCashOutflow += loan.amount; // Loan disbursement

    loan.repayments.forEach(repayment => {
      totalCashInflow += repayment.amount; // Loan repayments

      // Calculate interest profit
      if (loan.loanType === 'Monthly' && repayment.paymentType === 'Regular') {
        const interestAmount = (loan.amount * loan.interestRate / 100) / loan.duration;
        loanProfit += interestAmount;
      }
    });

    // Add document charge to profit
    if (loan.documentCharge) {
      loanProfit += loan.documentCharge;
    }
  });

  // Process chit funds
  chitFunds.forEach(chitFund => {
    chitFund.contributions.forEach(contribution => {
      totalCashInflow += contribution.amount; // Contributions
    });

    chitFund.auctions.forEach(auction => {
      totalCashOutflow += auction.amount; // Auction payouts

      // Calculate chit fund profit
      const expectedContribution = chitFund.totalAmount / chitFund.duration;
      if (auction.amount < expectedContribution) {
        chitFundProfit += (expectedContribution - auction.amount);
      }
    });
  });

  const totalProfit = loanProfit + chitFundProfit;
  const outsideAmount = totalCashInflow - totalCashOutflow;

  const periodsData = [{
    period: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    cashInflow: totalCashInflow,
    cashOutflow: totalCashOutflow,
    profit: totalProfit,
    loanProfit,
    chitFundProfit,
    loanCashInflow: loans.reduce((sum, loan) => sum + loan.repayments.reduce((repSum, rep) => repSum + rep.amount, 0), 0),
    loanCashOutflow: loans.reduce((sum, loan) => sum + loan.amount, 0),
    chitFundCashInflow: chitFunds.reduce((sum, cf) => sum + cf.contributions.reduce((contSum, cont) => contSum + cont.amount, 0), 0),
    chitFundCashOutflow: chitFunds.reduce((sum, cf) => sum + cf.auctions.reduce((aucSum, auc) => aucSum + auc.amount, 0), 0),
    numberOfLoans: loans.length,
    numberOfChitFunds: chitFunds.length,
    documentCharges: loans.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    interestProfit: loanProfit - loans.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    periodRange: { startDate, endDate }
  }];

  return {
    totalCashInflow,
    totalCashOutflow,
    totalProfit,
    loanProfit,
    chitFundProfit,
    outsideAmount,
    transactions,
    periodsData
  };
}

// Financial data function for recovery (weekly)
async function getWeeklyFinancialDataForRecovery(userId: number, startDate: Date, endDate: Date) {
  const prisma = (await import('./prisma')).default;
  const transactions: any[] = [];

  // Get loans data for the week
  const loans = await prisma.loan.findMany({
    where: {
      createdById: userId,
      disbursementDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      repayments: {
        where: {
          paidDate: {
            gte: startDate,
            lte: endDate
          }
        }
      },
      borrower: true
    }
  });

  // Get chit funds data for the week
  const chitFunds = await prisma.chitFund.findMany({
    where: {
      createdById: userId,
      startDate: {
        lte: endDate // Include all active chit funds
      }
    },
    include: {
      auctions: {
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      },
      contributions: {
        where: {
          paidDate: {
            gte: startDate,
            lte: endDate
          }
        }
      }
    }
  });

  // Calculate weekly financial metrics
  let totalCashInflow = 0;
  let totalCashOutflow = 0;
  let loanProfit = 0;
  let chitFundProfit = 0;

  // Process loans for the week
  loans.forEach(loan => {
    // Count disbursements in this week
    if (loan.disbursementDate >= startDate && loan.disbursementDate <= endDate) {
      totalCashOutflow += loan.amount;
    }

    loan.repayments.forEach(repayment => {
      totalCashInflow += repayment.amount;

      // Calculate interest profit for weekly loans
      if (loan.loanType === 'Monthly' && repayment.paymentType === 'Regular') {
        const interestAmount = (loan.amount * loan.interestRate / 100) / loan.duration;
        loanProfit += interestAmount;
      }
    });

    // Add document charge to profit if loan was disbursed this week
    if (loan.disbursementDate >= startDate && loan.disbursementDate <= endDate && loan.documentCharge) {
      loanProfit += loan.documentCharge;
    }
  });

  // Process chit funds for the week
  chitFunds.forEach(chitFund => {
    chitFund.contributions.forEach(contribution => {
      totalCashInflow += contribution.amount;
    });

    chitFund.auctions.forEach(auction => {
      totalCashOutflow += auction.amount;

      // Calculate chit fund profit
      const expectedContribution = chitFund.totalAmount / chitFund.duration;
      if (auction.amount < expectedContribution) {
        chitFundProfit += (expectedContribution - auction.amount);
      }
    });
  });

  const totalProfit = loanProfit + chitFundProfit;
  const outsideAmount = totalCashInflow - totalCashOutflow;

  const weekData = {
    period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    cashInflow: totalCashInflow,
    cashOutflow: totalCashOutflow,
    profit: totalProfit,
    loanProfit,
    chitFundProfit,
    loanCashInflow: loans.reduce((sum, loan) => sum + loan.repayments.reduce((repSum, rep) => repSum + rep.amount, 0), 0),
    loanCashOutflow: loans.filter(loan => loan.disbursementDate >= startDate && loan.disbursementDate <= endDate).reduce((sum, loan) => sum + loan.amount, 0),
    chitFundCashInflow: chitFunds.reduce((sum, cf) => sum + cf.contributions.reduce((contSum, cont) => contSum + cont.amount, 0), 0),
    chitFundCashOutflow: chitFunds.reduce((sum, cf) => sum + cf.auctions.reduce((aucSum, auc) => aucSum + auc.amount, 0), 0),
    numberOfLoans: loans.filter(loan => loan.disbursementDate >= startDate && loan.disbursementDate <= endDate).length,
    numberOfChitFunds: chitFunds.filter(cf => cf.auctions.length > 0).length,
    documentCharges: loans.filter(loan => loan.disbursementDate >= startDate && loan.disbursementDate <= endDate).reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    interestProfit: loanProfit - loans.filter(loan => loan.disbursementDate >= startDate && loan.disbursementDate <= endDate).reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    periodRange: { startDate, endDate }
  };

  return {
    totalCashInflow,
    totalCashOutflow,
    totalProfit,
    loanProfit,
    chitFundProfit,
    outsideAmount,
    transactions,
    weekData
  };
}