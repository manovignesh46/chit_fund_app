/**
 * Financial utility functions for consistent profit calculations across the application
 */

import { Loan, Repayment, Contribution, Auction } from '@prisma/client';
import { calculateChitPayoutCommission, CommissionFund } from './chitCommission';

/**
 * Calculate profit for a loan based on its type and repayments
 * @param loan The loan object
 * @param repayments Array of repayments for the loan
 * @returns The calculated profit
 */
export function calculateLoanProfit(
  loan: Pick<Loan, 'amount' | 'interestRate' | 'interestPercentage' | 'documentCharge' | 'repaymentType' | 'loanType'>,
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

    return totalProfit;
  } else if (loan.repaymentType === 'Weekly') {
    // For weekly loans, profit is only from document charge and any excess payments
    const totalPaid = repayments.reduce((sum, r) => sum + (r.amount || 0), 0);
    const loanAmount = loan.amount || 0;

    // If total paid exceeds loan amount, the excess is profit
    const profitFromPayments = totalPaid > loanAmount ? totalPaid - loanAmount : 0;
    const totalProfit = profitFromPayments + documentCharge;

    return totalProfit;
  } else if (loan.loanType === 'Reducing Balance' || loan.repaymentType === 'Reducing Balance') {
    // For reducing balance loans, profit is the sum of calculated interest from each repayment
    let totalInterestProfit = 0;
    let currentPrincipal = loan.amount || 0;
    const interestPercentage = (loan as any).interestPercentage || 0;
    const monthlyInterestRate = interestPercentage / 100 / 12;

    // Sort repayments by date or period to simulate correctly
    const sortedRepayments = [...repayments].sort((a, b) => {
      if (a.period && b.period) return a.period - b.period;
      return new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime();
    });

    sortedRepayments.forEach(repayment => {
      const interestForThisMonth = currentPrincipal * monthlyInterestRate;
      const principalPaid = (repayment.amount || 0) - interestForThisMonth;
      
      totalInterestProfit += interestForThisMonth;
      currentPrincipal = Math.max(0, currentPrincipal - principalPaid);
    });

    return totalInterestProfit + documentCharge;
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
  chitFund: CommissionFund,
  _contributions: Pick<Contribution, 'amount'>[] = [],
  auctions: (Pick<Auction, 'amount'> & { month?: number })[] = []
): number {
  return auctions.reduce((sum, auction) => sum + calculateChitPayoutCommission(chitFund, auction), 0);
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
  auctions: (Pick<Auction, 'amount' | 'month'> & { date?: Date })[] = []
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

  const currentAuctions = auctions.filter(a => (!a.month || a.month <= currentMonth) && (!a.date || new Date(a.date) <= new Date()));
  return calculateChitFundProfit(chitFund, contributions, currentAuctions);
}

/**
 * Calculate total profit from multiple loans
 * @param loans Array of loans with their repayments
 * @returns The total profit from all loans
 */
export function calculateTotalLoanProfit(
  loans: Array<Pick<Loan, 'amount' | 'interestRate' | 'interestPercentage' | 'documentCharge' | 'repaymentType' | 'loanType'> & {
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
