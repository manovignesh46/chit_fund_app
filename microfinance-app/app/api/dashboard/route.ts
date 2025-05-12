import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Ensure the route is not statically optimized

export async function GET() {
  try {
    // Get total cash inflow from chit fund contributions
    const contributionsSum = await prisma.contribution.aggregate({
      _sum: {
        amount: true,
      },
    });

    // Get total cash inflow from loan repayments
    const repaymentsSum = await prisma.repayment.aggregate({
      _sum: {
        amount: true,
      },
    });

    // Get total cash outflow from auctions
    const auctionsSum = await prisma.auction.aggregate({
      _sum: {
        amount: true,
      },
    });

    // Get total cash outflow from loan disbursements
    const loansSum = await prisma.loan.aggregate({
      _sum: {
        amount: true,
      },
    });

    // Get active chit funds count
    const activeChitFunds = await prisma.chitFund.count({
      where: {
        status: 'Active',
      },
    });

    // Get total members count
    const totalMembers = await prisma.member.count();

    // Get active loans count
    const activeLoans = await prisma.loan.count({
      where: {
        status: 'Active',
      },
    });

    // Get recent activities
    const recentActivities = await getRecentActivities();

    // Get upcoming events
    const upcomingEvents = await getUpcomingEvents();

    // Get loans with all necessary data for profit calculation
    const loansWithDetails = await prisma.loan.findMany({
      include: {
        repayments: {
          select: {
            amount: true,
            paymentType: true,
          },
        },
      },
    });

    // Calculate loan profit based on loan type and repayments
    console.log('Calculating loan profit for', loansWithDetails.length, 'loans');

    // Debug each loan's details
    loansWithDetails.forEach((loan, index) => {
      console.log(`Loan ${index + 1}:`, {
        id: loan.id,
        type: loan.repaymentType,
        amount: loan.amount,
        interestRate: loan.interestRate,
        documentCharge: loan.documentCharge,
        repayments: loan.repayments.length,
        repaymentDetails: loan.repayments.map(r => ({ amount: r.amount, type: r.paymentType }))
      });
    });

    const loanProfit = loansWithDetails.reduce((sum, loan) => {
      let loanProfit = 0;

      if (loan.repaymentType === 'Monthly') {
        // For monthly loans:
        // 1. Document charge is a one-time profit
        const documentCharge = loan.documentCharge || 0;
        loanProfit += documentCharge;
        console.log(`Monthly loan ${loan.id} - Document charge: ${documentCharge}`);

        // 2. For interest, we either count interest-only payments OR monthly interest, not both
        const hasInterestOnlyPayments = loan.repayments.some(payment => payment.paymentType === 'interestOnly');

        // SPECIAL CASE: For loans with only interest-only payments
        const onlyHasInterestOnlyPayments =
          loan.repayments.length > 0 &&
          loan.repayments.every(payment => payment.paymentType === 'interestOnly');

        if (onlyHasInterestOnlyPayments) {
          // For loans with only interest-only payments, the profit is the interest rate
          // multiplied by the number of interest-only payments made
          const interestOnlyPaymentsCount = loan.repayments.length;
          const interestProfit = (loan.interestRate || 0) * interestOnlyPaymentsCount;
          loanProfit += interestProfit;
          console.log(`Monthly loan ${loan.id} - Interest-only payments profit: ${interestProfit}`);
        } else {
          // For interest-only payments, only count the interest rate, not the full payment amount
          const interestOnlyPaymentsCount = loan.repayments
            .filter(payment => payment.paymentType === 'interestOnly')
            .length;

          // For interest-only payments, the profit is just the interest rate
          // NOT the full payment amount
          const interestOnlyProfit = (loan.interestRate || 0) * interestOnlyPaymentsCount;
          loanProfit += interestOnlyProfit;
          console.log(`Monthly loan ${loan.id} - Interest-only payments (${interestOnlyPaymentsCount} payments): ${interestOnlyProfit}`);

          // Add interest from regular payments
          const regularPayments = loan.repayments.filter(payment => payment.paymentType !== 'interestOnly');
          const regularPaymentsCount = regularPayments.length;

          if (regularPaymentsCount > 0) {
            // Count ONLY the interest portion for each regular payment made
            // NOT the full installment amount
            const regularInterestProfit = (loan.interestRate || 0) * regularPaymentsCount;
            loanProfit += regularInterestProfit;
            console.log(`Monthly loan ${loan.id} - Regular payments interest: ${regularInterestProfit}`);
          }
        }
      } else if (loan.repaymentType === 'Weekly') {
        // For weekly loans:
        // Profit is calculated based on the difference between total amount to be repaid and principal

        // Add document charge if any
        const documentCharge = loan.documentCharge || 0;
        loanProfit += documentCharge;
        console.log(`Weekly loan ${loan.id} - Document charge: ${documentCharge}`);

        // Calculate profit based on actual repayments
        const totalRepaid = loan.repayments
          .filter(payment => payment.paymentType !== 'interestOnly')
          .reduce((total, payment) => total + payment.amount, 0);

        console.log(`Weekly loan ${loan.id} - Total repaid: ${totalRepaid}, Principal: ${loan.amount}`);

        // If there are repayments, calculate profit as the difference between total repaid and principal
        if (totalRepaid > 0) {
          // Only count as profit the amount that exceeds the principal
          const principalRepaid = Math.min(totalRepaid, loan.amount);
          const profitFromRepayments = totalRepaid - principalRepaid;
          loanProfit += profitFromRepayments;
          console.log(`Weekly loan ${loan.id} - Profit from repayments: ${profitFromRepayments}`);
        } else {
          // If no repayments yet, don't add any profit
          console.log(`Weekly loan ${loan.id} - No repayments yet, no profit calculated`);
        }
      }

      console.log(`Loan ${loan.id} total profit: ${loanProfit}`);
      return sum + loanProfit;
    }, 0);

    console.log('Total loan profit:', loanProfit);

    // Get all chit funds with members, auctions, and contributions to calculate chit fund profit
    const chitFundsWithDetails = await prisma.chitFund.findMany({
      include: {
        members: true,
        auctions: true,
        contributions: true,
      },
    });

    // Calculate chit fund profit (commission from auctions)
    let chitFundProfit = 0;
    let totalOutsideAmount = 0;

    // Calculate outside amount from chit funds
    chitFundsWithDetails.forEach(fund => {
      let fundProfit = 0;
      let fundInflow = 0;
      let fundOutflow = 0;

      // Calculate inflow from contributions
      if (fund.contributions && fund.contributions.length > 0) {
        fundInflow = fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
      }

      // Calculate outflow and profit from auctions
      if (fund.auctions && fund.auctions.length > 0 && fund.members && fund.members.length > 0) {
        fund.auctions.forEach(auction => {
          fundOutflow += auction.amount;

          // Each auction's profit is the difference between the total monthly contribution and the auction amount
          const monthlyTotal = fund.monthlyContribution * fund.members.length;
          const auctionProfit = monthlyTotal - auction.amount;
          fundProfit += auctionProfit > 0 ? auctionProfit : 0;
        });
      }

      // If there are no auctions or the calculated profit is 0, but there's a difference between inflow and outflow,
      // use that difference as the profit (especially for completed chit funds)
      if ((fund.auctions.length === 0 || fundProfit === 0) && fundInflow > fundOutflow) {
        fundProfit = fundInflow - fundOutflow;
      }

      // Calculate outside amount (when outflow exceeds inflow)
      if (fundOutflow > fundInflow) {
        totalOutsideAmount += (fundOutflow - fundInflow);
      }

      chitFundProfit += fundProfit;
    });

    // Add remaining loan amounts to the outside amount
    // This represents money that has been disbursed but not yet repaid
    const totalLoanAmount = loansWithDetails.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepaymentAmount = loansWithDetails.reduce((sum, loan) => {
      const loanRepayments = loan.repayments || [];
      return sum + loanRepayments.reduce((repaymentSum, repayment) => {
        // Only count full payments toward reducing the principal
        if (repayment.paymentType !== 'interestOnly') {
          return repaymentSum + repayment.amount;
        }
        return repaymentSum;
      }, 0);
    }, 0);

    // Calculate the remaining loan amount
    const remainingLoanAmount = totalLoanAmount - totalRepaymentAmount;

    // Calculate the chit fund outside amount (already calculated above)
    const chitFundOutsideAmount = totalOutsideAmount;

    // Add the remaining loan amount to the total outside amount
    if (remainingLoanAmount > 0) {
      totalOutsideAmount += remainingLoanAmount;
    }

    // Create an object to store the breakdown of outside amount
    const outsideAmountBreakdown = {
      loanRemainingAmount: remainingLoanAmount > 0 ? remainingLoanAmount : 0,
      chitFundOutsideAmount: chitFundOutsideAmount
    };

    // Calculate total cash flows including loan transactions
    const totalCashInflow = (contributionsSum._sum.amount || 0) + (repaymentsSum._sum.amount || 0);
    const totalCashOutflow = (auctionsSum._sum.amount || 0) + (loansSum._sum.amount || 0);
    const totalProfit = loanProfit + chitFundProfit;

    return NextResponse.json({
      totalCashInflow,
      totalCashOutflow,
      totalProfit,
      loanProfit,
      chitFundProfit,
      totalOutsideAmount,
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

async function getRecentActivities() {
  try {
    // Get recent members (new chit fund members)
    const recentMembers = await prisma.member.findMany({
      take: 3,
      orderBy: {
        joinDate: 'desc',
      },
      include: {
        chitFund: true,
        globalMember: true,
      },
    });

    // Get recent auctions
    const recentAuctions = await prisma.auction.findMany({
      take: 3,
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
    const recentLoans = await prisma.loan.findMany({
      take: 3,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        borrower: true,
      },
    });

    // Get recent repayments
    const recentRepayments = await prisma.repayment.findMany({
      take: 3,
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

async function getUpcomingEvents() {
  try {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    // Get upcoming auctions
    const upcomingAuctions = await prisma.chitFund.findMany({
      where: {
        status: 'Active',
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
    const upcomingPayments = await prisma.loan.findMany({
      where: {
        status: 'Active',
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
      ...upcomingAuctions.map(auction => ({
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