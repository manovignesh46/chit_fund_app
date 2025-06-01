/**
 * Financial utility functions for consistent profit calculations across the application
 */

import { Loan, Repayment, ChitFund, Contribution, Auction } from '@prisma/client';

/**
 * Calculate profit for a loan based on its type and repayments
 * @param loan The loan object
 * @param repayments Array of repayments for the loan
 * @returns The calculated profit
 */
export function calculateLoanProfit(
  loan: Pick<Loan, 'amount' | 'interestRate' | 'documentCharge' | 'repaymentType'>,
  repayments: Pick<Repayment, 'amount' | 'paymentType' | 'paidDate' | 'period'>[]
): number {
  // Document charge is always part of the profit
  const documentCharge = loan.documentCharge || 0;

  // Different calculation based on loan type
  if (loan.repaymentType === 'Monthly') {
    // For monthly loans, profit comes from interest payments and document charge

    // Count interest-only payments
    const interestOnlyPayments = repayments.filter(r => r.paymentType === 'interestOnly').length;
    const interestOnlyProfit = interestOnlyPayments * (loan.interestRate || 0);

    // Count regular payments (each includes interest)
    const regularPayments = repayments.filter(r => r.paymentType !== 'interestOnly').length;
    const regularPaymentsProfit = regularPayments * (loan.interestRate || 0);

    // Total profit is interest from all payments plus document charge
    const totalProfit = interestOnlyProfit + regularPaymentsProfit + documentCharge;

    // console.log('Monthly loan profit calculation:', {
    //   documentCharge,
    //   interestRate: loan.interestRate,
    //   interestOnlyPayments,
    //   interestOnlyProfit,
    //   regularPayments,
    //   regularPaymentsProfit,
    //   totalProfit
    // });

    return totalProfit;
  } else if (loan.repaymentType === 'Weekly') {
    // For weekly loans, profit is only from document charge and any excess payments
    const totalPaid = repayments.reduce((sum, r) => sum + (r.amount || 0), 0);
    const loanAmount = loan.amount || 0;

    // If total paid exceeds loan amount, the excess is profit
    const profitFromPayments = totalPaid > loanAmount ? totalPaid - loanAmount : 0;
    const totalProfit = profitFromPayments;

    // console.log('Weekly loan profit calculation:', {
    //   documentCharge,
    //   totalPaid,
    //   loanAmount,
    //   profitFromPayments,
    //   totalProfit
    // });

    return totalProfit;
  }

  // Default case
  return documentCharge;
}

/**
 * Calculate profit for a chit fund based on its contributions and auctions
 * @param chitFund The chit fund object
 * @param contributions Array of contributions for the chit fund
 * @param auctions Array of auctions for the chit fund
 * @returns The calculated profit
 */
export function calculateChitFundProfit(
  chitFund: {
    monthlyContribution: number;
    membersCount?: number;
    members?: any[];
  },
  contributions: Pick<Contribution, 'amount'>[] = [],
  auctions: Pick<Auction, 'amount'>[] = []
): number {
  // Calculate total inflow from contributions
  const totalInflow = contributions.reduce((sum, contribution) => sum + (contribution.amount || 0), 0);

  // Calculate total outflow from auctions
  const totalOutflow = auctions.reduce((sum, auction) => sum + (auction.amount || 0), 0);

  // Get members count from either membersCount field or members array
  const membersCount = chitFund.membersCount || (chitFund.members ? chitFund.members.length : 0);

  // Calculate auction profits
  let auctionProfit = 0;

  if (auctions.length > 0) {
    auctions.forEach(auction => {
      // Each auction's profit is the difference between the total monthly contribution and the auction amount
      const monthlyTotal = chitFund.monthlyContribution * membersCount;
      const currentAuctionProfit = monthlyTotal - (auction.amount || 0);

      if (currentAuctionProfit > 0) {
        auctionProfit += currentAuctionProfit;
      }
    });
  }

  // If there are no auctions or the calculated profit is 0, but there's a difference between inflow and outflow,
  // use that difference as the profit (especially for completed chit funds)
  let contributionProfit = 0;
  if ((auctions.length === 0 || auctionProfit === 0) && totalInflow > totalOutflow) {
    contributionProfit = totalInflow - totalOutflow;
  }

  // Total profit is the sum of auction profit and contribution profit
  const totalProfit = auctionProfit + contributionProfit;

  return totalProfit;
}

