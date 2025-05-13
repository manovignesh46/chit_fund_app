import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';
import * as XLSX from 'xlsx';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'summary':
        return await getSummary(request, currentUserId);
      case 'activities':
        return await getActivities(request, currentUserId);
      case 'events':
        return await getUpcomingEvents(request, currentUserId);
      case 'financial-data':
        return await getFinancialData(request, currentUserId);
      case 'export':
        return await exportFinancialData(request, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

// Handler for dashboard summary
async function getSummary(request: NextRequest, currentUserId: number) {
  try {
    console.time('getSummary'); // Add timing for performance monitoring
    console.log('Fetching dashboard data...');

    // Get all aggregations in parallel for better performance
    const [
      contributionsSum,
      repaymentsSum,
      auctionsSum,
      loansSum,
      activeChitFunds,
      totalMembers,
      activeLoans,
      // Optimize loan query to only fetch what's needed
      loansWithRepayments,
      // Optimize chit fund query to only fetch what's needed
      chitFundsWithData
    ] = await Promise.all([
      // Get total cash inflow from chit fund contributions
      prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { chitFund: { createdById: currentUserId } }
      }),

      // Get total cash inflow from loan repayments
      prisma.repayment.aggregate({
        _sum: { amount: true },
        where: { loan: { createdById: currentUserId } }
      }),

      // Get total cash outflow from auctions
      prisma.auction.aggregate({
        _sum: { amount: true },
        where: { chitFund: { createdById: currentUserId } }
      }),

      // Get total cash outflow from loan disbursements
      prisma.loan.aggregate({
        _sum: { amount: true },
        where: { createdById: currentUserId }
      }),

      // Get active chit funds count
      prisma.chitFund.count({
        where: {
          status: 'Active',
          createdById: currentUserId
        }
      }),

      // Get total members count
      prisma.globalMember.count({
        where: { createdById: currentUserId }
      }),

      // Get active loans count
      prisma.loan.count({
        where: {
          status: 'Active',
          createdById: currentUserId
        }
      }),

      // Get loans with only necessary data for profit calculation
      prisma.loan.findMany({
        where: { createdById: currentUserId },
        select: {
          id: true,
          amount: true,
          interestRate: true,
          documentCharge: true,
          repayments: {
            select: {
              amount: true,
              paymentType: true,
            },
          },
        },
      }),

      // Get chit funds with only necessary data
      prisma.chitFund.findMany({
        where: { createdById: currentUserId },
        select: {
          id: true,
          totalAmount: true,
          monthlyContribution: true, // Added this field which is used in calculateChitFundProfit
          membersCount: true, // Added this field which is used in calculateChitFundProfit
          contributions: {
            select: {
              amount: true,
            },
          },
          auctions: {
            select: {
              amount: true,
            },
          },
        },
      })
    ]);

    // Start fetching activities and events in parallel while we calculate other metrics
    const activitiesAndEventsPromise = Promise.all([
      getRecentActivitiesData(currentUserId),
      getUpcomingEventsData(currentUserId)
    ]);

    // Calculate loan profit using the centralized utility function
    const loanProfit = loansWithRepayments.reduce((sum, loan) => {
      // Use the centralized utility function to calculate profit
      const profit = calculateLoanProfit(loan, loan.repayments);
      return sum + profit;
    }, 0);

    // Calculate chit fund profit and outside amount
    let chitFundProfit = 0;
    let totalOutsideAmount = 0;

    // Calculate profit and outside amount for each chit fund
    chitFundsWithData.forEach(fund => {
      const fundProfit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
      const fundOutsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);

      chitFundProfit += fundProfit;
      totalOutsideAmount += fundOutsideAmount;
    });

    // Calculate remaining loan amount more efficiently
    const totalLoanAmount = loansWithRepayments.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepaymentAmount = loansWithRepayments.reduce((sum, loan) => {
      const loanRepayments = loan.repayments || [];
      return sum + loanRepayments.reduce((repaymentSum, repayment) => {
        if (repayment.paymentType !== 'interestOnly') {
          return repaymentSum + repayment.amount;
        }
        return repaymentSum;
      }, 0);
    }, 0);

    // Calculate the remaining loan amount
    const remainingLoanAmount = Math.max(0, totalLoanAmount - totalRepaymentAmount);

    // Add the remaining loan amount to the total outside amount
    const totalOutsideAmountWithLoans = totalOutsideAmount + remainingLoanAmount;

    // Create an object to store the breakdown of outside amount
    const outsideAmountBreakdown = {
      loanRemainingAmount: remainingLoanAmount,
      chitFundOutsideAmount: totalOutsideAmount
    };

    // Calculate total cash flows
    const totalCashInflow = (contributionsSum._sum.amount || 0) + (repaymentsSum._sum.amount || 0);
    const totalCashOutflow = (auctionsSum._sum.amount || 0) + (loansSum._sum.amount || 0);
    const totalProfit = loanProfit + chitFundProfit;

    // Get the activities and events that were being fetched in parallel
    const [recentActivities, upcomingEvents] = await activitiesAndEventsPromise;

    console.timeEnd('getSummary'); // End timing

    return NextResponse.json({
      totalCashInflow,
      totalCashOutflow,
      totalProfit,
      loanProfit,
      chitFundProfit,
      totalOutsideAmount: totalOutsideAmountWithLoans,
      outsideAmountBreakdown,
      activeChitFunds,
      totalMembers,
      activeLoans,
      recentActivities,
      upcomingEvents,
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}

// Handler for recent activities
async function getActivities(request: NextRequest, currentUserId: number) {
  try {
    const activities = await getRecentActivitiesData(currentUserId);
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activities' },
      { status: 500 }
    );
  }
}

