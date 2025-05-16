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
    const totalProfit = profitFromPayments + documentCharge;

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
