import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendEmail, emailTemplates } from '../../../../lib/emailConfig';
import * as XLSX from 'xlsx';

// Import the financial data function from dashboard
async function getFinancialDataForExport(userId: number, startDate: Date, endDate: Date, duration: string) {
  // This is a simplified implementation - we'll use the same logic as the dashboard
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
      totalCashOutflow += auction.auctionAmount; // Auction payouts

      // Calculate chit fund profit
      const expectedContribution = chitFund.totalAmount / chitFund.duration;
      if (auction.auctionAmount < expectedContribution) {
        chitFundProfit += (expectedContribution - auction.auctionAmount);
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
    chitFundCashOutflow: chitFunds.reduce((sum, cf) => sum + cf.auctions.reduce((aucSum, auc) => aucSum + auc.auctionAmount, 0), 0),
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

    // Get financial data for the previous month
    const financialData = await getFinancialDataForExport(adminUser.id, startDate, endDate, 'monthly');

    // Generate Excel file
    const excelBuffer = await generateMonthlyExcelReport(financialData, startDate, endDate);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Format month/year for email
    const monthYear = lastMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

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

    const fileName = `Monthly_Report_${lastMonth.getFullYear()}_${String(lastMonth.getMonth() + 1).padStart(2, '0')}.xlsx`;

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

    return NextResponse.json({
      success: true,
      message: `Monthly report for ${monthYear} sent successfully to ${recipients.length} recipient(s)`,
      fileName,
      recipients: recipients.length,
      period: monthYear
    });

  } catch (error) {
    console.error('Error sending scheduled monthly email:', error);
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



// Helper function to generate Excel report
async function generateMonthlyExcelReport(financialData: any, startDate: Date, endDate: Date): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    { 'Metric': 'Total Cash Inflow', 'Value': financialData.totalCashInflow },
    { 'Metric': 'Total Cash Outflow', 'Value': financialData.totalCashOutflow },
    { 'Metric': 'Total Profit', 'Value': financialData.totalProfit },
    { 'Metric': 'Loan Profit', 'Value': financialData.loanProfit },
    { 'Metric': 'Chit Fund Profit', 'Value': financialData.chitFundProfit },
    { 'Metric': 'Outside Amount', 'Value': financialData.outsideAmount },
    { 'Metric': 'Report Period', 'Value': `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}` },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ width: 25 }, { width: 20 }];

  // Apply bold formatting to header row
  const summaryRange = XLSX.utils.decode_range(summarySheet['!ref'] || 'A1:B1');
  for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!summarySheet[cellRef]) continue;
    summarySheet[cellRef].s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Monthly Summary');

  // Detailed Data sheet
  const detailedData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow': period.cashInflow,
    'Cash Outflow': period.cashOutflow,
    'Profit': period.profit,
    'Start Date': new Date(period.periodRange.startDate).toLocaleDateString(),
    'End Date': new Date(period.periodRange.endDate).toLocaleDateString()
  }));
  const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
  detailedSheet['!cols'] = [
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data');

  // Loan Details sheet
  const loanDetailsData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow (Repayments)': period.loanCashInflow || 0,
    'Cash Outflow (Disbursements)': period.loanCashOutflow || 0,
    'Document Charges': period.documentCharges || 0,
    'Interest Profit': period.interestProfit || 0,
    'Total Profit': period.loanProfit,
    'Number of Loans': period.numberOfLoans || 0
  }));
  const loanDetailsSheet = XLSX.utils.json_to_sheet(loanDetailsData);
  loanDetailsSheet['!cols'] = [
    { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, loanDetailsSheet, 'Loan Details');

  // Chit Fund Details sheet
  const chitFundDetailsData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow (Contributions)': period.chitFundCashInflow || 0,
    'Cash Outflow (Auctions)': period.chitFundCashOutflow || 0,
    'Total Profit': period.chitFundProfit,
    'Number of Chit Funds': period.numberOfChitFunds || 0
  }));
  const chitFundDetailsSheet = XLSX.utils.json_to_sheet(chitFundDetailsData);
  chitFundDetailsSheet['!cols'] = [
    { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, chitFundDetailsSheet, 'Chit Fund Details');

  // Generate Excel buffer
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}
