import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendEmail, emailTemplates } from '../../../../lib/emailConfig';
import { logEmailSend, getWeeklyPeriod } from '../../../../lib/emailRecovery';
import { getFinancialDataForExport, generateCommonExcelReport } from '../../../../lib/commonExportUtils';

// Weekly email now uses the common export utilities for consistency

// This endpoint handles automatic weekly email sending
export async function POST(request: NextRequest) {
  try {
    // Check if automatic weekly emails are enabled
    const isEnabled = process.env.AUTO_WEEKLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Automatic weekly emails are disabled' },
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

    // Calculate the previous week's date range (Monday to Sunday)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToLastSunday = currentDay === 0 ? 7 : currentDay;

    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - daysToLastSunday);
    lastSunday.setHours(23, 59, 59, 999);

    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    lastMonday.setHours(0, 0, 0, 0);

    // Get financial data for the previous week using common utility
    const financialData = await getFinancialDataForExport(adminUser.id, lastMonday, lastSunday, 'single');

    // Generate Excel file using common utility
    const weekRange = `${lastMonday.toLocaleDateString()} - ${lastSunday.toLocaleDateString()}`;
    const excelBuffer = await generateCommonExcelReport(financialData, lastMonday, lastSunday, 'Weekly Report', weekRange);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Send email with attachment
    const emailTemplate = emailTemplates.dashboardExport(
      adminUser.name || 'Admin',
      `Automated Weekly Financial Report`,
      weekRange
    );

    // Customize the email template for weekly scheduled emails
    const scheduledEmailSubject = `[SCHEDULED] Weekly Financial Report - ${weekRange}`;
    const scheduledEmailHtml = emailTemplate.html.replace(
      '<h2 style="color: #2563eb;">Dashboard Export Report</h2>',
      '<h2 style="color: #2563eb;">📊 Automated Weekly Financial Report</h2>'
    ).replace(
      '<p>Please find attached your requested dashboard export report.</p>',
      '<p>This is your <strong>automatically scheduled weekly financial report</strong>. This email is sent automatically every Sunday evening to keep you updated with your weekly financial performance.</p>'
    );

    // Format filename with current date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const fileName = `Weekly_Report_${lastMonday.getFullYear()}_W${getWeekNumber(lastMonday)}_${dateStr}.xlsx`;

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
    const period = getWeeklyPeriod(lastMonday);
    await logEmailSend({
      emailType: 'weekly',
      period: period,
      sentDate: new Date(),
      status: 'sent',
      recipients: recipients,
      fileName: fileName,
      isRecovery: false
    });

    return NextResponse.json({
      success: true,
      message: `Weekly report for ${weekRange} sent successfully to ${recipients.length} recipient(s)`,
      fileName,
      recipients: recipients.length,
      period: weekRange
    });

  } catch (error) {
    console.error('Error sending scheduled weekly email:', error);

    // Log the failed email attempt
    try {
      const now = new Date();
      const currentDay = now.getDay();
      const daysToLastSunday = currentDay === 0 ? 7 : currentDay;
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - daysToLastSunday);
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);

      const period = getWeeklyPeriod(lastMonday);
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
        isRecovery: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Error logging failed weekly email:', logError);
    }

    return NextResponse.json(
      { error: `Failed to send weekly email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Weekly email now uses the common Excel generation utility for consistency
