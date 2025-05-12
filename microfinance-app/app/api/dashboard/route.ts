import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';
// import { apiCache } from '@/lib/cache';
import { getCurrentUserId } from '@/lib/auth';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Get the current user ID for data isolation
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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
      loansWithDetails,
      chitFundsWithDetails
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

      // Get loans with all necessary data for profit calculation
      prisma.loan.findMany({
        where: { createdById: currentUserId },
        include: {
          repayments: {
            select: {
              amount: true,
              paymentType: true,
            },
          },
        },
      }),

      // Get all chit funds with members, auctions, and contributions
      prisma.chitFund.findMany({
        where: { createdById: currentUserId },
        include: {
          members: true,
          auctions: true,
          contributions: true,
        },
      })
    ]);

    // Get recent activities and upcoming events in parallel
    const [recentActivities, upcomingEvents] = await Promise.all([
      getRecentActivities(prisma, currentUserId),
      getUpcomingEvents(prisma, currentUserId)
    ]);

    // Calculate loan profit using the centralized utility function
    const loanProfit = loansWithDetails.reduce((sum, loan) => {
      // Use the centralized utility function to calculate profit
      const profit = calculateLoanProfit(loan, loan.repayments);
      return sum + profit;
    }, 0);

    // Calculate chit fund profit and outside amount
    let chitFundProfit = 0;
    let totalOutsideAmount = 0;

    // Calculate profit and outside amount for each chit fund
    chitFundsWithDetails.forEach(fund => {
      const fundProfit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
      const fundOutsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);

      chitFundProfit += fundProfit;
      totalOutsideAmount += fundOutsideAmount;
    });

    // Calculate remaining loan amount more efficiently
    const totalLoanAmount = loansWithDetails.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepaymentAmount = loansWithDetails.reduce((sum, loan) => {
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
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getRecentActivities(prismaClient: any, userId: number) {
  try {
    // Get recent members (new chit fund members)
    const recentMembers = await prismaClient.member.findMany({
      take: 3,
      where: {
        chitFund: {
          createdById: userId
        }
      },
      orderBy: {
        joinDate: 'desc',
      },
      include: {
        chitFund: true,
        globalMember: true,
      },
    });

    // Get recent auctions
    const recentAuctions = await prismaClient.auction.findMany({
      take: 3,
      where: {
        chitFund: {
          createdById: userId
        }
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        chitFund: true,
        winner: {
          include: {
            globalMember: true
          }
        },
      },
    });

    // Get recent loans
    const recentLoans = await prismaClient.loan.findMany({
      take: 3,
      where: {
        createdById: userId
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        borrower: true,
      },
    });

    // Get recent repayments
    const recentRepayments = await prismaClient.repayment.findMany({
      take: 3,
      where: {
        loan: {
          createdById: userId
        }
      },
      orderBy: {
        paidDate: 'desc',
      },
      include: {
        loan: {
          include: {
            borrower: true
          }
        },
      },
    });

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
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(activity => ({
        ...activity,
        date: formatRelativeTime(activity.date),
      }));
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

async function getUpcomingEvents(prismaClient: any, userId: number) {
  try {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    // Get upcoming auctions
    const upcomingAuctions = await prismaClient.chitFund.findMany({
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
    });

    // Get upcoming loan payments
    const upcomingPayments = await prismaClient.loan.findMany({
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
    });

    // Combine and format all events
    const events = [
      ...upcomingAuctions.map((auction: any) => ({
        id: `auction-${auction.id}`,
        title: `${auction.name} Auction`,
        date: auction.nextAuctionDate ? formatDate(auction.nextAuctionDate) : 'Date not set',
        type: 'Chit Fund',
      })),
      ...upcomingPayments.map((payment: any) => {
        // Get borrower name safely
        const borrowerName = payment.borrower ? payment.borrower.name : 'Unknown Borrower';

        return {
          id: `payment-${payment.id}`,
          title: `${borrowerName} Loan Payment`,
          date: payment.nextPaymentDate ? formatDate(payment.nextPaymentDate) : 'Date not set',
          type: 'Loan',
        };
      }),
    ];

    // Sort by date (soonest first) and take top 3
    return events
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
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