// Handler for upcoming events
async function getUpcomingEvents(request: NextRequest, currentUserId: number) {
  try {
    const events = await getUpcomingEventsData(currentUserId);
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upcoming events' },
      { status: 500 }
    );
  }
}

// Handler for financial data
async function getFinancialData(request: NextRequest, currentUserId: number) {
  try {
    console.time('getFinancialData'); // Add timing for performance monitoring
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '12');

    // Validate duration parameter
    if (!['weekly', 'monthly', 'yearly'].includes(duration)) {
      return NextResponse.json(
        { error: 'Invalid duration parameter. Must be weekly, monthly, or yearly.' },
        { status: 400 }
      );
    }

    // Parse and validate limit parameter
    const parsedLimit = parseInt(searchParams.get('limit') || '12', 10);
    if (isNaN(parsedLimit)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be a number.' },
        { status: 400 }
      );
    }

    // Normalize limit to prevent excessive queries
    const validLimit = Math.min(Math.max(parsedLimit, 1), 24); // Reduced max limit from 60 to 24

    // Get the current date
    const now = new Date();

    // Calculate the start date based on the duration and limit
    const startDate = new Date(now);
    if (duration === 'weekly') {
      // For weekly, go back limit weeks
      startDate.setDate(now.getDate() - validLimit * 7);
    } else if (duration === 'monthly') {
      // For monthly, go back limit months
      startDate.setMonth(now.getMonth() - validLimit);
    } else if (duration === 'yearly') {
      // For yearly, go back limit years
      startDate.setFullYear(now.getFullYear() - validLimit);
    }

    // Generate the periods based on the duration
    const periods = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < validLimit; i++) {
      let periodLabel = '';
      let periodStartDate = new Date(currentDate);
      let periodEndDate = new Date(currentDate);

      if (duration === 'weekly') {
        // Format as "Week X of Month Year"
        const weekNumber = Math.ceil(currentDate.getDate() / 7);
        const monthName = currentDate.toLocaleString('default', { month: 'short' });
        const year = currentDate.getFullYear();
        periodLabel = `Week ${weekNumber} of ${monthName} ${year}`;

        // For weekly, the period is 7 days
        periodStartDate = new Date(currentDate);
        periodStartDate.setDate(periodStartDate.getDate() - 7);
        periodEndDate = new Date(currentDate);

        // Move to the next week
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (duration === 'monthly') {
        // Format as "Month Year"
        periodLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        // For monthly, the period is 1 month
        periodStartDate = new Date(currentDate);
        periodStartDate.setMonth(periodStartDate.getMonth() - 1);
        periodEndDate = new Date(currentDate);

        // Move to the next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (duration === 'yearly') {
        // Format as "Year"
        periodLabel = currentDate.getFullYear().toString();

        // For yearly, the period is 1 year
        periodStartDate = new Date(currentDate);
        periodStartDate.setFullYear(periodStartDate.getFullYear() - 1);
        periodEndDate = new Date(currentDate);

        // Move to the next year
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }

      periods.push({
        label: periodLabel,
        startDate: periodStartDate,
        endDate: periodEndDate,
      });
    }

    // Prepare arrays for the response
    const labels = periods.map(period => period.label);
    const cashInflow = new Array(periods.length).fill(0);
    const cashOutflow = new Array(periods.length).fill(0);
    const profit = new Array(periods.length).fill(0);
    const outsideAmount = new Array(periods.length).fill(0);

    // Get all financial data for the entire date range at once
    const overallStartDate = periods[0].startDate;
    const overallEndDate = periods[periods.length - 1].endDate;

    console.log(`Fetching data from ${overallStartDate.toISOString()} to ${overallEndDate.toISOString()}`);

    // Fetch all data in parallel
    const [allContributions, allRepayments, allAuctions, allLoans] = await Promise.all([
      // Get all contributions for the entire date range
      prisma.contribution.findMany({
        where: {
          paidDate: {
            gte: overallStartDate,
            lte: overallEndDate,
          },
          chitFund: {
            createdById: currentUserId,
          },
        },
        select: {
          amount: true,
          paidDate: true,
        },
      }),

      // Get all repayments for the entire date range
      prisma.repayment.findMany({
        where: {
          paidDate: {
            gte: overallStartDate,
            lte: overallEndDate,
          },
          loan: {
            createdById: currentUserId,
          },
        },
        select: {
          amount: true,
          paidDate: true,
          paymentType: true,
          loan: {
            select: {
              interestRate: true,
            },
          },
        },
      }),

      // Get all auctions for the entire date range
      prisma.auction.findMany({
        where: {
          date: {
            gte: overallStartDate,
            lte: overallEndDate,
          },
          chitFund: {
            createdById: currentUserId,
          },
        },
        select: {
          amount: true,
          date: true,
        },
      }),

      // Get all loans disbursed in the entire date range
      prisma.loan.findMany({
        where: {
          disbursementDate: {
            gte: overallStartDate,
            lte: overallEndDate,
          },
          createdById: currentUserId,
        },
        select: {
          amount: true,
          disbursementDate: true,
          documentCharge: true,
        },
      }),
    ]);

    console.log(`Retrieved: ${allContributions.length} contributions, ${allRepayments.length} repayments, ${allAuctions.length} auctions, ${allLoans.length} loans`);

    // Process each period
    periods.forEach((period, index) => {
      // Filter data for this period
      const periodContributions = allContributions.filter(
        c => new Date(c.paidDate) >= period.startDate && new Date(c.paidDate) < period.endDate
      );

      const periodRepayments = allRepayments.filter(
        r => new Date(r.paidDate) >= period.startDate && new Date(r.paidDate) < period.endDate
      );

      const periodAuctions = allAuctions.filter(
        a => new Date(a.date) >= period.startDate && new Date(a.date) < period.endDate
      );

      const periodLoans = allLoans.filter(
        l => new Date(l.disbursementDate) >= period.startDate && new Date(l.disbursementDate) < period.endDate
      );

      // Calculate cash inflow (contributions + repayments)
      const contributionsTotal = periodContributions.reduce((sum, contribution) => sum + contribution.amount, 0);
      const repaymentsTotal = periodRepayments.reduce((sum, repayment) => sum + repayment.amount, 0);
      const periodCashInflow = contributionsTotal + repaymentsTotal;
      cashInflow[index] = periodCashInflow;

      // Calculate cash outflow (auctions + loans)
      const auctionsTotal = periodAuctions.reduce((sum, auction) => sum + auction.amount, 0);
      const loansTotal = periodLoans.reduce((sum, loan) => sum + loan.amount, 0);
      const periodCashOutflow = auctionsTotal + loansTotal;
      cashOutflow[index] = periodCashOutflow;

      // Calculate profit
      // For loans: interest payments + document charges
      const loanProfit = periodRepayments.reduce((sum, repayment) => {
        if (repayment.paymentType === 'interestOnly') {
          return sum + repayment.amount;
        } else {
          return sum + (repayment.loan?.interestRate || 0);
        }
      }, 0) + periodLoans.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0);

      // For chit funds: difference between contributions and auctions
      const chitFundProfit = Math.max(0, contributionsTotal - auctionsTotal);

      // Total profit
      const periodProfit = loanProfit + chitFundProfit;
      profit[index] = periodProfit;

      // Calculate outside amount (cash outflow - cash inflow)
      const periodOutsideAmount = Math.max(0, periodCashOutflow - periodCashInflow);
      outsideAmount[index] = periodOutsideAmount;
    });

    console.timeEnd('getFinancialData'); // End timing

    // Return the financial data
    return NextResponse.json({
      labels,
      cashInflow,
      cashOutflow,
      profit,
      outsideAmount,
    });
  } catch (error) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

