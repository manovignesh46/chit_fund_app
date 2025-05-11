import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get('duration') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '12');

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get data based on duration
    const data = await getFinancialDataByDuration(duration, limit, currentUserId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

async function getFinancialDataByDuration(duration: string, limit: number, userId: number) {
  // Get current date
  const now = new Date();
  const periods: { label: string; startDate: Date; endDate: Date }[] = [];

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
      const contributions = await prisma.contribution.findMany({
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
      const repayments = await prisma.repayment.findMany({
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
      const auctions = await prisma.auction.findMany({
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
      const loans = await prisma.loan.findMany({
        where: {
          disbursementDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          createdById: userId,
        },
      });

      // Calculate cash inflow (contributions + repayments)
      const contributionInflow = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
      const repaymentInflow = repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
      const cashInflow = contributionInflow + repaymentInflow;

      // Calculate cash outflow (auctions + loans)
      const auctionOutflow = auctions.reduce((sum, auction) => sum + auction.amount, 0);
      const loanOutflow = loans.reduce((sum, loan) => sum + loan.amount, 0);
      const cashOutflow = auctionOutflow + loanOutflow;

      // Calculate profit
      // For loans: interest payments + document charges
      let loanProfit = 0;
      let interestPayments = 0;
      let documentCharges = 0;

      repayments.forEach(repayment => {
        if (repayment.paymentType === 'interestOnly') {
          // Interest-only payments are pure profit
          loanProfit += repayment.amount;
          interestPayments += repayment.amount;
        } else if (repayment.loan) {
          // For regular payments, calculate the interest portion
          const interestRate = repayment.loan.interestRate;
          const interestAmount = (repayment.loan.remainingAmount * interestRate) / 100;
          const interestPortion = Math.min(repayment.amount, interestAmount);
          loanProfit += interestPortion;
          interestPayments += interestPortion;
        }
      });

      // Add document charges for loans disbursed in this period
      documentCharges = loans.reduce((sum, loan) => sum + loan.documentCharge, 0);
      loanProfit += documentCharges;

      // For chit funds: auction profit (commission)
      let chitFundProfit = 0;
      let auctionCommissions = 0;

      auctions.forEach(auction => {
        if (auction.chitFund) {
          const monthlyTotal = auction.chitFund.monthlyContribution * auction.chitFund.membersCount;
          const auctionProfit = monthlyTotal - auction.amount;
          if (auctionProfit > 0) {
            chitFundProfit += auctionProfit;
            auctionCommissions += auctionProfit;
          }
        }
      });

      const totalProfit = loanProfit + chitFundProfit;

      // Count transactions
      const loanDisbursements = loans.length;
      const loanRepayments = repayments.length;
      const chitFundContributions = contributions.length;
      const chitFundAuctions = auctions.length;

      // Calculate outside amount
      // For loans: remaining balances
      const loanRemainingAmount = await prisma.loan.aggregate({
        where: {
          createdById: userId,
          status: 'Active',
          createdAt: {
            lte: period.endDate,
          },
        },
        _sum: {
          remainingAmount: true,
        },
      });

      // For chit funds: outflow exceeding inflow
      const chitFundsWithDetails = await prisma.chitFund.findMany({
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

      let chitFundOutsideAmount = 0;
      chitFundsWithDetails.forEach(fund => {
        const fundInflow = fund.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
        const fundOutflow = fund.auctions.reduce((sum, auction) => sum + auction.amount, 0);

        if (fundOutflow > fundInflow) {
          chitFundOutsideAmount += (fundOutflow - fundInflow);
        }
      });

      const totalOutsideAmount = (loanRemainingAmount._sum.remainingAmount || 0) + chitFundOutsideAmount;

      return {
        period: period.label,
        cashInflow,
        cashOutflow,
        profit: totalProfit,
        loanProfit,
        chitFundProfit,
        outsideAmount: totalOutsideAmount,
        outsideAmountBreakdown: {
          loanRemainingAmount: loanRemainingAmount._sum.remainingAmount || 0,
          chitFundOutsideAmount,
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
