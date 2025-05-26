import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendEmail, emailTemplates } from '../../../../lib/emailConfig';
import { logEmailSend, getMonthlyPeriod } from '../../../../lib/emailRecovery';
import { getFinancialDataForExport, generateCommonExcelReport } from '../../../../lib/commonExportUtils';

// Monthly email now uses the common export utilities for consistency

// This endpoint handles automatic monthly email sending
export async function POST(request: NextRequest) {
  try {
    // Check if automatic emails are enabled
    const isEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Automatic monthly emails are disabled' },
        { status: 400 }
      );
    }

    // Verify this is an internal request (for security)
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    if (authHeader !== `Bearer ${internalKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all users (for now, we'll send to the first admin user)
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, name: true, email: true }
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found' },
        { status: 404 }
      );
    }

    // Calculate the previous month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    // Set time boundaries
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get financial data for the previous month using common utility
    const financialData = await getFinancialDataForExport(adminUser.id, startDate, endDate, 'single');

    // Generate Excel file using common utility
    const monthYear = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const excelBuffer = await generateCommonExcelReport(financialData, startDate, endDate, 'Monthly Report', monthYear);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Format filename with current date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const fileName = `Monthly_Report_${lastMonth.getFullYear()}_${String(lastMonth.getMonth() + 1).padStart(2, '0')}_${dateStr}.xlsx`;

    // Send email with attachment
    const emailTemplate = emailTemplates.dashboardExport(
      adminUser.name || 'Admin',
      `Automated Monthly Financial Report`,
      monthYear
    );

    // Customize the email template for scheduled emails
    const scheduledEmailSubject = `[SCHEDULED] Monthly Financial Report - ${monthYear}`;
    const scheduledEmailHtml = emailTemplate.html.replace(
      '<h2 style="color: #2563eb;">Dashboard Export Report</h2>',
      '<h2 style="color: #2563eb;">📅 Automated Monthly Financial Report</h2>'
    ).replace(
      '<p>Please find attached your requested dashboard export report.</p>',
      '<p>This is your <strong>automatically scheduled monthly financial report</strong>. This email is sent automatically on the 1st day of each month to keep you updated with your financial performance.</p>'
    );



    await sendEmail({
      to: recipients,
      subject: scheduledEmailSubject,
      html: scheduledEmailHtml,
      text: `[SCHEDULED] ${emailTemplate.text}`,
      attachments: [{
        filename: fileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    // Log the successful email send
    const period = getMonthlyPeriod(lastMonth);
    await logEmailSend({
      emailType: 'monthly',
      period: period,
      sentDate: new Date(),
      status: 'sent',
      recipients: recipients,
      fileName: fileName,
      isRecovery: false
    });

    return NextResponse.json({
      success: true,
      message: `Monthly report for ${monthYear} sent successfully to ${recipients.length} recipient(s)`,
      fileName,
      recipients: recipients.length,
      period: monthYear
    });

  } catch (error) {
    console.error('Error sending scheduled monthly email:', error);

    // Log the failed email attempt
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const period = getMonthlyPeriod(lastMonth);
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
        isRecovery: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Error logging failed email:', logError);
    }

    return NextResponse.json(
      { error: `Failed to send monthly email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check scheduled email status
export async function GET(request: NextRequest) {
  try {
    const isEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
    const day = parseInt(process.env.AUTO_MONTHLY_EMAIL_DAY || '1', 10);
    const hour = parseInt(process.env.AUTO_MONTHLY_EMAIL_HOUR || '9', 10);
    const timezone = process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata';
    const recipients = process.env.DEFAULT_EMAIL_RECIPIENTS || 'Not configured';

    return NextResponse.json({
      enabled: isEnabled,
      schedule: {
        day,
        hour,
        timezone
      },
      recipients,
      nextRun: calculateNextRun(day, hour, timezone)
    });

  } catch (error) {
    console.error('Error checking scheduled email status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next run time
function calculateNextRun(day: number, hour: number, timezone: string): string {
  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, day, hour, 0, 0);

    return nextMonth.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (error) {
    return 'Unable to calculate';
  }
}



// Monthly email now uses the common Excel generation utility for consistency

// Helper function to parse period string and get date range
function parsePeriodToDateRange(period: string): { startDate: Date; endDate: Date } {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}
