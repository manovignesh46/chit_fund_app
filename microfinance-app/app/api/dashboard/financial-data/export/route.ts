import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate, calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

// Define interfaces for financial data
interface FinancialDataPoint {
  period: string;
  cashInflow: number;
  cashOutflow: number;
  profit: number;
  loanProfit: number;
  chitFundProfit: number;
  outsideAmount: number;
  outsideAmountBreakdown: {
    loanRemainingAmount: number;
    chitFundOutsideAmount: number;
  };
  overdueDetails: {
    totalOverdueAmount: number;
    totalMissedPayments: number;
  };
  cashFlowDetails: {
    contributionInflow: number;
    repaymentInflow: number;
    auctionOutflow: number;
    loanOutflow: number;
    netCashFlow: number;
  };
  profitDetails: {
    interestPayments: number;
    documentCharges: number;
    auctionCommissions: number;
  };
  transactionCounts: {
    loanDisbursements: number;
    loanRepayments: number;
    chitFundContributions: number;
    chitFundAuctions: number;
    totalTransactions: number;
  };
  periodRange: {
    startDate: string;
    endDate: string;
  };
  detailedTransactions?: {
    contributions: any[];
    repayments: any[];
    auctions: any[];
    loans: any[];
  };
}


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let financialData;
    let filename;

    // Handle single period export
    if (duration === 'single') {
      const period = searchParams.get('period');
      const startDateStr = searchParams.get('startDate');
      const endDateStr = searchParams.get('endDate');

      if (!period || !startDateStr || !endDateStr) {
        return NextResponse.json(
          { error: 'Missing required parameters for single period export' },
          { status: 400 }
        );
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Fetch data for the single period
      financialData = await getSinglePeriodData(period, startDate, endDate, currentUserId);
      filename = `financial_details_${period.replace(/\s+/g, '_')}.xlsx`;
    } else {
      // Handle regular duration-based export
      const limit = parseInt(searchParams.get('limit') || '12');
      financialData = await getFinancialDataByDuration(duration, limit, currentUserId);

      // Format current date for filename
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      filename = `financial_data_${duration}_${currentDate}.xlsx`;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create main summary worksheet
    const summaryData = financialData.map(period => {
      // Cast period to any to avoid TypeScript errors
      const periodAny = period as any;
      return {
        'Period': periodAny.period,
        'Date Range': `${formatDate(periodAny.periodRange.startDate)} - ${formatDate(periodAny.periodRange.endDate)}`,
        'Cash Inflow': formatCurrency(periodAny.cashInflow),
        'Cash Outflow': formatCurrency(periodAny.cashOutflow),
        'Net Cash Flow': formatCurrency(periodAny.cashFlowDetails.netCashFlow),
        'Total Profit': formatCurrency(periodAny.profit),
        'Loan Profit': formatCurrency(periodAny.loanProfit),
        'Chit Fund Profit': formatCurrency(periodAny.chitFundProfit),
        'Outside Amount': formatCurrency(periodAny.outsideAmount),
        'Loan Remaining Amount': formatCurrency(periodAny.outsideAmountBreakdown.loanRemainingAmount),
        'Chit Fund Outside Amount': formatCurrency(periodAny.outsideAmountBreakdown.chitFundOutsideAmount),
        'Overdue Amount': formatCurrency(periodAny.overdueDetails?.totalOverdueAmount || 0),
        'Missed Payments': periodAny.overdueDetails?.totalMissedPayments || 0,
        'Total Transactions': periodAny.transactionCounts.totalTransactions
      };
    });

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Financial Summary');

    // Create detailed cash flow worksheet
    const cashFlowData = financialData.map(period => ({
      'Period': period.period,
      'Total Cash Inflow': period.cashInflow,
      'Chit Fund Contributions': period.cashFlowDetails.contributionInflow,
      'Loan Repayments': period.cashFlowDetails.repaymentInflow,
      'Total Cash Outflow': period.cashOutflow,
      'Chit Fund Auctions': period.cashFlowDetails.auctionOutflow,
      'Loan Disbursements': period.cashFlowDetails.loanOutflow,
      'Net Cash Flow': period.cashFlowDetails.netCashFlow
    }));

    const cashFlowWorksheet = XLSX.utils.json_to_sheet(cashFlowData);
    XLSX.utils.book_append_sheet(workbook, cashFlowWorksheet, 'Cash Flow Details');

    // Create profit details worksheet
    const profitData = financialData.map(period => ({
      'Period': period.period,
      'Total Profit': period.profit,
      'Loan Profit': period.loanProfit,
      'Interest Payments': period.profitDetails.interestPayments,
      'Document Charges': period.profitDetails.documentCharges,
      'Chit Fund Profit': period.chitFundProfit,
      'Auction Commissions': period.profitDetails.auctionCommissions
    }));

    const profitWorksheet = XLSX.utils.json_to_sheet(profitData);
    XLSX.utils.book_append_sheet(workbook, profitWorksheet, 'Profit Details');

    // Create transaction counts worksheet
    const transactionData = financialData.map(period => ({
      'Period': period.period,
      'Total Transactions': period.transactionCounts.totalTransactions,
      'Loan Disbursements': period.transactionCounts.loanDisbursements,
      'Loan Repayments': period.transactionCounts.loanRepayments,
      'Chit Fund Contributions': period.transactionCounts.chitFundContributions,
      'Chit Fund Auctions': period.transactionCounts.chitFundAuctions
    }));

    const transactionWorksheet = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.book_append_sheet(workbook, transactionWorksheet, 'Transaction Counts');

    // Create outside amount worksheet
    const outsideData = financialData.map(period => ({
      'Period': period.period,
      'Total Outside Amount': period.outsideAmount,
      'Loan Remaining Amount': period.outsideAmountBreakdown.loanRemainingAmount,
      'Chit Fund Outside Amount': period.outsideAmountBreakdown.chitFundOutsideAmount
    }));

    const outsideWorksheet = XLSX.utils.json_to_sheet(outsideData);
    XLSX.utils.book_append_sheet(workbook, outsideWorksheet, 'Outside Amount Details');

    // Create overdue details worksheet
    const overdueData = financialData.map(period => {
      // Cast period to any to avoid TypeScript errors
      const periodAny = period as any;
      return {
        'Period': periodAny.period,
        'Overdue Amount': periodAny.overdueDetails?.totalOverdueAmount || 0,
        'Missed Payments Count': periodAny.overdueDetails?.totalMissedPayments || 0
      };
    });

    const overdueWorksheet = XLSX.utils.json_to_sheet(overdueData);
    XLSX.utils.book_append_sheet(workbook, overdueWorksheet, 'Overdue Details');

    // Add detailed transaction worksheets if available (for single period exports)
    if (duration === 'single' && (financialData[0] as any)?.detailedTransactions) {
      const { contributions, repayments, auctions, loans } = (financialData[0] as any).detailedTransactions;

      // Add contributions worksheet
      if (contributions && contributions.length > 0) {
        const contributionsWorksheet = XLSX.utils.json_to_sheet(contributions);
        XLSX.utils.book_append_sheet(workbook, contributionsWorksheet, 'Contributions');
      }

      // Add repayments worksheet
      if (repayments && repayments.length > 0) {
        const repaymentsWorksheet = XLSX.utils.json_to_sheet(repayments);
        XLSX.utils.book_append_sheet(workbook, repaymentsWorksheet, 'Repayments');
      }

      // Add auctions worksheet
      if (auctions && auctions.length > 0) {
        const auctionsWorksheet = XLSX.utils.json_to_sheet(auctions);
        XLSX.utils.book_append_sheet(workbook, auctionsWorksheet, 'Auctions');
      }

      // Add loans worksheet
      if (loans && loans.length > 0) {
        const loansWorksheet = XLSX.utils.json_to_sheet(loans);
        XLSX.utils.book_append_sheet(workbook, loansWorksheet, 'Loans');
      }
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Set response headers for file download
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filename}`
      }
    });
  } catch (error) {
    console.error('Error exporting financial data:', error);
    return NextResponse.json(
      { error: 'Failed to export financial data' },
      { status: 500 }
    );
  }
}

// Reuse the same function from the financial-data route
async function getFinancialDataByDuration(duration: string, limit: number, userId: number) {
  // Get current date
  const now = new Date();
  const periods: { label: string; startDate: Date; endDate: Date }[] = [];

  // Use type assertion to handle TypeScript type checking
  const prismaAny = prisma as any;

  // Generate time periods based on duration
  if (duration === 'weekly') {
    // Generate last N weeks
    for (let i = 0; i < limit; i++) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - (i * 7));

      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);

      // Format as "MMM DD - MMM DD" (e.g., "Jan 01 - Jan 07")
      const startMonth = startDate.toLocaleString('en-US', { month: 'short' });
      const endMonth = endDate.toLocaleString('en-US', { month: 'short' });
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();

      const label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;

      periods.unshift({ label, startDate, endDate });
    }
  } else if (duration === 'monthly') {
    // Generate last N months
    for (let i = 0; i < limit; i++) {
      const endDate = new Date(now.getFullYear(), now.getMonth() - i, 0); // Last day of the month
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); // First day of the month

      // Format as "MMM YYYY" (e.g., "Jan 2023")
      const label = startDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      periods.unshift({ label, startDate, endDate });
    }
  } else if (duration === 'yearly') {
    // Generate last N years
    for (let i = 0; i < limit; i++) {
      const year = now.getFullYear() - i;
      const startDate = new Date(year, 0, 1); // January 1st
      const endDate = new Date(year, 11, 31); // December 31st

      // Format as "YYYY" (e.g., "2023")
      const label = year.toString();

      periods.unshift({ label, startDate, endDate });
    }
  }

  // Fetch financial data for each period
  const result = await Promise.all(
    periods.map(async (period) => {
      // Get contributions within this period
      const contributions = await prismaAny.contribution.findMany({
        where: {
          paidDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          chitFund: {
            createdById: userId,
          },
        },
      });

      // Get repayments within this period
      const repayments = await prismaAny.repayment.findMany({
        where: {
          paidDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          loan: {
            createdById: userId,
          },
        },
        include: {
          loan: true,
        },
      });

      // Get auctions within this period
      const auctions = await prismaAny.auction.findMany({
        where: {
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
          chitFund: {
            createdById: userId,
          },
        },
        include: {
          chitFund: true,
        },
      });

      // Get loans disbursed within this period
      const loans = await prismaAny.loan.findMany({
        where: {
          disbursementDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          createdById: userId,
        },
      });

      // Calculate cash inflow (contributions + repayments)
      const contributionInflow = contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
      const repaymentInflow = repayments.reduce((sum: number, repayment: any) => sum + repayment.amount, 0);
      const cashInflow = contributionInflow + repaymentInflow;

      // Calculate cash outflow (auctions + loans)
      const auctionOutflow = auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);
      const loanOutflow = loans.reduce((sum: number, loan: any) => sum + loan.amount, 0);
      const cashOutflow = auctionOutflow + loanOutflow;

      // Calculate profit
      // For loans: interest payments + document charges
      let loanProfit = 0;
      let interestPayments = 0;
      let documentCharges = 0;

      // Group all repayments by loan first
      const allRepaymentsByLoan: Record<number, { loan: any; repayments: any[] }> = {};

      repayments.forEach((repayment: any) => {
        if (repayment.loan) {
          const loanId = repayment.loan.id;
          if (!allRepaymentsByLoan[loanId]) {
            allRepaymentsByLoan[loanId] = {
              loan: repayment.loan,
              repayments: []
            };
          }
          allRepaymentsByLoan[loanId].repayments.push(repayment);
        }
      });

      // Calculate loan profit using the centralized utility function
      Object.values(allRepaymentsByLoan).forEach((loanData: any) => {
        const loan = loanData.loan;
        const loanRepayments = loanData.repayments;

        // Calculate profit for this loan
        const loanProfitAmount = calculateLoanProfit(loan, loanRepayments);
        loanProfit += loanProfitAmount;

        // Calculate interest payments (profit minus document charge)
        const interestPaymentAmount = loanProfitAmount - (loan.documentCharge || 0);
        interestPayments += interestPaymentAmount;

        // Add to document charges total
        documentCharges += (loan.documentCharge || 0);
      });

      // For chit funds: auction profit (commission) using centralized utility function
      let chitFundProfit = 0;
      let auctionCommissions = 0;

      // Group auctions by chit fund
      const auctionsByChitFund: Record<number, { chitFund: any; auctions: any[]; contributions: any[] }> = {};

      // First, collect all auctions by chit fund
      auctions.forEach((auction: any) => {
        if (auction.chitFund) {
          const chitFundId = auction.chitFund.id;
          if (!auctionsByChitFund[chitFundId]) {
            auctionsByChitFund[chitFundId] = {
              chitFund: auction.chitFund,
              auctions: [],
              contributions: []
            };
          }
          auctionsByChitFund[chitFundId].auctions.push(auction);
        }
      });

      // Then, collect all contributions by chit fund
      contributions.forEach((contribution: any) => {
        const chitFundId = contribution.chitFundId;
        if (auctionsByChitFund[chitFundId]) {
          auctionsByChitFund[chitFundId].contributions.push(contribution);
        }
      });

      // Calculate profit for each chit fund using the centralized utility function
      Object.values(auctionsByChitFund).forEach((data) => {
        const profit = calculateChitFundProfit(data.chitFund, data.contributions, data.auctions);
        chitFundProfit += profit;
        auctionCommissions += profit; // All chit fund profit comes from auction commissions
      });

      const totalProfit = loanProfit + chitFundProfit;

      // Count transactions
      const loanDisbursements = loans.length;
      const loanRepayments = repayments.length;
      const chitFundContributions = contributions.length;
      const chitFundAuctions = auctions.length;

      // Calculate outside amount and get loan details including missed payments
      // For loans: remaining balances, overdue amounts, and missed payments
      const activeLoans = await prismaAny.loan.findMany({
        where: {
          createdById: userId,
          status: 'Active',
          createdAt: {
            lte: period.endDate,
          },
        },
        select: {
          remainingAmount: true,
          overdueAmount: true,
          missedPayments: true
        }
      });

      // Calculate total remaining amount, overdue amount, and missed payments
      const loanRemainingAmount = activeLoans.reduce((sum: number, loan: any) => sum + loan.remainingAmount, 0);
      const totalOverdueAmount = activeLoans.reduce((sum: number, loan: any) => sum + (loan.overdueAmount || 0), 0);
      const totalMissedPayments = activeLoans.reduce((sum: number, loan: any) => sum + (loan.missedPayments || 0), 0);

      // For chit funds: outflow exceeding inflow
      const chitFundsWithDetails = await prismaAny.chitFund.findMany({
        where: {
          createdById: userId,
          createdAt: {
            lte: period.endDate,
          },
        },
        include: {
          contributions: {
            where: {
              paidDate: {
                lte: period.endDate,
              },
            },
          },
          auctions: {
            where: {
              date: {
                lte: period.endDate,
              },
            },
          },
        },
      });

      // Calculate outside amount for each chit fund using the centralized utility function
      let chitFundOutsideAmount = 0;

      chitFundsWithDetails.forEach((fund: any) => {
        const outsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);
        chitFundOutsideAmount += outsideAmount;
      });

      const totalOutsideAmount = loanRemainingAmount + chitFundOutsideAmount;

      return {
        period: period.label,
        cashInflow,
        cashOutflow,
        profit: totalProfit,
        loanProfit,
        chitFundProfit,
        outsideAmount: totalOutsideAmount,
        outsideAmountBreakdown: {
          loanRemainingAmount: loanRemainingAmount,
          chitFundOutsideAmount,
        },
        overdueDetails: {
          totalOverdueAmount,
          totalMissedPayments,
        },
        // Additional detailed information
        cashFlowDetails: {
          contributionInflow,
          repaymentInflow,
          auctionOutflow,
          loanOutflow,
          netCashFlow: cashInflow - cashOutflow
        },
        profitDetails: {
          interestPayments,
          documentCharges,
          auctionCommissions
        },
        transactionCounts: {
          loanDisbursements,
          loanRepayments,
          chitFundContributions,
          chitFundAuctions,
          totalTransactions: loanDisbursements + loanRepayments + chitFundContributions + chitFundAuctions
        },
        periodRange: {
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString()
        }
      };
    })
  );

  return result;
}

// Function to get data for a single period
async function getSinglePeriodData(periodLabel: string, startDate: Date, endDate: Date, userId: number) {
  // This function is similar to the period data fetching in getFinancialDataByDuration
  // but for a single specific period with known start and end dates

  // Use type assertion to handle TypeScript type checking
  const prismaAny = prisma as any;

  // Get contributions within this period with detailed information
  const contributions = await prismaAny.contribution.findMany({
    where: {
      paidDate: {
        gte: startDate,
        lte: endDate,
      },
      chitFund: {
        createdById: userId,
      },
    },
    include: {
      chitFund: {
        select: {
          name: true,
          totalAmount: true,
          monthlyContribution: true,
        }
      },
      member: {
        include: {
          globalMember: true
        }
      }
    },
    orderBy: {
      paidDate: 'desc'
    }
  });

  // Get repayments within this period with detailed information
  const repayments = await prismaAny.repayment.findMany({
    where: {
      paidDate: {
        gte: startDate,
        lte: endDate,
      },
      loan: {
        createdById: userId,
      },
    },
    include: {
      loan: {
        include: {
          borrower: true
        }
      },
    },
    orderBy: {
      paidDate: 'desc'
    }
  });

  // Get auctions within this period with detailed information
  const auctions = await prismaAny.auction.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      chitFund: {
        createdById: userId,
      },
    },
    include: {
      chitFund: true,
      winner: {
        include: {
          globalMember: true
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });

  // Get loans disbursed within this period with detailed information
  const loans = await prismaAny.loan.findMany({
    where: {
      disbursementDate: {
        gte: startDate,
        lte: endDate,
      },
      createdById: userId,
    },
    include: {
      borrower: true
    },
    orderBy: {
      disbursementDate: 'desc'
    }
  });

  // Calculate cash inflow (contributions + repayments)
  const contributionInflow = contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
  const repaymentInflow = repayments.reduce((sum: number, repayment: any) => sum + repayment.amount, 0);
  const cashInflow = contributionInflow + repaymentInflow;

  // Calculate cash outflow (auctions + loans)
  const auctionOutflow = auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);
  const loanOutflow = loans.reduce((sum: number, loan: any) => sum + loan.amount, 0);
  const cashOutflow = auctionOutflow + loanOutflow;

  // Calculate profit using centralized utility functions
  let loanProfit = 0;
  let interestPayments = 0;
  let documentCharges = 0;

  // Group all repayments by loan first
  const allRepaymentsByLoan: Record<number, { loan: any; repayments: any[] }> = {};

  repayments.forEach((repayment: any) => {
    if (repayment.loan) {
      const loanId = repayment.loan.id;
      if (!allRepaymentsByLoan[loanId]) {
        allRepaymentsByLoan[loanId] = {
          loan: repayment.loan,
          repayments: []
        };
      }
      allRepaymentsByLoan[loanId].repayments.push(repayment);
    }
  });

  // Calculate profit for each loan using the centralized utility function
  Object.values(allRepaymentsByLoan).forEach((loanData: any) => {
    const loan = loanData.loan;
    const loanRepayments = loanData.repayments;

    // Calculate profit for this loan
    const loanProfitAmount = calculateLoanProfit(loan, loanRepayments);
    loanProfit += loanProfitAmount;

    // Calculate interest payments (profit minus document charge)
    const interestPaymentAmount = loanProfitAmount - (loan.documentCharge || 0);
    interestPayments += interestPaymentAmount;

    // Add to document charges total
    documentCharges += (loan.documentCharge || 0);
  });

  // For chit funds: auction profit (commission) using centralized utility function
  let chitFundProfit = 0;
  let auctionCommissions = 0;

  // Group auctions by chit fund
  const auctionsByChitFund: Record<number, { chitFund: any; auctions: any[]; contributions: any[] }> = {};

  // First, collect all auctions by chit fund
  auctions.forEach((auction: any) => {
    if (auction.chitFund) {
      const chitFundId = auction.chitFund.id;
      if (!auctionsByChitFund[chitFundId]) {
        auctionsByChitFund[chitFundId] = {
          chitFund: auction.chitFund,
          auctions: [],
          contributions: []
        };
      }
      auctionsByChitFund[chitFundId].auctions.push(auction);
    }
  });

  // Then, collect all contributions by chit fund
  contributions.forEach((contribution: any) => {
    const chitFundId = contribution.chitFundId;
    if (auctionsByChitFund[chitFundId]) {
      auctionsByChitFund[chitFundId].contributions.push(contribution);
    }
  });

  // Calculate profit for each chit fund using the centralized utility function
  Object.values(auctionsByChitFund).forEach((data) => {
    const profit = calculateChitFundProfit(data.chitFund, data.contributions, data.auctions);
    chitFundProfit += profit;
    auctionCommissions += profit; // All chit fund profit comes from auction commissions
  });

  const totalProfit = loanProfit + chitFundProfit;

  // Count transactions
  const loanDisbursements = loans.length;
  const loanRepayments = repayments.length;
  const chitFundContributions = contributions.length;
  const chitFundAuctions = auctions.length;

  // Calculate outside amount
  // For loans: remaining balances
  const loanRemainingAmount = await prismaAny.loan.aggregate({
    where: {
      createdById: userId,
      status: 'Active',
      createdAt: {
        lte: endDate,
      },
    },
    _sum: {
      remainingAmount: true,
    },
  });

  // For chit funds: outflow exceeding inflow
  const chitFundsWithDetails = await prismaAny.chitFund.findMany({
    where: {
      createdById: userId,
      createdAt: {
        lte: endDate,
      },
    },
    include: {
      contributions: {
        where: {
          paidDate: {
            lte: endDate,
          },
        },
      },
      auctions: {
        where: {
          date: {
            lte: endDate,
          },
        },
      },
    },
  });

  // Calculate outside amount for each chit fund using the centralized utility function
  let chitFundOutsideAmount = 0;

  chitFundsWithDetails.forEach((fund: any) => {
    const outsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);
    chitFundOutsideAmount += outsideAmount;
  });

  const totalOutsideAmount = (loanRemainingAmount._sum.remainingAmount || 0) + chitFundOutsideAmount;

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Prepare detailed transaction data for export
  const detailedContributions = contributions.map((contribution: any) => ({
    'Chit Fund Name': contribution.chitFund?.name || 'Unknown',
    'Member Name': contribution.member?.globalMember?.name || 'Unknown',
    'Month': contribution.month,
    'Amount': contribution.amount,
    'Paid Date': formatDate(new Date(contribution.paidDate)),
    'Balance': contribution.balance,
    'Balance Payment Status': contribution.balancePaymentStatus || 'N/A',
    'Balance Payment Date': contribution.balancePaymentDate ? formatDate(new Date(contribution.balancePaymentDate)) : 'N/A',
    'Contact': contribution.member?.globalMember?.contact || 'N/A'
  }));

  const detailedRepayments = repayments.map((repayment: any) => {
    // For interest-only payments, show the interest rate instead of the full payment amount
    const paymentAmount = repayment.paymentType === 'interestOnly'
      ? (repayment.loan?.interestRate || repayment.amount)
      : repayment.amount;

    return {
      'Borrower Name': repayment.loan?.borrower?.name || 'Unknown',
      'Loan Amount': repayment.loan?.amount || 0,
      'Payment Amount': paymentAmount,
      'Actual Payment': repayment.amount,
      'Payment Type': repayment.paymentType === 'interestOnly' ? 'Interest Only' : 'Full Payment',
      'Paid Date': formatDate(new Date(repayment.paidDate)),
      'Remaining Amount': repayment.loan?.remainingAmount || 0,
      'Contact': repayment.loan?.borrower?.contact || 'N/A'
    };
  });

  const detailedAuctions = auctions.map((auction: any) => ({
    'Chit Fund Name': auction.chitFund?.name || 'Unknown',
    'Winner Name': auction.winner?.globalMember?.name || 'Unknown',
    'Month': auction.month,
    'Amount': auction.amount,
    'Date': formatDate(new Date(auction.date)),
    'Lowest Bid': auction.lowestBid || 'N/A',
    'Highest Bid': auction.highestBid || 'N/A',
    'Number of Bidders': auction.numberOfBidders || 'N/A',
    'Notes': auction.notes || 'N/A',
    'Contact': auction.winner?.globalMember?.contact || 'N/A'
  }));

  const detailedLoans = loans.map((loan: any) => ({
    'Borrower Name': loan.borrower?.name || 'Unknown',
    'Loan Type': loan.loanType,
    'Amount': loan.amount,
    'Interest Rate': loan.interestRate,
    'Document Charge': loan.documentCharge,
    'Duration': loan.duration,
    'Repayment Type': loan.repaymentType,
    'Disbursement Date': formatDate(new Date(loan.disbursementDate)),
    'Status': loan.status,
    'Remaining Amount': loan.remainingAmount,
    'Contact': loan.borrower?.contact || 'N/A'
  }));

  // Get active loans to calculate overdue amounts
  const activeLoans = await prismaAny.loan.findMany({
    where: {
      createdById: userId,
      status: 'Active',
      createdAt: {
        lte: endDate,
      },
    },
    select: {
      remainingAmount: true,
      overdueAmount: true,
      missedPayments: true
    }
  });

  // Calculate total overdue amount and missed payments
  const totalOverdueAmount = activeLoans.reduce((sum: number, loan: any) => sum + (loan.overdueAmount || 0), 0);
  const totalMissedPayments = activeLoans.reduce((sum: number, loan: any) => sum + (loan.missedPayments || 0), 0);

  // Return a single-item array to maintain compatibility with the existing export code
  return [{
    period: periodLabel,
    cashInflow,
    cashOutflow,
    profit: totalProfit,
    loanProfit,
    chitFundProfit,
    outsideAmount: totalOutsideAmount,
    outsideAmountBreakdown: {
      loanRemainingAmount: loanRemainingAmount._sum?.remainingAmount || 0,
      chitFundOutsideAmount,
    },
    overdueDetails: {
      totalOverdueAmount,
      totalMissedPayments,
    },
    // Additional detailed information
    cashFlowDetails: {
      contributionInflow,
      repaymentInflow,
      auctionOutflow,
      loanOutflow,
      netCashFlow: cashInflow - cashOutflow
    },
    profitDetails: {
      interestPayments,
      documentCharges,
      auctionCommissions
    },
    transactionCounts: {
      loanDisbursements,
      loanRepayments,
      chitFundContributions,
      chitFundAuctions,
      totalTransactions: loanDisbursements + loanRepayments + chitFundContributions + chitFundAuctions
    },
    periodRange: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    // Detailed transaction data
    detailedTransactions: {
      contributions: detailedContributions,
      repayments: detailedRepayments,
      auctions: detailedAuctions,
      loans: detailedLoans
    }
  }];
}