/**
 * Calculate profit for a chit fund up to the current month only
 * This provides a more accurate profit calculation that doesn't include future projected amounts
 * @param chitFund The chit fund object with currentMonth information
 * @param contributions Array of contributions for the chit fund
 * @param auctions Array of auctions for the chit fund
 * @returns The calculated profit up to current month
 */
export function calculateChitFundProfitUpToCurrentMonth(
  chitFund: {
    monthlyContribution: number;
    firstMonthContribution?: number;
    membersCount?: number;
    members?: any[];
    currentMonth?: number;
    startDate?: string | Date;
    duration?: number;
    chitFundType?: string;
  },
  contributions: Pick<Contribution, 'amount' | 'month'>[] = [],
  auctions: Pick<Auction, 'amount' | 'month'>[] = []
): number {
  // Determine the current month
  let currentMonth = chitFund.currentMonth || 1;

  // If currentMonth is not provided, calculate it based on start date
  if (!chitFund.currentMonth && chitFund.startDate) {
    const start = typeof chitFund.startDate === 'string' ? new Date(chitFund.startDate) : chitFund.startDate;
    const now = new Date();

    if (start <= now) {
      const diffYears = now.getFullYear() - start.getFullYear();
      const diffMonths = now.getMonth() - start.getMonth();
      let monthDiff = diffYears * 12 + diffMonths + 1;

      if (now.getDate() < start.getDate()) {
        monthDiff--;
      }

      currentMonth = Math.min(Math.max(1, monthDiff), chitFund.duration || 1);
    }
  }

  // Filter contributions and auctions up to current month only
  const currentContributions = contributions.filter(c =>
    !c.month || c.month <= currentMonth
  );

  const currentAuctions = auctions.filter(a =>
    !a.month || a.month <= currentMonth
  );

  // Get members count from either membersCount field or members array
  const membersCount = chitFund.membersCount || (chitFund.members ? chitFund.members.length : 0);

  // Calculate auction profits for current auctions only
  let auctionProfit = 0;

  // For Fixed type chit funds, use the new profit calculation formula
  if (chitFund.chitFundType === 'Fixed' && chitFund.firstMonthContribution) {
    return calculateFixedChitFundProfit(chitFund, currentMonth, currentAuctions);
  }

  // For Auction type chit funds, use the original calculation
  if (currentAuctions.length > 0) {
    currentAuctions.forEach(auction => {
      // Each auction's profit is the difference between the total monthly contribution and the auction amount
      const monthlyTotal = chitFund.monthlyContribution * membersCount;
      const currentAuctionProfit = monthlyTotal - (auction.amount || 0);

      if (currentAuctionProfit > 0) {
        auctionProfit += currentAuctionProfit;
      }
    });
  }

  // If there are no auctions or the calculated profit is 0, calculate based on current contributions vs auctions
  let contributionProfit = 0;
  if (currentAuctions.length === 0 || auctionProfit === 0) {
    const totalCurrentInflow = currentContributions.reduce((sum, contribution) => sum + (contribution.amount || 0), 0);
    const totalCurrentOutflow = currentAuctions.reduce((sum, auction) => sum + (auction.amount || 0), 0);

    if (totalCurrentInflow > totalCurrentOutflow) {
      contributionProfit = totalCurrentInflow - totalCurrentOutflow;
    }
  }

  // Total profit is the sum of auction profit and contribution profit
  const totalProfit = auctionProfit + contributionProfit;

  return totalProfit;
}

/**
 * Calculate total profit from multiple loans
 * @param loans Array of loans with their repayments
 * @returns The total profit from all loans
 */
export function calculateTotalLoanProfit(
  loans: Array<Pick<Loan, 'amount' | 'interestRate' | 'documentCharge' | 'repaymentType'> & {
    repayments: Pick<Repayment, 'amount' | 'paymentType' | 'paidDate' | 'period'>[]
  }>
): number {
  return loans.reduce((totalProfit, loan) => {
    const profit = calculateLoanProfit(loan, loan.repayments);
    return totalProfit + profit;
  }, 0);
}

/**
 * Calculate total profit from multiple chit funds
 * @param chitFunds Array of chit funds with their contributions and auctions
 * @returns The total profit from all chit funds
 */