// Handler for exporting financial data
async function exportFinancialData(request: NextRequest, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '12');
    const period = searchParams.get('period');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Validate duration parameter
    if (!['weekly', 'monthly', 'yearly', 'single'].includes(duration)) {
      return NextResponse.json(
        { error: 'Invalid duration parameter. Must be weekly, monthly, yearly, or single.' },
        { status: 400 }
      );
    }

    // For single period export, validate required parameters
    if (duration === 'single') {
      if (!period || !startDateParam || !endDateParam) {
        return NextResponse.json(
          { error: 'For single period export, period, startDate, and endDate are required.' },
          { status: 400 }
        );
      }
    }

    // Parse and validate limit parameter
    const parsedLimit = parseInt(searchParams.get('limit') || '12', 10);
    if (isNaN(parsedLimit)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be a number.' },
        { status: 400 }
      );
    }

    // Normalize limit to prevent excessive queries
    const validLimit = Math.min(Math.max(parsedLimit, 1), 60);

    // Get financial data based on the parameters
    let financialData;

    if (duration === 'single' && period && startDateParam && endDateParam) {
      // For single period export
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD format.' },
          { status: 400 }
        );
      }

      // Get financial data for the specified period
      financialData = await getSinglePeriodFinancialData(currentUserId, startDate, endDate, period);
    } else {
      // For regular export (weekly, monthly, yearly)
      financialData = await getRegularFinancialData(currentUserId, duration, validLimit);
    }

    // Generate Excel file
    const workbook = await generateExcelFile(financialData, duration, period || undefined);

    // Convert workbook to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set filename based on parameters
    let filename = 'financial_data';
    if (duration === 'single' && period) {
      filename = `financial_data_${period.replace(/\s+/g, '_')}`;
    } else {
      filename = `financial_data_${duration}_${validLimit}`;
    }

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filename}.xlsx`
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

// Helper function to get financial data for a single period
async function getSinglePeriodFinancialData(userId: number, startDate: Date, endDate: Date, periodName: string) {
  // Get contributions for the period
  const contributions = await prisma.contribution.findMany({
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
        },
      },
      member: {
        include: {
          globalMember: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Get repayments for the period
  const repayments = await prisma.repayment.findMany({
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
        select: {
          id: true,
          amount: true,
          interestRate: true,
          borrower: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Get auctions for the period
  const auctions = await prisma.auction.findMany({
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
      chitFund: {
        select: {
          name: true,
        },
      },
      winner: {
        include: {
          globalMember: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Get loans disbursed in the period
  const loans = await prisma.loan.findMany({
    where: {
      disbursementDate: {
        gte: startDate,
        lte: endDate,
      },
      createdById: userId,
    },
    include: {
      borrower: {
        select: {
          name: true,
        },
      },
    },
  });

  // Calculate totals
  const contributionsTotal = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const repaymentsTotal = repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  const auctionsTotal = auctions.reduce((sum, auction) => sum + auction.amount, 0);
  const loansTotal = loans.reduce((sum, loan) => sum + loan.amount, 0);

  // Calculate profit
  // For loans: interest payments + document charges
  const loanProfit = repayments.reduce((sum, repayment) => {
    if (repayment.paymentType === 'interestOnly') {
      return sum + repayment.amount;
    } else {
      return sum + (repayment.loan?.interestRate || 0);
    }
  }, 0) + loans.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0);

  // For chit funds: difference between contributions and auctions
  const chitFundProfit = Math.max(0, contributionsTotal - auctionsTotal);

  // Total profit
  const totalProfit = loanProfit + chitFundProfit;

  // Calculate cash inflow and outflow
  const cashInflow = contributionsTotal + repaymentsTotal;
  const cashOutflow = auctionsTotal + loansTotal;

  // Calculate outside amount
  const outsideAmount = Math.max(0, cashOutflow - cashInflow);

  return {
    period: periodName,
    startDate,
    endDate,
    contributions,
    repayments,
    auctions,
    loans,
    contributionsTotal,
    repaymentsTotal,
    auctionsTotal,
    loansTotal,
    loanProfit,
    chitFundProfit,
    totalProfit,
    cashInflow,
    cashOutflow,
    outsideAmount,
  };
}

// Helper function to get regular financial data (weekly, monthly, yearly)
async function getRegularFinancialData(userId: number, duration: string, limit: number) {
  // Get the current date
  const now = new Date();

  // Calculate the start date based on the duration and limit
  const startDate = new Date(now);
  if (duration === 'weekly') {
    // For weekly, go back limit weeks
    startDate.setDate(now.getDate() - limit * 7);
  } else if (duration === 'monthly') {
    // For monthly, go back limit months
    startDate.setMonth(now.getMonth() - limit);
  } else if (duration === 'yearly') {
    // For yearly, go back limit years
    startDate.setFullYear(now.getFullYear() - limit);
  }

  // Initialize arrays to store the data
  const periods = [];
  const labels: string[] = [];
  const cashInflow: number[] = [];
  const cashOutflow: number[] = [];
  const profit: number[] = [];
  const outsideAmount: number[] = [];
  const periodsData = [];

  // Generate the periods based on the duration
  const currentDate = new Date(startDate);

  for (let i = 0; i < limit; i++) {
    let periodLabel = '';
    let periodStartDate = new Date(currentDate);
    let periodEndDate = new Date(currentDate);

    if (duration === 'weekly') {
      // Format as "Week X of Month Year"
      const weekNumber = Math.ceil(currentDate.getDate() / 7);
      const monthName = currentDate.toLocaleString('default', { month: 'short' });
      const year = currentDate.getFullYear();
      periodLabel = `Week ${weekNumber} of ${monthName} ${year}`;

      // For weekly, the period is 7 days
      periodEndDate = new Date(currentDate);
      periodStartDate = new Date(currentDate);
      periodStartDate.setDate(periodStartDate.getDate() - 7);

      // Move to the next week
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (duration === 'monthly') {
      // Format as "Month Year"
      periodLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      // For monthly, the period is 1 month
      periodEndDate = new Date(currentDate);
      periodStartDate = new Date(currentDate);
      periodStartDate.setMonth(periodStartDate.getMonth() - 1);

      // Move to the next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (duration === 'yearly') {
      // Format as "Year"
      periodLabel = currentDate.getFullYear().toString();

      // For yearly, the period is 1 year
      periodEndDate = new Date(currentDate);
      periodStartDate = new Date(currentDate);
      periodStartDate.setFullYear(periodStartDate.getFullYear() - 1);

      // Move to the next year
      currentDate.setFullYear(currentDate.getFullYear() + 1);
    }

    periods.push({
      label: periodLabel,
      startDate: periodStartDate,
      endDate: periodEndDate,
    });
  }

  // For each period, calculate the financial data
  for (const period of periods) {
    // Add the label to the labels array
    labels.push(period.label);

    // Get financial data for the period
    const periodData = await getSinglePeriodFinancialData(
      userId,
      period.startDate,
      period.endDate,
      period.label
    );

    // Add the data to the arrays
    cashInflow.push(periodData.cashInflow);
    cashOutflow.push(periodData.cashOutflow);
    profit.push(periodData.totalProfit);
    outsideAmount.push(periodData.outsideAmount);
    periodsData.push(periodData);
  }

  return {
    duration,
    limit,
    labels,
    cashInflow,
    cashOutflow,
    profit,
    outsideAmount,
    periodsData,
  };
}

// Helper function to generate Excel file
async function generateExcelFile(data: any, duration: string, period: string | undefined) {
  // Import Excel.js dynamically
  const ExcelJS = require('exceljs');

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();

  // Add a worksheet for summary
  const summarySheet = workbook.addWorksheet('Summary');

  // Set up the summary sheet
  summarySheet.columns = [
    { header: 'Period', key: 'period', width: 20 },
    { header: 'Cash Inflow', key: 'cashInflow', width: 15 },
    { header: 'Cash Outflow', key: 'cashOutflow', width: 15 },
    { header: 'Profit', key: 'profit', width: 15 },
    { header: 'Outside Amount', key: 'outsideAmount', width: 15 },
  ];

  // Add data to the summary sheet
  if (duration === 'single') {
    // For single period export
    summarySheet.addRow({
      period: data.period,
      cashInflow: data.cashInflow,
      cashOutflow: data.cashOutflow,
      profit: data.totalProfit,
      outsideAmount: data.outsideAmount,
    });

    // Add details worksheets
    addDetailsWorksheets(workbook, data);
  } else {
    // For regular export
    for (let i = 0; i < data.labels.length; i++) {
      summarySheet.addRow({
        period: data.labels[i],
        cashInflow: data.cashInflow[i],
        cashOutflow: data.cashOutflow[i],
        profit: data.profit[i],
        outsideAmount: data.outsideAmount[i],
      });
    }

    // Add details worksheets for each period
    for (const periodData of data.periodsData) {
      addDetailsWorksheets(workbook, periodData, true);
    }
  }

  return workbook;
}

// Helper function to add details worksheets
function addDetailsWorksheets(workbook: any, data: any, usePeriodPrefix = false) {
  const prefix = usePeriodPrefix ? `${data.period} - ` : '';

  // Add a worksheet for contributions
  const contributionsSheet = workbook.addWorksheet(`${prefix}Contributions`);
  contributionsSheet.columns = [
    { header: 'Chit Fund', key: 'chitFund', width: 20 },
    { header: 'Member', key: 'member', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  for (const contribution of data.contributions) {
    contributionsSheet.addRow({
      chitFund: contribution.chitFund?.name || 'Unknown',
      member: contribution.member?.globalMember?.name || 'Unknown',
      amount: contribution.amount,
      date: new Date(contribution.paidDate).toLocaleDateString('en-IN'),
    });
  }

  // Add a worksheet for repayments
  const repaymentsSheet = workbook.addWorksheet(`${prefix}Repayments`);
  repaymentsSheet.columns = [
    { header: 'Borrower', key: 'borrower', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Payment Type', key: 'paymentType', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  for (const repayment of data.repayments) {
    repaymentsSheet.addRow({
      borrower: repayment.loan?.borrower?.name || 'Unknown',
      amount: repayment.amount,
      paymentType: repayment.paymentType === 'interestOnly' ? 'Interest Only' : 'Full Payment',
      date: new Date(repayment.paidDate).toLocaleDateString('en-IN'),
    });
  }

  // Add a worksheet for auctions
  const auctionsSheet = workbook.addWorksheet(`${prefix}Auctions`);
  auctionsSheet.columns = [
    { header: 'Chit Fund', key: 'chitFund', width: 20 },
    { header: 'Winner', key: 'winner', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  for (const auction of data.auctions) {
    auctionsSheet.addRow({
      chitFund: auction.chitFund?.name || 'Unknown',
      winner: auction.winner?.globalMember?.name || 'Unknown',
      amount: auction.amount,
      date: new Date(auction.date).toLocaleDateString('en-IN'),
    });
  }

  // Add a worksheet for loans
  const loansSheet = workbook.addWorksheet(`${prefix}Loans`);
  loansSheet.columns = [
    { header: 'Borrower', key: 'borrower', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Document Charge', key: 'documentCharge', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  for (const loan of data.loans) {
    loansSheet.addRow({
      borrower: loan.borrower?.name || 'Unknown',
      amount: loan.amount,
      documentCharge: loan.documentCharge || 0,
      date: new Date(loan.disbursementDate).toLocaleDateString('en-IN'),
    });
  }
}

// Helper function to get recent activities
async function getRecentActivitiesData(userId: number) {
  try {
    console.time('getRecentActivitiesData'); // Add timing for performance monitoring

    // Get all recent activities in parallel with optimized queries
    const [recentMembers, recentAuctions, recentLoans, recentRepayments] = await Promise.all([
      // Get recent members (new chit fund members) with optimized select
      prisma.member.findMany({
        take: 3,
        where: {
          chitFund: {
            createdById: userId
          }
        },
        orderBy: {
          joinDate: 'desc',
        },
        select: {
          id: true,
          joinDate: true,
          chitFund: {
            select: {
              name: true,
            }
          },
          globalMember: {
            select: {
              name: true,
            }
          },
        },
      }),

      // Get recent auctions with optimized select
      prisma.auction.findMany({
        take: 3,
        where: {
          chitFund: {
            createdById: userId
          }
        },
        orderBy: {
          date: 'desc',
        },
        select: {
          id: true,
          amount: true,
          date: true,
          chitFund: {
            select: {
              name: true,
            }
          },
          winner: {
            select: {
              globalMember: {
                select: {
                  name: true,
                }
              }
            }
          },
        },
      }),

      // Get recent loans with optimized select
      prisma.loan.findMany({
        take: 3,
        where: {
          createdById: userId
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          amount: true,
          loanType: true,
          disbursementDate: true,
          borrower: {
            select: {
              name: true,
            }
          },
        },
      }),

      // Get recent repayments with optimized select
      prisma.repayment.findMany({
        take: 3,
        where: {
          loan: {
            createdById: userId
          }
        },
        orderBy: {
          paidDate: 'desc',
        },
        select: {
          id: true,
          amount: true,
          paidDate: true,
          loan: {
            select: {
              borrower: {
                select: {
                  name: true,
                }
              }
            }
          },
        },
      }),
    ]);

    // Combine and format all activities
    const activities = [
      ...recentMembers.map((member: any) => {
        // Get member name and chit fund name safely
        const memberName = member.globalMember ? member.globalMember.name : 'Unknown Member';
        const chitFundName = member.chitFund ? member.chitFund.name : 'Unknown Chit Fund';

        return {
          id: `member-${member.id}`,
          type: 'Chit Fund',
          action: 'New member joined',
          details: `${memberName} joined ${chitFundName}`,
          date: member.joinDate,
        };
      }),
      ...recentAuctions.map((auction: any) => {
        // Get winner name safely, handling potential undefined values
        const winnerName = auction.winner && auction.winner.globalMember
          ? auction.winner.globalMember.name
          : 'Unknown Member';

        return {
          id: `auction-${auction.id}`,
          type: 'Chit Fund',
          action: 'Auction completed',
          details: `${auction.chitFund.name} auction won by ${winnerName} at ₹${auction.amount}`,
          date: auction.date,
        };
      }),
      ...recentLoans.map((loan: any) => {
        // Get borrower name safely
        const borrowerName = loan.borrower ? loan.borrower.name : 'Unknown Borrower';

        return {
          id: `loan-${loan.id}`,
          type: 'Loan',
          action: 'Loan approved',
          details: `${loan.loanType} loan of ₹${loan.amount} approved for ${borrowerName}`,
          date: loan.disbursementDate,
        };
      }),
      ...recentRepayments.map((repayment: any) => {
        // Get borrower name safely with nested null checks
        const borrowerName = repayment.loan && repayment.loan.borrower
          ? repayment.loan.borrower.name
          : 'Unknown Borrower';

        return {
          id: `repayment-${repayment.id}`,
          type: 'Loan',
          action: 'Repayment received',
          details: `Loan repayment of ₹${repayment.amount} received from ${borrowerName}`,
          date: repayment.paidDate,
        };
      }),
    ];

    // Sort by date (newest first) and take top 5
    const result = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(activity => ({
        ...activity,
        date: formatRelativeTime(activity.date),
      }));

    console.timeEnd('getRecentActivitiesData'); // End timing
    return result;
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

// Helper function to get upcoming events
async function getUpcomingEventsData(userId: number) {
  try {
    console.time('getUpcomingEventsData'); // Add timing for performance monitoring

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    // Get upcoming auctions and payments in parallel
    const [upcomingAuctions, upcomingPayments] = await Promise.all([
      // Get upcoming auctions
      prisma.chitFund.findMany({
        where: {
          status: 'Active',
          createdById: userId,
          nextAuctionDate: {
            gte: today,
            lte: nextMonth,
          },
        },
        select: {
          id: true,
          name: true,
          nextAuctionDate: true,
        },
        take: 3,
        orderBy: {
          nextAuctionDate: 'asc',
        },
      }),

      // Get upcoming loan payments
      prisma.loan.findMany({
        where: {
          status: 'Active',
          createdById: userId,
          nextPaymentDate: {
            gte: today,
            lte: nextMonth,
          },
        },
        select: {
          id: true,
          nextPaymentDate: true,
          borrower: {
            select: {
              name: true
            }
          }
        },
        take: 3,
        orderBy: {
          nextPaymentDate: 'asc',
        },
      })
    ]);

    // Combine and format all events
    const events = [
      ...upcomingAuctions.map((auction: any) => ({
        id: `auction-${auction.id}`,
        title: `${auction.name} Auction`,
        date: auction.nextAuctionDate ? formatDate(auction.nextAuctionDate) : 'Date not set',
        type: 'Chit Fund',
        rawDate: auction.nextAuctionDate, // Keep raw date for sorting
      })),
      ...upcomingPayments.map((payment: any) => {
        // Get borrower name safely
        const borrowerName = payment.borrower ? payment.borrower.name : 'Unknown Borrower';

        return {
          id: `payment-${payment.id}`,
          title: `${borrowerName} Loan Payment`,
          date: payment.nextPaymentDate ? formatDate(payment.nextPaymentDate) : 'Date not set',
          type: 'Loan',
          rawDate: payment.nextPaymentDate, // Keep raw date for sorting
        };
      }),
    ];

    // Sort by date (soonest first) and take top 3
    // Use the raw date for sorting to avoid string comparison issues
    const result = events
      .sort((a, b) => {
        if (!a.rawDate) return 1;
        if (!b.rawDate) return -1;
        return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
      })
      .slice(0, 3)
      .map(({ rawDate, ...rest }) => rest); // Remove the rawDate property from the result

    console.timeEnd('getUpcomingEventsData'); // End timing
    return result;
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    return [];
  }
}

// Helper function to format relative time
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatDate(date);
  }
}

// Helper function to format date
function formatDate(date: Date | string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return new Date(date).toLocaleDateString('en-IN', options);
}
