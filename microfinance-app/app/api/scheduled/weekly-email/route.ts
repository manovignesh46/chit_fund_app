import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { sendEmail, emailTemplates } from '../../../../lib/emailConfig';
import * as XLSX from 'xlsx';

// Import the financial data function from dashboard
async function getWeeklyFinancialData(userId: number, startDate: Date, endDate: Date) {
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
      totalCashOutflow += auction.auctionAmount;
      
      // Calculate chit fund profit
      const expectedContribution = chitFund.totalAmount / chitFund.duration;
      if (auction.auctionAmount < expectedContribution) {
        chitFundProfit += (expectedContribution - auction.auctionAmount);
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
    chitFundCashOutflow: chitFunds.reduce((sum, cf) => sum + cf.auctions.reduce((aucSum, auc) => aucSum + auc.auctionAmount, 0), 0),
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

    // Get financial data for the previous week
    const financialData = await getWeeklyFinancialData(adminUser.id, lastMonday, lastSunday);

    // Generate Excel file
    const excelBuffer = await generateWeeklyExcelReport(financialData, lastMonday, lastSunday);

    // Get recipients from environment variable
    const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
    const recipients = defaultRecipients 
      ? defaultRecipients.split(',').map(email => email.trim()).filter(email => email)
      : [adminUser.email];

    // Format week range for email
    const weekRange = `${lastMonday.toLocaleDateString()} - ${lastSunday.toLocaleDateString()}`;

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

    const fileName = `Weekly_Report_${lastMonday.getFullYear()}_W${getWeekNumber(lastMonday)}.xlsx`;

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
      message: `Weekly report for ${weekRange} sent successfully to ${recipients.length} recipient(s)`,
      fileName,
      recipients: recipients.length,
      period: weekRange
    });

  } catch (error) {
    console.error('Error sending scheduled weekly email:', error);
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

// Helper function to generate Excel report
async function generateWeeklyExcelReport(financialData: any, startDate: Date, endDate: Date): Promise<Buffer> {
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
    { 'Metric': 'Report Type', 'Value': 'Weekly Summary' },
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
  
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Weekly Summary');

  // Weekly Details sheet
  const weeklyData = [{
    'Period': financialData.weekData.period,
    'Cash Inflow': financialData.weekData.cashInflow,
    'Cash Outflow': financialData.weekData.cashOutflow,
    'Profit': financialData.weekData.profit,
    'Loan Profit': financialData.weekData.loanProfit,
    'Chit Fund Profit': financialData.weekData.chitFundProfit,
    'New Loans': financialData.weekData.numberOfLoans,
    'Active Chit Funds': financialData.weekData.numberOfChitFunds
  }];
  
  const weeklySheet = XLSX.utils.json_to_sheet(weeklyData);
  weeklySheet['!cols'] = [
    { width: 25 }, { width: 15 }, { width: 15 }, { width: 12 }, 
    { width: 15 }, { width: 18 }, { width: 12 }, { width: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Details');

  // Generate Excel buffer
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}
