// Common export utilities for consistent file generation across all exports
// This ensures dashboard exports and email exports use the same format

import * as XLSX from 'xlsx';
import prisma from './prisma';
import { calculateTotalLoanProfit, calculateTotalChitFundProfitUpToCurrentMonth } from './financialUtils';
import { calculatePeriodFinancialMetrics, createPeriodRange } from './centralizedFinancialCalculations';

// Helper function to format date consistently
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Common function to get financial data for export (used by both dashboard and email exports)
export async function getFinancialDataForExport(userId: number, startDate: Date, endDate: Date, duration: string) {
  // Get all financial data for the period
  const [
    // Get contributions in the date range
    contributions,
    // Get repayments in the date range
    repayments,
    // Get auctions in the date range
    auctions,
    // Get loans disbursed in the date range
    loans,
    // Get all loans with repayments for profit calculation
    loansWithRepayments,
    // Get all chit funds with contributions and auctions for profit calculation
    chitFundsWithDetails
  ] = await Promise.all([
    // Get contributions
    prisma.contribution.findMany({
      where: {
        chitFund: {
          createdById: userId
        },
        paidDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        paidDate: true,
        month: true,
        chitFund: {
          select: {
            name: true
          }
        },
        member: {
          select: {
            globalMember: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        paidDate: 'asc'
      }
    }),

    // Get repayments
    prisma.repayment.findMany({
      where: {
        loan: {
          createdById: userId
        },
        paidDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        paidDate: true,
        period: true,
        paymentType: true,
        loan: {
          select: {
            id: true,
            borrower: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        paidDate: 'asc'
      }
    }),

    // Get auctions
    prisma.auction.findMany({
      where: {
        chitFund: {
          createdById: userId
        },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        date: true,
        month: true,
        chitFund: {
          select: {
            name: true
          }
        },
        winner: {
          select: {
            globalMember: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    }),

    // Get loans
    prisma.loan.findMany({
      where: {
        createdById: userId,
        disbursementDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        documentCharge: true,
        disbursementDate: true,
        borrower: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        disbursementDate: 'asc'
      }
    }),

    // Get all loans with their repayments for profit calculation
    prisma.loan.findMany({
      where: {
        createdById: userId,
        OR: [
          {
            disbursementDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            repayments: {
              some: {
                paidDate: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        ]
      },
      select: {
        id: true,
        amount: true,
        interestRate: true,
        documentCharge: true,
        repaymentType: true,
        disbursementDate: true,
        repayments: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            paidDate: true,
            period: true
          }
        }
      }
    }),

    // Get all chit funds with their contributions and auctions for profit calculation
    prisma.chitFund.findMany({
      where: {
        createdById: userId,
        OR: [
          {
            contributions: {
              some: {
                paidDate: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          },
          {
            auctions: {
              some: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        ]
      },
      include: {
        members: true,
        contributions: {
          select: {
            id: true,
            amount: true,
            month: true,
            paidDate: true
          }
        },
        auctions: {
          select: {
            id: true,
            amount: true,
            month: true,
            date: true
          }
        }
      }
    })
  ]);

  // Calculate totals
  const totalCashInflow = contributions.reduce((sum, c) => sum + c.amount, 0) +
                         repayments.reduce((sum, r) => sum + r.amount, 0);

  const totalCashOutflow = auctions.reduce((sum, a) => sum + a.amount, 0) +
                          loans.reduce((sum, l) => sum + l.amount, 0);

  // Calculate profits using centralized utility functions
  const loanProfit = calculateTotalLoanProfit(loansWithRepayments);
  const chitFundProfit = calculateTotalChitFundProfitUpToCurrentMonth(chitFundsWithDetails as any);
  const totalProfit = loanProfit + chitFundProfit;

  // Calculate outside amount
  const outsideAmount = totalCashOutflow > totalCashInflow ? totalCashOutflow - totalCashInflow : 0;

  // Create transactions array for detailed sheets
  const transactions: any[] = [];

  // Add loan transactions
  loans.forEach(loan => {
    transactions.push({
      date: loan.disbursementDate,
      type: 'Loan Disbursement',
      category: 'Loan',
      description: `Loan disbursed to ${loan.borrower?.name || 'Unknown'}`,
      amount: loan.amount,
      borrowerName: loan.borrower?.name,
      loanAmount: loan.amount,
      installmentAmount: 'N/A'
    });
  });

  repayments.forEach(repayment => {
    transactions.push({
      date: repayment.paidDate,
      type: 'Loan Repayment',
      category: 'Loan',
      description: `Loan repayment from ${repayment.loan?.borrower?.name || 'Unknown'} (Period ${repayment.period})`,
      amount: repayment.amount,
      borrowerName: repayment.loan?.borrower?.name,
      loanAmount: 'N/A',
      installmentAmount: repayment.amount
    });
  });

  // Add chit fund transactions
  contributions.forEach(contribution => {
    const memberName = contribution.member?.globalMember?.name || 'Unknown';
    transactions.push({
      date: contribution.paidDate,
      type: 'Contribution',
      category: 'Chit Fund',
      description: `Contribution from ${memberName} to ${contribution.chitFund?.name || 'Unknown'} (Month ${contribution.month})`,
      amount: contribution.amount
    });
  });

  auctions.forEach(auction => {
    const winnerName = auction.winner?.globalMember?.name || 'Unknown';
    transactions.push({
      date: auction.date,
      type: 'Auction',
      category: 'Chit Fund',
      description: `Auction won by ${winnerName} in ${auction.chitFund?.name || 'Unknown'} (Month ${auction.month})`,
      amount: auction.amount
    });
  });

  // Sort transactions by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // For single period, create one period data entry
  const periodLabel = duration === 'single' ? 'Custom Period' :
                     duration === 'monthly' ? startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                     duration === 'weekly' ? `Week of ${formatDate(startDate)}` : 'Period';

  // Calculate period-specific data using centralized calculations
  const periodRange = createPeriodRange(startDate, endDate);
  const periodMetrics = calculatePeriodFinancialMetrics(
    loansWithRepayments,
    chitFundsWithDetails as any,
    loans.map(l => ({ id: l.id, amount: l.amount, documentCharge: l.documentCharge })),
    periodRange
  );

  const periodsData = [{
    period: periodLabel,
    cashInflow: totalCashInflow,
    cashOutflow: totalCashOutflow,
    profit: totalProfit,
    loanProfit: loanProfit,
    chitFundProfit: chitFundProfit,
    outsideAmount: outsideAmount,
    // Loan-specific data
    loanCashInflow: repayments.reduce((sum, r) => sum + r.amount, 0),
    loanCashOutflow: loans.reduce((sum, l) => sum + l.amount, 0),
    documentCharges: periodMetrics.documentCharges,
    interestProfit: periodMetrics.interestPayments,
    numberOfLoans: loans.length,
    // Chit fund-specific data
    chitFundCashInflow: contributions.reduce((sum, c) => sum + c.amount, 0),
    chitFundCashOutflow: auctions.reduce((sum, a) => sum + a.amount, 0),
    numberOfChitFunds: chitFundsWithDetails.length,
    periodRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
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

// Common function to generate Excel file (used by both dashboard and email exports)
export async function generateCommonExcelReport(
  financialData: any,
  startDate: Date,
  endDate: Date,
  reportType: string = 'Financial Report',
  period?: string
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Create a summary sheet
  const summaryData = [
    {
      'Period': period || reportType,
      'Date Range': `${formatDate(startDate)} to ${formatDate(endDate)}`,
      'Total Cash Inflow': financialData.totalCashInflow,
      'Total Cash Outflow': financialData.totalCashOutflow,
      'Total Profit': financialData.totalProfit,
      'Loan Profit': financialData.loanProfit,
      'Chit Fund Profit': financialData.chitFundProfit,
      'Outside Amount': financialData.outsideAmount
    }
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);

  // Define column widths for summary sheet
  summarySheet['!cols'] = [
    { width: 20 }, // Period
    { width: 30 }, // Date Range
    { width: 18 }, // Total Cash Inflow
    { width: 18 }, // Total Cash Outflow
    { width: 15 }, // Total Profit
    { width: 15 }, // Loan Profit
    { width: 18 }, // Chit Fund Profit
    { width: 15 }  // Outside Amount
  ];

  // Apply bold formatting to header row
  const summaryRange = XLSX.utils.decode_range(summarySheet['!ref'] || 'A1:H1');
  for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!summarySheet[cellRef]) continue;
    summarySheet[cellRef].s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Create a detailed data sheet
  const detailedData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow': period.cashInflow,
    'Cash Outflow': period.cashOutflow,
    'Profit': period.profit,
    'Start Date': new Date(period.periodRange.startDate).toLocaleDateString(),
    'End Date': new Date(period.periodRange.endDate).toLocaleDateString()
  }));
  const detailedSheet = XLSX.utils.json_to_sheet(detailedData);

  // Define column widths for detailed sheet
  detailedSheet['!cols'] = [
    { width: 15 }, // Period
    { width: 15 }, // Cash Inflow
    { width: 15 }, // Cash Outflow
    { width: 12 }, // Profit
    { width: 15 }, // Start Date
    { width: 15 }  // End Date
  ];

  // Apply bold formatting to header row
  const detailedRange = XLSX.utils.decode_range(detailedSheet['!ref'] || 'A1:F1');
  for (let col = detailedRange.s.c; col <= detailedRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!detailedSheet[cellRef]) continue;
    detailedSheet[cellRef].s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data');

  // Create loan details sheet
  const loanDetailsData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow (Repayments)': period.loanCashInflow || 0,
    'Cash Outflow (Disbursements)': period.loanCashOutflow || 0,
    'Document Charges': period.documentCharges || 0,
    'Interest Profit': period.interestProfit || 0,
    'Total Profit': period.loanProfit,
    'Number of Loans': period.numberOfLoans || 0,
    'Start Date': new Date(period.periodRange.startDate).toLocaleDateString(),
    'End Date': new Date(period.periodRange.endDate).toLocaleDateString()
  }));
  const loanDetailsSheet = XLSX.utils.json_to_sheet(loanDetailsData);

  // Define column widths for loan details sheet
  loanDetailsSheet['!cols'] = [
    { width: 15 }, // Period
    { width: 20 }, // Cash Inflow (Repayments)
    { width: 22 }, // Cash Outflow (Disbursements)
    { width: 18 }, // Document Charges
    { width: 16 }, // Interest Profit
    { width: 14 }, // Total Profit
    { width: 18 }, // Number of Loans
    { width: 15 }, // Start Date
    { width: 15 }  // End Date
  ];

  // Apply bold formatting to header row
  const loanDetailsRange = XLSX.utils.decode_range(loanDetailsSheet['!ref'] || 'A1:I1');
  for (let col = loanDetailsRange.s.c; col <= loanDetailsRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!loanDetailsSheet[cellRef]) continue;
    loanDetailsSheet[cellRef].s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, loanDetailsSheet, 'Loan Details');

  // Create chit fund details sheet
  const chitFundDetailsData = financialData.periodsData.map((period: any) => ({
    'Period': period.period,
    'Cash Inflow (Contributions)': period.chitFundCashInflow || 0,
    'Cash Outflow (Auctions)': period.chitFundCashOutflow || 0,
    'Total Profit': period.chitFundProfit,
    'Number of Chit Funds': period.numberOfChitFunds || 0,
    'Start Date': new Date(period.periodRange.startDate).toLocaleDateString(),
    'End Date': new Date(period.periodRange.endDate).toLocaleDateString()
  }));
  const chitFundDetailsSheet = XLSX.utils.json_to_sheet(chitFundDetailsData);

  // Define column widths for chit fund details sheet
  chitFundDetailsSheet['!cols'] = [
    { width: 15 }, // Period
    { width: 22 }, // Cash Inflow (Contributions)
    { width: 20 }, // Cash Outflow (Auctions)
    { width: 15 }, // Total Profit
    { width: 18 }, // Number of Chit Funds
    { width: 15 }, // Start Date
    { width: 15 }  // End Date
  ];

  // Apply bold formatting to header row
  const chitFundDetailsRange = XLSX.utils.decode_range(chitFundDetailsSheet['!ref'] || 'A1:G1');
  for (let col = chitFundDetailsRange.s.c; col <= chitFundDetailsRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!chitFundDetailsSheet[cellRef]) continue;
    chitFundDetailsSheet[cellRef].s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, chitFundDetailsSheet, 'Chit Fund Details');

  // Create separate transaction sheets for loans and chit funds
  // Filter transactions for loans
  const loanTransactionsData = financialData.transactions
    .filter((transaction: any) => transaction.category === 'Loan')
    .map((transaction: any) => ({
      'Date': formatDate(transaction.date),
      'Type': transaction.type,
      'Borrower Name': transaction.borrowerName || 'Unknown',
      'Loan Amount': transaction.loanAmount || 'N/A',
      'Installment Amount': transaction.installmentAmount || 'N/A',
      'Description': transaction.description,
      'Amount': transaction.amount
    }));
  const loanTransactionsSheet = XLSX.utils.json_to_sheet(loanTransactionsData);

  // Define column widths for loan transactions sheet
  loanTransactionsSheet['!cols'] = [
    { width: 20 }, // Date
    { width: 15 }, // Type
    { width: 25 }, // Borrower Name
    { width: 15 }, // Loan Amount
    { width: 15 }, // Installment Amount
    { width: 40 }, // Description
    { width: 15 }  // Amount
  ];

  // Apply bold formatting to header row
  if (loanTransactionsData.length > 0) {
    const loanRange = XLSX.utils.decode_range(loanTransactionsSheet['!ref'] || 'A1:G1');
    for (let col = loanRange.s.c; col <= loanRange.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!loanTransactionsSheet[cellRef]) continue;
      loanTransactionsSheet[cellRef].s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, loanTransactionsSheet, 'Loan Transactions');

  // Filter transactions for chit funds
  const chitFundTransactionsData = financialData.transactions
    .filter((transaction: any) => transaction.category === 'Chit Fund')
    .map((transaction: any) => ({
      'Date': formatDate(transaction.date),
      'Type': transaction.type,
      'Description': transaction.description,
      'Amount': transaction.amount
    }));
  const chitFundTransactionsSheet = XLSX.utils.json_to_sheet(chitFundTransactionsData);

  // Define column widths for chit fund transactions sheet
  chitFundTransactionsSheet['!cols'] = [
    { width: 20 }, // Date
    { width: 15 }, // Type
    { width: 40 }, // Description
    { width: 15 }  // Amount
  ];

  // Apply bold formatting to header row
  if (chitFundTransactionsData.length > 0) {
    const chitFundRange = XLSX.utils.decode_range(chitFundTransactionsSheet['!ref'] || 'A1:D1');
    for (let col = chitFundRange.s.c; col <= chitFundRange.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!chitFundTransactionsSheet[cellRef]) continue;
      chitFundTransactionsSheet[cellRef].s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, chitFundTransactionsSheet, 'Chit Fund Transactions');

  // Generate Excel buffer
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}
