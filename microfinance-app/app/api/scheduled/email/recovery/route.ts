import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { sendEmail, emailTemplates } from '../../../../../lib/emailConfig';
import * as XLSX from 'xlsx';
import { logEmailSend } from '../../../../../lib/emailRecovery';

// Recovery endpoint for monthly emails
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal request (for security)
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    if (authHeader !== `Bearer ${internalKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { type, period } = body;

    if (type !== 'monthly') {
      return NextResponse.json(
        { error: 'Invalid type. Expected "monthly"' },
        { status: 400 }
      );
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'Invalid period format. Expected YYYY-MM' },
        { status: 400 }
      );
    }

    // Get admin user
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

    // Parse period to get date range
    const { startDate, endDate } = parsePeriodToDateRange(period);

    // Get financial data for the specified period
    const financialData = await getFinancialDataForExport(adminUser.id, startDate, endDate, 'monthly');

    // Generate Excel file
    const excelBuffer = await generateMonthlyExcelReport(financialData, startDate, endDate);

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
      '<p>This is a <strong>recovery email</strong> for your monthly financial report. This email was sent because the original scheduled email was missed due to server downtime or technical issues.</p><p style="background-color: #fef3c7; padding: 10px; border-radius: 5px; border-left: 4px solid #f59e0b;"><strong>Note:</strong> This report covers the period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>'
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

    return NextResponse.json({
      success: true,
      message: `Recovery monthly report for ${monthYear} sent successfully to ${recipients.length} recipient(s)`,
      fileName,
      recipients: recipients.length,
      period: monthYear,
      isRecovery: true
    });

  } catch (error) {
    console.error('Error sending recovery monthly email:', error);

    // Log the failed recovery attempt
    try {
      const body = await request.json();
      const { period } = body;
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

    return NextResponse.json(
      { error: `Failed to send recovery monthly email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Helper functions (copied from main route)
function parsePeriodToDateRange(period: string): { startDate: Date; endDate: Date } {
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

// Import the financial data function from main route
async function getFinancialDataForExport(userId: number, startDate: Date, endDate: Date, duration: string) {
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
