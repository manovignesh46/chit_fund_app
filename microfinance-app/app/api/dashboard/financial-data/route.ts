import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

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

      // Calculate profit using centralized utility functions
      let loanProfit = 0;
      let interestPayments = 0;
      let documentCharges = 0;

      // Group repayments by loan
      const repaymentsByLoan: Record<number, { loan: any; repayments: any[] }> = {};

      repayments.forEach((repayment: any) => {
        if (repayment.loan) {
          const loanId = repayment.loan.id;
          if (!repaymentsByLoan[loanId]) {
            repaymentsByLoan[loanId] = {
              loan: repayment.loan,
              repayments: []
            };
          }
          repaymentsByLoan[loanId].repayments.push(repayment);
        }
      });

      // Calculate profit for each loan using the centralized utility function
      Object.values(repaymentsByLoan).forEach((loanData: any) => {
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
            lte: period.endDate,
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
