// Excel generation functions for email recovery

// Helper function to generate monthly Excel report for recovery
export async function generateMonthlyExcelReportForRecovery(financialData: any, startDate: Date, endDate: Date, XLSX: any): Promise<Buffer> {
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
    { 'Metric': 'Report Type', 'Value': 'Recovery Monthly Report' },
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

// Helper function to generate weekly Excel report for recovery
export async function generateWeeklyExcelReportForRecovery(financialData: any, startDate: Date, endDate: Date, XLSX: any): Promise<Buffer> {
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
    { 'Metric': 'Report Type', 'Value': 'Recovery Weekly Report' },
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
