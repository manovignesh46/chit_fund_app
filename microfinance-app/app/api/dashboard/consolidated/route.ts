import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { generatePaymentSchedule, calculateNextPaymentDate, updateOverdueAmountFromRepayments } from '@/lib/paymentSchedule';
import { calculateLoanProfit, calculateChitFundProfit, calculateTotalLoanProfit, calculateTotalChitFundProfit } from '@/lib/financialUtils';
import * as XLSX from 'xlsx';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

// Main route handler
export async function GET(request: NextRequest) {
  try {
    const timerLabel = `dashboard-api-${Date.now()}`;
    console.time(timerLabel); // Add timing with unique label

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the action from the query string
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'summary':
        return await getSummary(request, currentUserId);
      case 'financial-data':
        return await getFinancialData(request, currentUserId);
      case 'export':
        return await exportFinancialData(request, currentUserId);
      case 'activities':
        // Get pagination parameters
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
        const filter = searchParams.get('filter') || 'all';

        // Get activities with pagination
        const activitiesData = await getActivitiesWithPagination(currentUserId, page, pageSize, filter);
        return NextResponse.json(activitiesData);
      case 'events':
        // Get the view parameter
        const view = searchParams.get('view');

        // For dashboard view, get upcoming events
        if (view === 'dashboard') {
          const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : 3;
          const dashboardEvents = await getUpcomingEventsForDashboard(currentUserId, limit);

          // Count total upcoming events for the next 3 months
          const totalCount = await countUpcomingEvents(currentUserId);

          // Return dashboard events with count
          return NextResponse.json({
            events: dashboardEvents,
            totalCount
          });
        }

        // For calendar view, get events for the specified month
        if (view === 'calendar') {
          const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
          const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString(), 10);
          const calendarEvents = await getEventsForMonth(currentUserId, year, month);
          return NextResponse.json(calendarEvents);
        }

        // Default to upcoming events for dashboard
        const upcomingEvents = await getUpcomingEventsForDashboard(currentUserId);
        return NextResponse.json(upcomingEvents);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get dashboard summary
async function getSummary(request: NextRequest, currentUserId: number) {
  try {
    const timerLabel = `getSummary-${Date.now()}`;
    console.time(timerLabel); // Add timing with unique label

    // Get all data in parallel for better performance
    const [
      // Get total cash inflow from chit fund contributions
      contributionsSum,
      // Get total cash outflow from auctions
      auctionsSum,
      // Get total cash inflow from loan repayments
      repaymentsSum,
      // Get total cash outflow from loans
      loansSum,
      // Get total document charges from loans
      documentChargesSum,
      // Get recent activities and upcoming events in parallel
      activitiesAndEventsPromise,
      // Optimize chit fund query to only fetch what's needed
      chitFundsWithData
    ] = await Promise.all([
      // Get total cash inflow from chit fund contributions
      prisma.contribution.aggregate({
        _sum: { amount: true },
        where: {
          chitFund: {
            createdById: currentUserId
          }
        }
      }),

      // Get total cash outflow from auctions
      prisma.auction.aggregate({
        _sum: { amount: true },
        where: {
          chitFund: {
            createdById: currentUserId
          }
        }
      }),

      // Get total cash inflow from loan repayments
      prisma.repayment.aggregate({
        _sum: { amount: true },
        where: {
          loan: {
            createdById: currentUserId
          }
        }
      }),

      // Get total cash outflow from loans
      prisma.loan.aggregate({
        _sum: { amount: true },
        where: {
          createdById: currentUserId
        }
      }),

      // Get total document charges from loans
      prisma.loan.aggregate({
        _sum: { documentCharge: true },
        where: {
          createdById: currentUserId
        }
      }),

      // Get recent activities and upcoming events in parallel
      Promise.all([
        getRecentActivitiesData(currentUserId),
        getUpcomingEventsForDashboard(currentUserId)
      ]),

      // Get chit funds with their contributions and auctions
      prisma.chitFund.findMany({
        where: {
          createdById: currentUserId
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          monthlyContribution: true,
          duration: true,
          currentMonth: true,
          status: true,
          _count: {
            select: {
              members: true,
              auctions: true,
              contributions: true
            }
          }
        }
      })
    ]);

    // Extract values from the aggregations
    const cashInflow = (contributionsSum._sum.amount || 0) + (repaymentsSum._sum.amount || 0);
    const cashOutflow = (auctionsSum._sum.amount || 0) + (loansSum._sum.amount || 0);
    const documentCharges = documentChargesSum._sum.documentCharge || 0;

    // Get all loans with their repayments to calculate profit using the centralized function
    const loansWithRepayments = await prisma.loan.findMany({
      where: {
        createdById: currentUserId
      },
      select: {
        id: true,
        amount: true,
        interestRate: true,
        documentCharge: true,
        repaymentType: true,
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
    });

    // console.log(`Found ${loansWithRepayments.length} loans for profit calculation`);

    // Calculate loan profit using the centralized utility function
    const loanProfit = calculateTotalLoanProfit(loansWithRepayments);

    // Log individual loan profits for debugging
    /*
    loansWithRepayments.forEach((loan, index) => {
      // Using calculateLoanProfit to prevent unused variable warning
      const profit = calculateLoanProfit(loan, loan.repayments);
      console.log(`Loan ${index + 1} (ID: ${loan.id}) profit: ${profit}`, {
        amount: loan.amount,
        interestRate: loan.interestRate,
        documentCharge: loan.documentCharge,
        repaymentType: loan.repaymentType,
        repaymentsCount: loan.repayments.length
      });
    });
    */

    // Prevent unused variable warning
    void calculateLoanProfit;
    void calculateChitFundProfit;

    // console.log(`Total loan profit: ${loanProfit}`);

    // Get chit funds with their members, contributions, and auctions for accurate profit calculation
    const chitFundsWithDetails = await prisma.chitFund.findMany({
      where: {
        createdById: currentUserId
      },
      select: {
        id: true,
        name: true,
        totalAmount: true,
        monthlyContribution: true,
        duration: true,
        currentMonth: true,
        status: true,
        membersCount: true,
        members: {
          select: {
            id: true
          }
        },
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
    });

    // console.log(`Found ${chitFundsWithDetails.length} chit funds for profit calculation`);

    // Calculate chit fund profit using the centralized utility function
    const chitFundProfit = calculateTotalChitFundProfit(chitFundsWithDetails);

    // Log individual chit fund profits for debugging
    /*
    chitFundsWithDetails.forEach((fund, index) => {
      const profit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
      console.log(`Chit Fund ${index + 1} (ID: ${fund.id}) profit: ${profit}`, {
        name: fund.name,
        monthlyContribution: fund.monthlyContribution,
        membersCount: fund.members.length,
        contributionsCount: fund.contributions.length,
        auctionsCount: fund.auctions.length,
        totalInflow: fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
        totalOutflow: fund.auctions.reduce((sum, auction) => sum + auction.amount, 0)
      });
    });
    */

    // console.log(`Total chit fund profit: ${chitFundProfit}`);

    const totalProfit = loanProfit + chitFundProfit;

    // Calculate outside amount (when cash outflow exceeds inflow)
    const outsideAmount = cashOutflow > cashInflow ? cashOutflow - cashInflow : 0;

    // Calculate outside amount breakdown
    const loanRemainingAmount = (loansSum._sum.amount || 0) - (repaymentsSum._sum.amount || 0);
    const chitFundOutsideAmount = (auctionsSum._sum.amount || 0) - (contributionsSum._sum.amount || 0);
    const outsideAmountBreakdown = {
      loanRemainingAmount: loanRemainingAmount > 0 ? loanRemainingAmount : 0,
      chitFundOutsideAmount: chitFundOutsideAmount > 0 ? chitFundOutsideAmount : 0
    };

    // Get recent activities and upcoming events
    const [recentActivities, upcomingEvents] = activitiesAndEventsPromise;

    // Get total upcoming events count
    const totalUpcomingEvents = await countUpcomingEvents(currentUserId);

    // Get total activities count (using a simple count for now)
    const totalActivities = recentActivities.length > 3 ? recentActivities.length : 0;

    console.timeEnd(timerLabel); // End timing with the same unique label

    // Return the dashboard summary
    return NextResponse.json({
      cashInflow,
      cashOutflow,
      outsideAmount,
      outsideAmountBreakdown,
      profit: {
        total: totalProfit,
        loans: loanProfit,
        chitFunds: chitFundProfit
      },
      counts: {
        chitFunds: chitFundsWithData.length,
        activeChitFunds: chitFundsWithData.filter(cf => cf.status === 'Active').length,
        members: chitFundsWithData.reduce((sum, cf) => sum + cf._count.members, 0),
        loans: await prisma.loan.count({ where: { createdById: currentUserId } }),
        activeLoans: await prisma.loan.count({ where: { createdById: currentUserId, status: 'Active' } })
      },
      recentActivities,
      upcomingEvents,
      totalUpcomingEvents,
      totalActivities
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}

// Helper function to get financial data for charts
async function getFinancialData(request: NextRequest, currentUserId: number) {
  try {
    const timerLabel = `getFinancialData-${Date.now()}`;
    console.time(timerLabel);

    // Get duration and limit from query params
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    // Calculate date range based on duration
    const endDate = new Date();
    let startDate = new Date();

    if (duration === 'monthly') {
      startDate.setMonth(endDate.getMonth() - limit + 1);
      startDate.setDate(1);
    } else if (duration === 'yearly') {
      startDate.setFullYear(endDate.getFullYear() - limit + 1);
      startDate.setMonth(0);
      startDate.setDate(1);
    } else if (duration === 'weekly') {
      startDate.setDate(endDate.getDate() - (limit * 7) + 1);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all data in parallel
    const [allContributions, allRepayments, allAuctions, allLoans] = await Promise.all([
      // Get all contributions for the entire date range
      prisma.contribution.findMany({
        where: {
          chitFund: {
            createdById: currentUserId
          },
          paidDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          paidDate: true
        },
        orderBy: {
          paidDate: 'asc'
        }
      }),

      // Get all repayments for the entire date range
      prisma.repayment.findMany({
        where: {
          loan: {
            createdById: currentUserId
          },
          paidDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          paidDate: true,
          paymentType: true
        },
        orderBy: {
          paidDate: 'asc'
        }
      }),

      // Get all auctions for the entire date range
      prisma.auction.findMany({
        where: {
          chitFund: {
            createdById: currentUserId
          },
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          date: true
        },
        orderBy: {
          date: 'asc'
        }
      }),

      // Get all loans for the entire date range
      prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          disbursementDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          documentCharge: true,
          disbursementDate: true
        },
        orderBy: {
          disbursementDate: 'asc'
        }
      })
    ]);

    // Generate periods based on duration
    const periods: string[] = [];
    const periodData: {
      cashInflow: number[];
      cashOutflow: number[];
      profit: number[];
      outsideAmount: number[];
    } = {
      cashInflow: [],
      cashOutflow: [],
      profit: [],
      outsideAmount: []
    };

    // Helper function to format period label
    const formatPeriodLabel = (date: Date) => {
      if (duration === 'monthly') {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else if (duration === 'yearly') {
        return date.getFullYear().toString();
      } else if (duration === 'weekly') {
        return `Week ${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
      }
      return '';
    };

    // Helper function to check if a date falls within a period
    const isInPeriod = (date: Date, periodStart: Date, periodEnd: Date) => {
      return date >= periodStart && date <= periodEnd;
    };

    // Generate periods and calculate data for each period
    let currentDate = new Date(startDate);
    for (let i = 0; i < limit; i++) {
      let periodStart = new Date(currentDate);
      let periodEnd = new Date(currentDate);

      if (duration === 'monthly') {
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0); // Last day of the month
        periodEnd.setHours(23, 59, 59, 999);
      } else if (duration === 'yearly') {
        periodEnd.setFullYear(periodStart.getFullYear() + 1);
        periodEnd.setMonth(0);
        periodEnd.setDate(0); // Last day of December
        periodEnd.setHours(23, 59, 59, 999);
      } else if (duration === 'weekly') {
        periodEnd.setDate(periodStart.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
      }

      // Calculate financial data for this period
      const periodContributions = allContributions.filter(c =>
        isInPeriod(new Date(c.paidDate), periodStart, periodEnd)
      ).reduce((sum, c) => sum + c.amount, 0);

      const periodRepayments = allRepayments.filter(r =>
        isInPeriod(new Date(r.paidDate), periodStart, periodEnd)
      ).reduce((sum, r) => sum + r.amount, 0);

      const periodAuctions = allAuctions.filter(a =>
        isInPeriod(new Date(a.date), periodStart, periodEnd)
      ).reduce((sum, a) => sum + a.amount, 0);

      const periodLoans = allLoans.filter(l =>
        isInPeriod(new Date(l.disbursementDate), periodStart, periodEnd)
      );

      const periodLoanAmount = periodLoans.reduce((sum, l) => sum + l.amount, 0);
      // Document charges are now calculated as part of the loan profit

      // Get loans with their repayments for this period
      const periodLoansWithRepayments = await prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          OR: [
            {
              disbursementDate: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            {
              repayments: {
                some: {
                  paidDate: {
                    gte: periodStart,
                    lte: periodEnd
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
          repayments: {
            where: {
              paidDate: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            select: {
              id: true,
              amount: true,
              paymentType: true,
              paidDate: true,
              period: true
            }
          }
        }
      });

      // console.log(`Period ${formatPeriodLabel(periodStart)}: Found ${periodLoansWithRepayments.length} loans`);

      // Calculate loan profit using the centralized utility function
      const periodLoanProfit = calculateTotalLoanProfit(periodLoansWithRepayments);

      // Log individual loan profits for debugging
      /*
      periodLoansWithRepayments.forEach((loan, index) => {
        const profit = calculateLoanProfit(loan, loan.repayments);
        console.log(`Period ${formatPeriodLabel(periodStart)} - Loan ${index + 1} (ID: ${loan.id}) profit: ${profit}`);
      });
      */

      // We'll use a more detailed query for chit funds below

      // Update the query to get more detailed chit fund data
      const updatedPeriodChitFunds = await prisma.chitFund.findMany({
        where: {
          createdById: currentUserId,
          OR: [
            {
              contributions: {
                some: {
                  paidDate: {
                    gte: periodStart,
                    lte: periodEnd
                  }
                }
              }
            },
            {
              auctions: {
                some: {
                  date: {
                    gte: periodStart,
                    lte: periodEnd
                  }
                }
              }
            }
          ]
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          monthlyContribution: true,
          duration: true,
          currentMonth: true,
          status: true,
          membersCount: true,
          members: {
            select: {
              id: true
            }
          },
          contributions: {
            where: {
              paidDate: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            select: {
              id: true,
              amount: true,
              month: true,
              paidDate: true
            }
          },
          auctions: {
            where: {
              date: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            select: {
              id: true,
              amount: true,
              month: true,
              date: true
            }
          }
        }
      });

      // console.log(`Period ${formatPeriodLabel(periodStart)}: Found ${updatedPeriodChitFunds.length} chit funds`);

      // Calculate chit fund profit using the centralized utility function
      const periodChitFundProfit = calculateTotalChitFundProfit(updatedPeriodChitFunds);

      // Log individual chit fund profits for debugging
      /*
      updatedPeriodChitFunds.forEach((fund, index) => {
        const profit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
        console.log(`Period ${formatPeriodLabel(periodStart)} - Chit Fund ${index + 1} (ID: ${fund.id}) profit: ${profit}`, {
          name: fund.name,
          totalInflow: fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
          totalOutflow: fund.auctions.reduce((sum, auction) => sum + auction.amount, 0)
        });
      });
      */

      // console.log(`Period ${formatPeriodLabel(periodStart)} - Total chit fund profit: ${periodChitFundProfit}`);

      // Calculate totals for the period
      const periodCashInflow = periodContributions + periodRepayments;
      const periodCashOutflow = periodAuctions + periodLoanAmount;
      const periodProfit = periodLoanProfit + periodChitFundProfit;
      const periodOutsideAmount = periodCashOutflow > periodCashInflow ?
                                periodCashOutflow - periodCashInflow : 0;

      // Add period data
      periods.push(formatPeriodLabel(periodStart));
      periodData.cashInflow.push(periodCashInflow);
      periodData.cashOutflow.push(periodCashOutflow);
      periodData.profit.push(periodProfit);
      periodData.outsideAmount.push(periodOutsideAmount);

      // Move to next period
      if (duration === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (duration === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else if (duration === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    console.timeEnd(timerLabel);

    // Prepare detailed data for each period
    const detailedPeriodsData = periods.map(async (periodLabel, index) => {
      // Using periodLabel to prevent unused variable warning
      void periodLabel;
      // Get the period start and end dates
      let periodStart = new Date(startDate);
      let periodEnd = new Date(startDate);

      // Adjust based on the current period index
      if (duration === 'monthly') {
        periodStart.setMonth(startDate.getMonth() + index);
        periodEnd.setMonth(startDate.getMonth() + index + 1);
        periodEnd.setDate(0); // Last day of the month
      } else if (duration === 'yearly') {
        periodStart.setFullYear(startDate.getFullYear() + index);
        periodEnd.setFullYear(startDate.getFullYear() + index + 1);
        periodEnd.setMonth(0);
        periodEnd.setDate(0); // Last day of December
      } else if (duration === 'weekly') {
        periodStart.setDate(startDate.getDate() + (index * 7));
        periodEnd.setDate(startDate.getDate() + ((index + 1) * 7) - 1);
      }

      // Set hours for accurate comparison
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Get the loans and chit funds for this period
      const periodLoansWithRepayments = prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          OR: [
            {
              disbursementDate: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            {
              repayments: {
                some: {
                  paidDate: {
                    gte: periodStart,
                    lte: periodEnd
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
      });

      const periodChitFunds = prisma.chitFund.findMany({
        where: {
          createdById: currentUserId,
          OR: [
            {
              contributions: {
                some: {
                  paidDate: {
                    gte: periodStart,
                    lte: periodEnd
                  }
                }
              }
            },
            {
              auctions: {
                some: {
                  date: {
                    gte: periodStart,
                    lte: periodEnd
                  }
                }
              }
            }
          ]
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          monthlyContribution: true,
          duration: true,
          currentMonth: true,
          status: true,
          membersCount: true,
          members: {
            select: {
              id: true
            }
          },
          contributions: {
            where: {
              paidDate: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            select: {
              id: true,
              amount: true,
              month: true,
              paidDate: true
            }
          },
          auctions: {
            where: {
              date: {
                gte: periodStart,
                lte: periodEnd
              }
            },
            select: {
              id: true,
              amount: true,
              month: true,
              date: true
            }
          }
        }
      });

      // Get period transactions
      const periodContributions = prisma.contribution.findMany({
        where: {
          chitFund: {
            createdById: currentUserId
          },
          paidDate: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        select: {
          id: true
        }
      });

      const periodRepayments = prisma.repayment.findMany({
        where: {
          loan: {
            createdById: currentUserId
          },
          paidDate: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        select: {
          id: true
        }
      });

      const periodAuctions = prisma.auction.findMany({
        where: {
          chitFund: {
            createdById: currentUserId
          },
          date: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        select: {
          id: true
        }
      });

      const periodLoanDisbursements = prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          disbursementDate: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        select: {
          id: true,
          amount: true
        }
      });

      // Execute all queries in parallel
      return Promise.all([
        periodLoansWithRepayments,
        periodChitFunds,
        periodContributions,
        periodRepayments,
        periodAuctions,
        periodLoanDisbursements
      ]).then(([
        loansWithRepayments,
        chitFunds,
        contributions,
        repayments,
        auctions,
        loanDisbursements
      ]) => {
        // Calculate detailed financial metrics using centralized utility functions
        const loanProfit = calculateTotalLoanProfit(loansWithRepayments);
        const chitFundProfit = calculateTotalChitFundProfit(chitFunds);

        // Calculate cash flow details
        const contributionInflow = chitFunds.reduce((sum, fund) =>
          sum + fund.contributions.reduce((s, c) => s + c.amount, 0), 0);

        const repaymentInflow = loansWithRepayments.reduce((sum, loan) =>
          sum + loan.repayments.reduce((s, r) => s + r.amount, 0), 0);

        const auctionOutflow = chitFunds.reduce((sum, fund) =>
          sum + fund.auctions.reduce((s, a) => s + a.amount, 0), 0);

        const loanOutflow = loanDisbursements.reduce((sum, loan) => sum + loan.amount, 0);

        // Calculate outside amount breakdown
        const loanRemainingAmount = Math.max(0, loanOutflow - repaymentInflow);
        const chitFundOutsideAmount = Math.max(0, auctionOutflow - contributionInflow);

        // Calculate profit details
        const interestPayments = loansWithRepayments.reduce((sum, loan) => {
          // For monthly loans, interest is part of each payment
          if (loan.repaymentType === 'Monthly') {
            return sum + (loan.repayments.length * (loan.interestRate || 0));
          }
          return sum;
        }, 0);

        const documentCharges = loansWithRepayments.reduce((sum, loan) =>
          sum + (loan.documentCharge || 0), 0);

        const auctionCommissions = chitFundProfit;

        return {
          period: periods[index],
          cashInflow: periodData.cashInflow[index],
          cashOutflow: periodData.cashOutflow[index],
          profit: periodData.profit[index],
          outsideAmount: periodData.outsideAmount[index],
          loanProfit,
          chitFundProfit,
          outsideAmountBreakdown: {
            loanRemainingAmount,
            chitFundOutsideAmount
          },
          cashFlowDetails: {
            contributionInflow,
            repaymentInflow,
            auctionOutflow,
            loanOutflow,
            netCashFlow: periodData.cashInflow[index] - periodData.cashOutflow[index]
          },
          profitDetails: {
            interestPayments,
            documentCharges,
            auctionCommissions
          },
          transactionCounts: {
            loanDisbursements: loanDisbursements.length,
            loanRepayments: repayments.length,
            chitFundContributions: contributions.length,
            chitFundAuctions: auctions.length,
            totalTransactions: loanDisbursements.length + repayments.length +
                              contributions.length + auctions.length
          },
          periodRange: {
            startDate: periodStart.toISOString(),
            endDate: periodEnd.toISOString()
          }
        };
      });
    });

    // Wait for all period data to be processed
    const detailedData = await Promise.all(detailedPeriodsData);

    return NextResponse.json({
      labels: periods,
      cashInflow: periodData.cashInflow,
      cashOutflow: periodData.cashOutflow,
      profit: periodData.profit,
      outsideAmount: periodData.outsideAmount,
      periodsData: detailedData
    });
  } catch (error) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

// Import date-fns format function
import { format } from 'date-fns';

// Helper function to get activities with pagination
async function getActivitiesWithPagination(userId: number, page: number, pageSize: number, filter: string) {
  try {
    const timerLabel = `getActivitiesWithPagination-${Date.now()}`;
    console.time(timerLabel);

    // Calculate skip value for pagination
    const skip = (page - 1) * pageSize;

    // Prepare filter conditions
    const filterCondition = filter !== 'all' ? { type: filter } : {};

    // Get recent loan repayments with pagination
    const loanRepayments = await prisma.repayment.findMany({
      where: {
        loan: {
          createdById: userId
        },
        ...filterCondition
      },
      select: {
        id: true,
        amount: true,
        paidDate: true,
        paymentType: true,
        period: true,
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
        paidDate: 'desc'
      }
    });

    // Get recent chit fund contributions with pagination
    const chitFundContributions = await prisma.contribution.findMany({
      where: {
        chitFund: {
          createdById: userId
        },
        ...filterCondition
      },
      select: {
        id: true,
        amount: true,
        paidDate: true,
        month: true,
        chitFundId: true,
        chitFund: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        paidDate: 'desc'
      }
    });

    // Get recent auctions with pagination
    const auctions = await prisma.auction.findMany({
      where: {
        chitFund: {
          createdById: userId
        },
        ...filterCondition
      },
      select: {
        id: true,
        amount: true,
        date: true,
        month: true,
        chitFundId: true,
        chitFund: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Get recent loan disbursements with pagination
    const loanDisbursements = await prisma.loan.findMany({
      where: {
        createdById: userId,
        ...filterCondition
      },
      select: {
        id: true,
        amount: true,
        disbursementDate: true,
        borrower: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        disbursementDate: 'desc'
      }
    });

    // Format loan repayments as activities
    const repaymentActivities = loanRepayments.map(repayment => ({
      id: `repayment-${repayment.id}`,
      type: 'Loan',
      action: 'Repayment Received',
      details: `Received payment from ${repayment.loan.borrower?.name || 'Unknown'} for period ${repayment.period}`,
      date: format(new Date(repayment.paidDate), 'dd MMM yyyy'),
      amount: repayment.amount,
      entityId: repayment.loan.id,
      entityType: 'loan'
    }));

    // Format chit fund contributions as activities
    const contributionActivities = chitFundContributions.map(contribution => ({
      id: `contribution-${contribution.id}`,
      type: 'Chit Fund',
      action: 'Contribution Received',
      details: `Received contribution for ${contribution.chitFund?.name || 'Unknown Fund'} (Month ${contribution.month})`,
      date: format(new Date(contribution.paidDate), 'dd MMM yyyy'),
      amount: contribution.amount,
      entityId: contribution.chitFund?.id,
      entityType: 'chitFund'
    }));

    // Format auctions as activities
    const auctionActivities = auctions.map(auction => ({
      id: `auction-${auction.id}`,
      type: 'Chit Fund',
      action: 'Auction Completed',
      details: `${auction.chitFund?.name || 'Unknown Fund'} auction for Month ${auction.month}`,
      date: format(new Date(auction.date), 'dd MMM yyyy'),
      amount: auction.amount,
      entityId: auction.chitFund?.id,
      entityType: 'chitFund'
    }));

    // Format loan disbursements as activities
    const loanActivities = loanDisbursements.map(loan => ({
      id: `loan-${loan.id}`,
      type: 'Loan',
      action: 'Loan Disbursed',
      details: `Disbursed loan to ${loan.borrower?.name || 'Unknown'}`,
      date: format(new Date(loan.disbursementDate), 'dd MMM yyyy'),
      amount: loan.amount,
      entityId: loan.id,
      entityType: 'loan'
    }));

    // Combine all activities
    const allActivities = [
      ...repaymentActivities,
      ...contributionActivities,
      ...auctionActivities,
      ...loanActivities
    ];

    // Apply type filter if needed
    const filteredActivities = filter !== 'all'
      ? allActivities.filter(activity => activity.type === filter)
      : allActivities;

    // Sort by date (newest first)
    const sortedActivities = filteredActivities.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Get total count for pagination
    const totalCount = sortedActivities.length;

    // Apply pagination
    const paginatedActivities = sortedActivities.slice(skip, skip + pageSize);

    console.timeEnd(timerLabel);

    // Return paginated activities with total count
    return {
      activities: paginatedActivities,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  } catch (error) {
    console.error('Error fetching activities with pagination:', error);
    throw error;
  }
}

// Helper function to get recent activities
async function getRecentActivitiesData(userId: number) {
  try {
    const timerLabel = `getRecentActivitiesData-${Date.now()}`;
    console.time(timerLabel); // Add timing with unique label

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

    console.timeEnd(timerLabel); // End timing with the same unique label
    return result;
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

// Helper function to get upcoming events for the dashboard (limited to a few)
async function getUpcomingEventsForDashboard(userId: number, limit: number = 3) {
  try {
    const timerLabel = `getUpcomingEventsForDashboard-${Date.now()}`;
    console.time(timerLabel);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparisons

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // For dashboard, we only need events for the next 3 months
    const nextThreeMonths = new Date();
    nextThreeMonths.setMonth(today.getMonth() + 3);

    // Fetch upcoming events from today to next three months

    // Get upcoming auctions and active loans in parallel
    const [upcomingAuctions, activeLoans] = await Promise.all([
      // Get upcoming auctions
      prisma.chitFund.findMany({
        where: {
          status: 'Active',
          createdById: userId,
          nextAuctionDate: {
            gte: today,
            lte: nextThreeMonths,
          },
        },
        select: {
          id: true,
          name: true,
          nextAuctionDate: true,
        },
        orderBy: {
          nextAuctionDate: 'asc',
        },
      }),

      // Get all active loans to generate payment schedules
      prisma.loan.findMany({
        where: {
          status: 'Active',
          createdById: userId,
        },
        select: {
          id: true,
          disbursementDate: true,
          duration: true,
          repaymentType: true,
          installmentAmount: true,
          borrower: {
            select: {
              id: true,
              name: true
            }
          },
          repayments: {
            select: {
              id: true,
              period: true,
              paidDate: true,
              paymentType: true
            }
          }
        }
      })
    ]);

    // Initialize events array with auctions
    const events = [
      ...upcomingAuctions.map((auction: any) => {
        // Check if auction is due tomorrow
        const auctionDate = auction.nextAuctionDate ? new Date(auction.nextAuctionDate) : null;
        let isDueTomorrow = false;

        if (auctionDate) {
          auctionDate.setHours(0, 0, 0, 0); // Set to beginning of day
          isDueTomorrow = auctionDate.getTime() === tomorrow.getTime();
        }

        return {
          id: `auction-${auction.id}`,
          title: `${auction.name} Auction`,
          date: auction.nextAuctionDate ? formatDate(auction.nextAuctionDate) : 'Date not set',
          type: 'Chit Fund',
          isDueTomorrow: isDueTomorrow,
          entityId: auction.id,
          entityType: 'chitFund'
        };
      }),
    ];

    // Process active loans for payment schedules

    // Process each active loan to generate payment schedules
    for (const loan of activeLoans) {
      // Use type assertion to access properties safely
      const loanAny = loan as any;

      const loanId = loanAny.id;
      const disbursementDate = new Date(loanAny.disbursementDate);
      const duration = loanAny.duration;
      const repaymentType = loanAny.repaymentType;

      // Get borrower name safely
      const borrowerName = loanAny.borrower && loanAny.borrower.name
        ? loanAny.borrower.name
        : 'Unknown Borrower';

      // Create a map of repayments by period for quick lookup
      const repaymentsByPeriod = new Map();
      if (loanAny.repayments && Array.isArray(loanAny.repayments)) {
        loanAny.repayments.forEach((repayment: any) => {
          if (repayment && repayment.period) {
            repaymentsByPeriod.set(repayment.period, repayment);
          }
        });
      }

      // Generate all possible periods and their due dates
      for (let period = 1; period <= duration; period++) {
        const dueDate = new Date(disbursementDate);

        if (repaymentType === 'Monthly') {
          dueDate.setMonth(disbursementDate.getMonth() + period);
        } else if (repaymentType === 'Weekly') {
          dueDate.setDate(disbursementDate.getDate() + (period * 7));
        }

        // Check if this period has been paid
        const repayment = repaymentsByPeriod.get(period);
        const isPaid = !!repayment && repayment.paidDate;

        // Only add unpaid schedules that are in the date range
        if (!isPaid && dueDate >= today && dueDate <= nextThreeMonths) {
          const dueDateNormalized = new Date(dueDate);
          dueDateNormalized.setHours(0, 0, 0, 0);
          const isDueTomorrow = dueDateNormalized.getTime() === tomorrow.getTime();

          // Get the installment amount
          const installmentAmount = loanAny.installmentAmount || 0;

          // Create event object
          const eventObj: any = {
            id: `schedule-${loanId}-${period}`,
            title: `${borrowerName} Loan Payment (Period ${period})`,
            date: formatDate(dueDate),
            type: 'Loan',
            isDueTomorrow: isDueTomorrow,
            entityId: loanId,
            entityType: 'loan',
            rawDate: dueDate,
            dueAmount: installmentAmount
          };

          // Add optional properties
          if (loanAny.borrower && loanAny.borrower.id) {
            eventObj.borrowerId = loanAny.borrower.id;
          }

          eventObj.period = period;

          events.push(eventObj);
        }
      }
    }

    // Sort by date (soonest first) and limit to requested number
    events.sort((a, b) => {
      // Use type assertion to access rawDate property
      const aAny = a as any;
      const bAny = b as any;

      // Use rawDate if available, otherwise parse the formatted date
      const dateA = aAny.rawDate ? new Date(aAny.rawDate).getTime() :
                   new Date(a.date.replace(/(\d+)\s+([A-Za-z]+)\s+(\d+)/, '$3-$2-$1')).getTime();
      const dateB = bAny.rawDate ? new Date(bAny.rawDate).getTime() :
                   new Date(b.date.replace(/(\d+)\s+([A-Za-z]+)\s+(\d+)/, '$3-$2-$1')).getTime();
      return dateA - dateB;
    });

    // Take only the requested number of events
    const limitedEvents = events.slice(0, limit);

    // Return the limited events sorted by date

    console.timeEnd(timerLabel);
    return limitedEvents;
  } catch (error) {
    console.error('Error getting upcoming events for dashboard:', error);
    return [];
  }
}

// Helper function to count total upcoming events for the next 3 months
async function countUpcomingEvents(userId: number) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextThreeMonths = new Date();
    nextThreeMonths.setMonth(today.getMonth() + 3);

    // Count upcoming auctions
    const auctionCount = await prisma.chitFund.count({
      where: {
        status: 'Active',
        createdById: userId,
        nextAuctionDate: {
          gte: today,
          lte: nextThreeMonths,
        },
      },
    });

    // Count active loans with upcoming payments
    const loanCount = await prisma.loan.count({
      where: {
        status: 'Active',
        createdById: userId,
        nextPaymentDate: {
          gte: today,
          lte: nextThreeMonths,
        },
      },
    });

    // Return the total count
    return auctionCount + loanCount;
  } catch (error) {
    console.error('Error counting upcoming events:', error);
    return 0;
  }
}

// Helper function to get events for a specific month
async function getEventsForMonth(userId: number, year: number, month: number) {
  try {
    const timerLabel = `getEventsForMonth-${year}-${month}-${Date.now()}`;
    console.time(timerLabel);

    // Create a date range for the specified month
    // Create start date (first day of the specified month)
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in JavaScript Date

    // Create end date (last day of the specified month)
    const endDate = new Date(year, month, 0); // Day 0 of next month = last day of current month
    endDate.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch events for the specified date range

    // Get auctions and active loans in parallel for the specified month
    const [monthAuctions, activeLoans] = await Promise.all([
      // Get auctions for the month
      prisma.chitFund.findMany({
        where: {
          status: 'Active',
          createdById: userId,
          nextAuctionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          name: true,
          nextAuctionDate: true,
        },
        orderBy: {
          nextAuctionDate: 'asc',
        },
      }),

      // Get all active loans to check their payment schedules
      prisma.loan.findMany({
        where: {
          status: 'Active',
          createdById: userId,
        },
        select: {
          id: true,
          disbursementDate: true,
          duration: true,
          repaymentType: true,
          installmentAmount: true,
          borrower: {
            select: {
              id: true,
              name: true
            }
          },
          repayments: {
            select: {
              period: true,
              paidDate: true,
              paymentType: true
            }
          }
        }
      })
    ]);

    // Process auctions and active loans

    // Initialize events array with auctions
    const events = [
      ...monthAuctions.map((auction: any) => {
        // Check if auction is due tomorrow
        const auctionDate = auction.nextAuctionDate ? new Date(auction.nextAuctionDate) : null;
        let isDueTomorrow = false;

        if (auctionDate) {
          const auctionDateNormalized = new Date(auctionDate);
          auctionDateNormalized.setHours(0, 0, 0, 0);
          isDueTomorrow = auctionDateNormalized.getTime() === tomorrow.getTime();
        }

        return {
          id: `auction-${auction.id}`,
          title: `${auction.name} Auction`,
          date: auction.nextAuctionDate ? formatDate(auction.nextAuctionDate) : 'Date not set',
          type: 'Chit Fund',
          rawDate: auction.nextAuctionDate,
          isDueTomorrow: isDueTomorrow,
          entityId: auction.id,
          entityType: 'chitFund'
        };
      }),
    ];

    // Process each active loan to check for payment schedules in this month
    for (const loan of activeLoans) {
      // Process loan payment schedules

      // Create a map of repayments by period for quick lookup
      const repaymentsByPeriod = new Map();
      loan.repayments.forEach((repayment: any) => {
        if (repayment.period) {
          repaymentsByPeriod.set(repayment.period, repayment);
        }
      });

      const disbursementDate = new Date(loan.disbursementDate);
      const repaymentType = loan.repaymentType;
      const duration = loan.duration;
      const borrowerName = loan.borrower ? loan.borrower.name : 'Unknown Borrower';
      const borrowerId = loan.borrower ? loan.borrower.id : null;

      // Generate schedules for each period
      for (let period = 1; period <= duration; period++) {
        // Calculate the due date for this period
        const dueDate = new Date(disbursementDate);
        if (repaymentType === 'Monthly') {
          dueDate.setMonth(disbursementDate.getMonth() + period);
        } else if (repaymentType === 'Weekly') {
          dueDate.setDate(disbursementDate.getDate() + (period * 7));
        }

        // Check if this period has been paid
        const repayment = repaymentsByPeriod.get(period);
        const isPaid = !!repayment && repayment.paidDate;
        const paymentType = repayment ? repayment.paymentType : null;

        // Check if the due date is in the specified month
        const isInMonth = dueDate >= startDate && dueDate <= endDate;

        // Only process events that are in the specified month
        if (isInMonth) {
          const dueDateNormalized = new Date(dueDate);
          dueDateNormalized.setHours(0, 0, 0, 0);
          const isDueTomorrow = dueDateNormalized.getTime() === tomorrow.getTime();
          const isPastDue = dueDateNormalized < today;

          // Determine status for the event
          let status = null;
          if (isPaid) {
            status = 'Paid';
          } else if (isPastDue) {
            status = 'Overdue';
          }

          // Get the installment amount for this loan
          const installmentAmount = loan.installmentAmount || 0;

          // Create event object with type assertion to allow additional properties
          const eventObj: any = {
            id: `schedule-${loan.id}-${period}`,
            title: `${borrowerName} Loan Payment (Period ${period})`,
            date: formatDate(dueDate),
            type: 'Loan',
            rawDate: dueDate,
            isDueTomorrow: isDueTomorrow,
            entityId: loan.id,
            entityType: 'loan',
            period: period,
            dueAmount: installmentAmount
          };

          // Add status information for past events
          if (status) {
            eventObj.status = status;
          }

          // Add optional properties
          if (borrowerId) {
            eventObj.borrowerId = borrowerId;
          }

          // Add payment type information if available
          if (paymentType) {
            eventObj.paymentType = paymentType;
          }

          events.push(eventObj);
        }
      }
    }

    // Sort events by date
    events.sort((a, b) => {
      if (!a.rawDate) return 1;
      if (!b.rawDate) return -1;
      return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
    });

    // Remove rawDate from the response
    const formattedEvents = events.map(({ rawDate, ...rest }) => rest);

    // Return formatted events
    console.timeEnd(timerLabel);
    return formattedEvents;
  } catch (error) {
    console.error('Error getting events for month:', error);
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

// Helper function to export financial data
async function exportFinancialData(request: NextRequest, currentUserId: number) {
  try {
    const timerLabel = `exportFinancialData-${Date.now()}`;
    console.time(timerLabel);

    // Get parameters from query string
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    // For single period export
    const period = searchParams.get('period');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // If it's a single period export, use the provided dates
    let startDate: Date, endDate: Date;

    if (duration === 'single' && period && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // console.log(`Exporting single period: ${period} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // Calculate date range based on duration
      endDate = new Date();
      startDate = new Date();

      if (duration === 'monthly') {
        startDate.setMonth(endDate.getMonth() - limit + 1);
        startDate.setDate(1);
      } else if (duration === 'yearly') {
        startDate.setFullYear(endDate.getFullYear() - limit + 1);
        startDate.setMonth(0);
        startDate.setDate(1);
      } else if (duration === 'weekly') {
        startDate.setDate(endDate.getDate() - (limit * 7) + 1);
      }
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get financial data for the specified period
    const financialData = await getFinancialDataForExport(currentUserId, startDate, endDate, duration);

    // Create a workbook
    const wb = XLSX.utils.book_new();

    // Create a summary sheet
    const summaryData = [
      {
        'Period': duration === 'single' ? period : `${duration.charAt(0).toUpperCase() + duration.slice(1)} (Last ${limit})`,
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
    const detailedData = financialData.periodsData.map(period => ({
      'Period': period.period,
      'Cash Inflow': period.cashInflow,
      'Cash Outflow': period.cashOutflow,
      'Profit': period.profit,
      'Loan Profit': period.loanProfit,
      'Chit Fund Profit': period.chitFundProfit,
      'Outside Amount': period.outsideAmount,
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
      { width: 12 }, // Loan Profit
      { width: 15 }, // Chit Fund Profit
      { width: 15 }, // Outside Amount
      { width: 15 }, // Start Date
      { width: 15 }  // End Date
    ];

    // Apply bold formatting to header row
    const detailedRange = XLSX.utils.decode_range(detailedSheet['!ref'] || 'A1:I1');
    for (let col = detailedRange.s.c; col <= detailedRange.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!detailedSheet[cellRef]) continue;
      detailedSheet[cellRef].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data');

    // Create separate transaction sheets for loans and chit funds

    // Filter transactions for loans
    const loanTransactionsData = financialData.transactions
      .filter(transaction => transaction.category === 'Loan')
      .map(transaction => {
        // Use type assertion to handle TypeScript type checking
        const transactionAny = transaction as any;
        return {
          'Date': formatDate(transaction.date),
          'Type': transaction.type,
          'Borrower Name': transactionAny.borrowerName || 'Unknown',
          'Loan Amount': transactionAny.loanAmount || 'N/A',
          'Installment Amount': transactionAny.installmentAmount || 'N/A',
          'Description': transaction.description,
          'Amount': transaction.amount
        };
      });
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
      .filter(transaction => transaction.category === 'Chit Fund')
      .map(transaction => ({
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

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Set filename based on export type
    let fileName;
    if (duration === 'single' && period) {
      fileName = `Financial_Data_${period.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
    } else {
      fileName = `Financial_Data_${duration}_${dateStr}.xlsx`;
    }

    // Set response headers for file download
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.timeEnd(timerLabel);

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: headers
    });
  } catch (error) {
    console.error('Error exporting financial data:', error);
    return NextResponse.json(
      { error: 'Failed to export financial data' },
      { status: 500 }
    );
  }
}

// Helper function to get financial data for export
async function getFinancialDataForExport(userId: number, startDate: Date, endDate: Date, duration: string) {
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
      select: {
        id: true,
        name: true,
        totalAmount: true,
        monthlyContribution: true,
        duration: true,
        currentMonth: true,
        status: true,
        membersCount: true,
        members: {
          select: {
            id: true
          }
        },
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
  const chitFundProfit = calculateTotalChitFundProfit(chitFundsWithDetails);
  const totalProfit = loanProfit + chitFundProfit;

  // Calculate outside amount
  const outsideAmount = totalCashOutflow > totalCashInflow ? totalCashOutflow - totalCashInflow : 0;

  // Generate periods based on duration
  const periods: string[] = [];
  const periodsData: any[] = [];

  // Helper function to format period label
  const formatPeriodLabel = (date: Date) => {
    if (duration === 'monthly') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (duration === 'yearly') {
      return date.getFullYear().toString();
    } else if (duration === 'weekly') {
      return `Week ${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
    } else if (duration === 'single') {
      return 'Custom Period';
    }
    return '';
  };

  // Helper function to check if a date falls within a period
  const isInPeriod = (date: Date, periodStart: Date, periodEnd: Date) => {
    return date >= periodStart && date <= periodEnd;
  };

  // If it's a single period, just use the entire date range
  if (duration === 'single') {
    const periodLabel = 'Custom Period';

    // Calculate financial data for this period
    const periodContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const periodRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
    const periodAuctions = auctions.reduce((sum, a) => sum + a.amount, 0);
    const periodLoanAmount = loans.reduce((sum, l) => sum + l.amount, 0);

    // Calculate totals for the period
    const periodCashInflow = periodContributions + periodRepayments;
    const periodCashOutflow = periodAuctions + periodLoanAmount;
    const periodLoanProfit = loanProfit;
    const periodChitFundProfit = chitFundProfit;
    const periodProfit = periodLoanProfit + periodChitFundProfit;
    const periodOutsideAmount = periodCashOutflow > periodCashInflow ? periodCashOutflow - periodCashInflow : 0;

    // Add period data
    periods.push(periodLabel);
    periodsData.push({
      period: periodLabel,
      cashInflow: periodCashInflow,
      cashOutflow: periodCashOutflow,
      profit: periodProfit,
      loanProfit: periodLoanProfit,
      chitFundProfit: periodChitFundProfit,
      outsideAmount: periodOutsideAmount,
      periodRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  } else {
    // Generate periods and calculate data for each period
    let currentDate = new Date(startDate);
    let limit = 0;

    if (duration === 'monthly') {
      limit = Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    } else if (duration === 'yearly') {
      limit = Math.ceil((endDate.getTime() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
    } else if (duration === 'weekly') {
      limit = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }

    for (let i = 0; i < limit; i++) {
      let periodStart = new Date(currentDate);
      let periodEnd = new Date(currentDate);

      if (duration === 'monthly') {
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0); // Last day of the month
        periodEnd.setHours(23, 59, 59, 999);
      } else if (duration === 'yearly') {
        periodEnd.setFullYear(periodStart.getFullYear() + 1);
        periodEnd.setMonth(0);
        periodEnd.setDate(0); // Last day of December
        periodEnd.setHours(23, 59, 59, 999);
      } else if (duration === 'weekly') {
        periodEnd.setDate(periodStart.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
      }

      // If period end is after the overall end date, adjust it
      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      // Calculate financial data for this period
      const periodContributions = contributions.filter(c =>
        isInPeriod(new Date(c.paidDate), periodStart, periodEnd)
      ).reduce((sum, c) => sum + c.amount, 0);

      const periodRepayments = repayments.filter(r =>
        isInPeriod(new Date(r.paidDate), periodStart, periodEnd)
      ).reduce((sum, r) => sum + r.amount, 0);

      const periodAuctions = auctions.filter(a =>
        isInPeriod(new Date(a.date), periodStart, periodEnd)
      ).reduce((sum, a) => sum + a.amount, 0);

      const periodLoans = loans.filter(l =>
        isInPeriod(new Date(l.disbursementDate), periodStart, periodEnd)
      );

      const periodLoanAmount = periodLoans.reduce((sum, l) => sum + l.amount, 0);

      // Filter loans and chit funds for this period
      const periodLoansWithRepayments = loansWithRepayments.filter(loan => {
        // Check if loan was disbursed in this period
        const disbursementDate = loan.repayments.length > 0 ?
          new Date(loan.repayments[0].paidDate) : null;

        if (disbursementDate && isInPeriod(disbursementDate, periodStart, periodEnd)) {
          return true;
        }

        // Check if any repayments were made in this period
        return loan.repayments.some(r =>
          isInPeriod(new Date(r.paidDate), periodStart, periodEnd)
        );
      });

      const periodChitFunds = chitFundsWithDetails.filter(fund => {
        // Check if any contributions were made in this period
        if (fund.contributions.some(c =>
          isInPeriod(new Date(c.paidDate), periodStart, periodEnd)
        )) {
          return true;
        }

        // Check if any auctions were held in this period
        return fund.auctions.some(a =>
          isInPeriod(new Date(a.date), periodStart, periodEnd)
        );
      });

      // Calculate profits for this period
      const periodLoanProfit = calculateTotalLoanProfit(periodLoansWithRepayments);
      const periodChitFundProfit = calculateTotalChitFundProfit(periodChitFunds);

      // Calculate totals for the period
      const periodCashInflow = periodContributions + periodRepayments;
      const periodCashOutflow = periodAuctions + periodLoanAmount;
      const periodProfit = periodLoanProfit + periodChitFundProfit;
      const periodOutsideAmount = periodCashOutflow > periodCashInflow ?
                                periodCashOutflow - periodCashInflow : 0;

      // Add period data
      const periodLabel = formatPeriodLabel(periodStart);
      periods.push(periodLabel);
      periodsData.push({
        period: periodLabel,
        cashInflow: periodCashInflow,
        cashOutflow: periodCashOutflow,
        profit: periodProfit,
        loanProfit: periodLoanProfit,
        chitFundProfit: periodChitFundProfit,
        outsideAmount: periodOutsideAmount,
        periodRange: {
          startDate: periodStart.toISOString(),
          endDate: periodEnd.toISOString()
        }
      });

      // Move to next period
      if (duration === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (duration === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else if (duration === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      }

      // If we've passed the end date, break
      if (currentDate > endDate) {
        break;
      }
    }
  }

  // Create transactions list for the transactions sheet
  const transactions = [
    ...contributions.map(c => ({
      date: c.paidDate,
      type: 'Cash Inflow',
      description: `Contribution from ${c.member?.globalMember?.name || 'Unknown'} for ${c.chitFund?.name || 'Unknown Chit Fund'}`,
      amount: c.amount,
      category: 'Chit Fund'
    })),
    ...repayments.map(r => {
      // Find the loan for this repayment to get additional details
      const loan = loansWithRepayments.find(l => l.id === r.loan?.id);

      // Get the correct installment amount - this is the actual due amount for this repayment
      let installmentAmount: string | number = r.amount || 'N/A';

      return {
        date: r.paidDate,
        type: 'Cash Inflow',
        borrowerName: r.loan?.borrower?.name || 'Unknown',
        loanAmount: loan?.amount || 'N/A',
        installmentAmount: installmentAmount,
        description: `Loan repayment from ${r.loan?.borrower?.name || 'Unknown'} (Period ${r.period})`,
        amount: r.amount,
        category: 'Loan'
      };
    }),
    ...auctions.map(a => ({
      date: a.date,
      type: 'Cash Outflow',
      description: `Auction amount to ${a.winner?.globalMember?.name || 'Unknown'} for ${a.chitFund?.name || 'Unknown Chit Fund'}`,
      amount: a.amount,
      category: 'Chit Fund'
    })),
    ...loans.map(l => {
      // Get the actual installment amount directly from the loan if available
      // Use type assertion to handle TypeScript type checking
      const loanAny = l as any;
      const installmentAmount = loanAny.installmentAmount || 'N/A';

      return {
        date: l.disbursementDate,
        type: 'Cash Outflow',
        borrowerName: l.borrower?.name || 'Unknown',
        loanAmount: l.amount,
        installmentAmount: installmentAmount,
        description: `Loan disbursed to ${l.borrower?.name || 'Unknown'}`,
        amount: l.amount,
        category: 'Loan'
      };
    })
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalCashInflow,
    totalCashOutflow,
    totalProfit,
    loanProfit,
    chitFundProfit,
    outsideAmount,
    periodsData,
    transactions
  };
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