export function calculateTotalChitFundProfit(
  chitFunds: Array<{
    monthlyContribution: number;
    membersCount?: number;
    members?: any[];
    contributions: Pick<Contribution, 'amount'>[],
    auctions: Pick<Auction, 'amount'>[]
  }>
): number {
  return chitFunds.reduce((totalProfit, fund) => {
    const profit = calculateChitFundProfit(fund, fund.contributions, fund.auctions);
    return totalProfit + profit;
  }, 0);
}

/**
 * Calculate total profit from multiple chit funds up to current month only
 * This provides consistent profit calculation across the application
 * @param chitFunds Array of chit funds with their contributions and auctions
 * @returns The total profit from all chit funds up to current month
 */
export function calculateTotalChitFundProfitUpToCurrentMonth(
  chitFunds: Array<{
    monthlyContribution: number;
    firstMonthContribution?: number;
    membersCount?: number;
    members?: any[];
    currentMonth?: number;
    startDate?: string | Date;
    duration?: number;
    chitFundType?: string;
    contributions: Pick<Contribution, 'amount' | 'month'>[],
    auctions: Pick<Auction, 'amount' | 'month'>[]
  }>
): number {
  return chitFunds.reduce((totalProfit, fund) => {
    const profit = calculateChitFundProfitUpToCurrentMonth(fund, fund.contributions, fund.auctions);
    return totalProfit + profit;
  }, 0);
}

/**
 * Calculate outside amount for a chit fund
 * @param chitFund The chit fund object
 * @param contributions Array of contributions
 * @param auctions Array of auctions
 * @returns Calculated outside amount
 */
export function calculateChitFundOutsideAmount(
  chitFund: {
    monthlyContribution: number;
    membersCount?: number;
    members?: any[];
  },
  contributions: Pick<Contribution, 'amount'>[] = [],
  auctions: Pick<Auction, 'amount'>[] = []
): number {
  if (!chitFund) return 0;

  // Calculate total inflow from contributions
  const totalInflow = contributions.reduce((sum, contribution) => sum + (contribution.amount || 0), 0);

  // Calculate total outflow from auctions
  const totalOutflow = auctions.reduce((sum, auction) => sum + (auction.amount || 0), 0);

  // Outside amount is when outflow exceeds inflow
  return totalOutflow > totalInflow ? totalOutflow - totalInflow : 0;
}

/**
 * Calculate profit for Fixed type chit funds using the new formula
 * Formula: For each auction, calculate total profit and distribute equally across all months
 * Example: Total Amount=50000, 1st Month=5000, Monthly=4800, Members=10, Duration=10
 * If 1st month fixed amount=40000, total contribution=5000+(4800*9)=48200
 * Total profit = 48200-40000 = 8200, distributed profit per month = 8200/10 = 820
 * @param chitFund The Fixed type chit fund object
 * @param currentMonth The current month to calculate up to
 * @param auctions Array of auctions that have occurred
 * @returns The calculated profit up to current month
 */
function calculateFixedChitFundProfit(
  chitFund: {
    monthlyContribution: number;
    firstMonthContribution: number;
    membersCount?: number;
    members?: any[];
    duration?: number;
    chitFundType?: string;
  },
  currentMonth: number,
  auctions: Pick<Auction, 'amount' | 'month'>[] = []
): number {
  const membersCount = chitFund.membersCount || (chitFund.members ? chitFund.members.length : 0);
  const duration = chitFund.duration || 1;

  let totalProfit = 0;

  // Calculate profit for each auction that has occurred up to current month
  auctions.forEach(auction => {
    const auctionMonth = auction.month || 1;

    // Calculate total contribution for this auction month
    let totalContribution: number;
    if (auctionMonth === 1) {
      // First month: firstMonthContribution + (monthlyContribution * (membersCount - 1))
      totalContribution = chitFund.firstMonthContribution + (chitFund.monthlyContribution * (membersCount - 1));
    } else {
      // Other months: monthlyContribution * membersCount
      totalContribution = chitFund.monthlyContribution * membersCount;
    }

    // Calculate total profit for this auction: totalContribution - auctionAmount
    const auctionTotalProfit = totalContribution - (auction.amount || 0);

    // Distribute this profit equally across all months of the duration
    const distributedProfitPerMonth = auctionTotalProfit / duration;

    // Add the distributed profit for current month only (not cumulative)
    // Each auction contributes its distributed profit for the current month
    if (distributedProfitPerMonth > 0) {
      totalProfit += distributedProfitPerMonth * currentMonth;
    }
  });

  return Math.max(0, totalProfit); // Ensure profit is not negative
}
