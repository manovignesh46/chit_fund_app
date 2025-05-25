/**
 * Centralized Financial Calculations System
 *
 * This module provides a unified approach to calculating all financial metrics
 * including profit, cash inflow, cash outflow, and outside amounts.
 *
 * Benefits:
 * - Consistent calculations across the entire application
 * - Single source of truth for financial logic
 * - Easier maintenance and debugging
 * - Prevents calculation discrepancies
 */



// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PeriodRange {
  startDate: Date;
  endDate: Date;
}

export interface LoanWithRepayments {
  id: number;
  amount: number;
  interestRate?: number;
  documentCharge?: number;
  repaymentType: string;
  disbursementDate: Date;
  repayments: Array<{
    id: number;
    amount: number;
    paymentType?: string;
    paidDate: Date;
    period?: number;
  }>;
}

export interface ChitFundWithDetails {
  id: number;
  name: string;
  monthlyContribution: number;
  membersCount?: number;
  members?: any[];
  contributions: Array<{
    id: number;
    amount: number;
    paidDate: Date;
    month?: number;
  }>;
  auctions: Array<{
    id: number;
    amount: number;
    date: Date;
    month?: number;
  }>;
}

export interface FinancialMetrics {
  // Core Metrics
  totalProfit: number;
  loanProfit: number;
  chitFundProfit: number;

  // Cash Flow
  totalCashInflow: number;
  totalCashOutflow: number;
  netCashFlow: number;

  // Detailed Cash Flow
  contributionInflow: number;
  repaymentInflow: number;
  auctionOutflow: number;
  loanOutflow: number;

  // Outside Amount
  totalOutsideAmount: number;
  loanRemainingAmount: number;
  chitFundOutsideAmount: number;

  // Profit Breakdown
  interestPayments: number;
  documentCharges: number;
  auctionCommissions: number;

  // Transaction Counts
  transactionCounts: {
    loanDisbursements: number;
    loanRepayments: number;
    chitFundContributions: number;
    chitFundAuctions: number;
    totalTransactions: number;
  };
}

export interface PeriodFinancialData {
  period: string;
  periodRange: PeriodRange;
  metrics: FinancialMetrics;

  // Period-specific data
  loansWithRepayments: LoanWithRepayments[];
  chitFunds: ChitFundWithDetails[];
  loanDisbursements: Array<{
    id: number;
    amount: number;
    documentCharge?: number;
  }>;
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate period-specific loan profit
 * This separates interest from repayments vs document charges from disbursements
 */
export function calculatePeriodLoanProfit(
  loansWithRepayments: LoanWithRepayments[],
  loanDisbursements: Array<{ amount: number; documentCharge?: number }>,
  periodRange?: PeriodRange
): {
  totalProfit: number;
  interestProfit: number;
  documentCharges: number;
} {
  // Calculate interest from repayments made in the period
  const interestProfit = loansWithRepayments.reduce((sum, loan) => {
    if (loan.repaymentType === 'Monthly') {
      // Filter repayments to only those made in the period
      const periodRepayments = periodRange
        ? loan.repayments.filter(r => isDateInPeriod(new Date(r.paidDate), periodRange))
        : loan.repayments;
      return sum + (periodRepayments.length * (loan.interestRate || 0));
    } else if (loan.repaymentType === 'Weekly') {
      // For weekly loans, check if repayments exceed loan amount for period repayments only
      const periodRepayments = periodRange
        ? loan.repayments.filter(r => isDateInPeriod(new Date(r.paidDate), periodRange))
        : loan.repayments;
      const totalPaid = periodRepayments.reduce((s, r) => s + (r.amount || 0), 0);
      const loanAmount = loan.amount || 0;
      return sum + (totalPaid > loanAmount ? totalPaid - loanAmount : 0);
    }
    return sum;
  }, 0);

  // Calculate document charges from loans disbursed in the period
  const documentCharges = loanDisbursements.reduce((sum, loan) =>
    sum + (loan.documentCharge || 0), 0);

  return {
    totalProfit: interestProfit + documentCharges,
    interestProfit,
    documentCharges
  };
}

/**
 * Calculate period-specific chit fund profit
 */
export function calculatePeriodChitFundProfit(
  chitFunds: ChitFundWithDetails[],
  periodRange?: PeriodRange
): {
  totalProfit: number;
  auctionCommissions: number;
} {
  const totalProfit = chitFunds.reduce((sum, fund) => {
    // Calculate auction profits for auctions in the period
    let auctionProfit = 0;
    const membersCount = fund.membersCount || (fund.members ? fund.members.length : 0);

    // Filter auctions to only those in the period
    const periodAuctions = periodRange
      ? fund.auctions.filter(a => isDateInPeriod(new Date(a.date), periodRange))
      : fund.auctions;

    periodAuctions.forEach(auction => {
      const monthlyTotal = fund.monthlyContribution * membersCount;
      const currentAuctionProfit = monthlyTotal - (auction.amount || 0);
      if (currentAuctionProfit > 0) {
        auctionProfit += currentAuctionProfit;
      }
    });

    // If no auction profit, check contribution vs auction difference for period only
    if (auctionProfit === 0) {
      const periodContributions = periodRange
        ? fund.contributions.filter(c => isDateInPeriod(new Date(c.paidDate), periodRange))
        : fund.contributions;

      const totalInflow = periodContributions.reduce((s, c) => s + (c.amount || 0), 0);
      const totalOutflow = periodAuctions.reduce((s, a) => s + (a.amount || 0), 0);
      if (totalInflow > totalOutflow) {
        auctionProfit = totalInflow - totalOutflow;
      }
    }

    return sum + auctionProfit;
  }, 0);

  return {
    totalProfit,
    auctionCommissions: totalProfit
  };
}

/**
 * Calculate period-specific cash flow metrics
 */
export function calculatePeriodCashFlow(
  loansWithRepayments: LoanWithRepayments[],
  chitFunds: ChitFundWithDetails[],
  loanDisbursements: Array<{ amount: number }>,
  periodRange?: PeriodRange
): {
  totalCashInflow: number;
  totalCashOutflow: number;
  netCashFlow: number;
  contributionInflow: number;
  repaymentInflow: number;
  auctionOutflow: number;
  loanOutflow: number;
} {
  // Calculate inflows - filter by period if provided
  const contributionInflow = chitFunds.reduce((sum, fund) => {
    const periodContributions = periodRange
      ? fund.contributions.filter(c => isDateInPeriod(new Date(c.paidDate), periodRange))
      : fund.contributions;
    return sum + periodContributions.reduce((s, c) => s + (c.amount || 0), 0);
  }, 0);

  const repaymentInflow = loansWithRepayments.reduce((sum, loan) => {
    const periodRepayments = periodRange
      ? loan.repayments.filter(r => isDateInPeriod(new Date(r.paidDate), periodRange))
      : loan.repayments;
    return sum + periodRepayments.reduce((s, r) => s + (r.amount || 0), 0);
  }, 0);

  // Calculate outflows - filter by period if provided
  const auctionOutflow = chitFunds.reduce((sum, fund) => {
    const periodAuctions = periodRange
      ? fund.auctions.filter(a => isDateInPeriod(new Date(a.date), periodRange))
      : fund.auctions;
    return sum + periodAuctions.reduce((s, a) => s + (a.amount || 0), 0);
  }, 0);

  const loanOutflow = loanDisbursements.reduce((sum, loan) => sum + loan.amount, 0);

  const totalCashInflow = contributionInflow + repaymentInflow;
  const totalCashOutflow = auctionOutflow + loanOutflow;
  const netCashFlow = totalCashInflow - totalCashOutflow;

  return {
    totalCashInflow,
    totalCashOutflow,
    netCashFlow,
    contributionInflow,
    repaymentInflow,
    auctionOutflow,
    loanOutflow
  };
}

/**
 * Calculate period-specific outside amounts
 */
export function calculatePeriodOutsideAmounts(
  cashFlow: ReturnType<typeof calculatePeriodCashFlow>
): {
  totalOutsideAmount: number;
  loanRemainingAmount: number;
  chitFundOutsideAmount: number;
} {
  const loanRemainingAmount = Math.max(0, cashFlow.loanOutflow - cashFlow.repaymentInflow);
  const chitFundOutsideAmount = Math.max(0, cashFlow.auctionOutflow - cashFlow.contributionInflow);
  const totalOutsideAmount = loanRemainingAmount + chitFundOutsideAmount;

  return {
    totalOutsideAmount,
    loanRemainingAmount,
    chitFundOutsideAmount
  };
}

/**
 * Calculate transaction counts for a period
 */
export function calculatePeriodTransactionCounts(
  loansWithRepayments: LoanWithRepayments[],
  chitFunds: ChitFundWithDetails[],
  loanDisbursements: Array<any>,
  additionalRepayments?: Array<any>,
  additionalContributions?: Array<any>,
  additionalAuctions?: Array<any>
): {
  loanDisbursements: number;
  loanRepayments: number;
  chitFundContributions: number;
  chitFundAuctions: number;
  totalTransactions: number;
} {
  const loanDisbursementsCount = loanDisbursements.length;
  const loanRepaymentsCount = additionalRepayments?.length ||
    loansWithRepayments.reduce((sum, loan) => sum + loan.repayments.length, 0);
  const chitFundContributionsCount = additionalContributions?.length ||
    chitFunds.reduce((sum, fund) => sum + fund.contributions.length, 0);
  const chitFundAuctionsCount = additionalAuctions?.length ||
    chitFunds.reduce((sum, fund) => sum + fund.auctions.length, 0);

  const totalTransactions = loanDisbursementsCount + loanRepaymentsCount +
                           chitFundContributionsCount + chitFundAuctionsCount;

  return {
    loanDisbursements: loanDisbursementsCount,
    loanRepayments: loanRepaymentsCount,
    chitFundContributions: chitFundContributionsCount,
    chitFundAuctions: chitFundAuctionsCount,
    totalTransactions
  };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate comprehensive financial metrics for a specific period
 * This is the main function that should be used throughout the application
 */
export function calculatePeriodFinancialMetrics(
  loansWithRepayments: LoanWithRepayments[],
  chitFunds: ChitFundWithDetails[],
  loanDisbursements: Array<{ id: number; amount: number; documentCharge?: number }>,
  periodRange: PeriodRange,
  additionalCounts?: {
    repayments?: Array<any>;
    contributions?: Array<any>;
    auctions?: Array<any>;
  }
): FinancialMetrics {
  // Calculate loan profit breakdown
  const loanProfitData = calculatePeriodLoanProfit(loansWithRepayments, loanDisbursements, periodRange);

  // Calculate chit fund profit breakdown
  const chitFundProfitData = calculatePeriodChitFundProfit(chitFunds, periodRange);

  // Calculate cash flow metrics
  const cashFlowData = calculatePeriodCashFlow(loansWithRepayments, chitFunds, loanDisbursements, periodRange);

  // Calculate outside amounts
  const outsideAmountData = calculatePeriodOutsideAmounts(cashFlowData);

  // Calculate transaction counts
  const transactionCountsData = calculatePeriodTransactionCounts(
    loansWithRepayments,
    chitFunds,
    loanDisbursements,
    additionalCounts?.repayments,
    additionalCounts?.contributions,
    additionalCounts?.auctions
  );

  return {
    // Core Metrics
    totalProfit: loanProfitData.totalProfit + chitFundProfitData.totalProfit,
    loanProfit: loanProfitData.totalProfit,
    chitFundProfit: chitFundProfitData.totalProfit,

    // Cash Flow
    totalCashInflow: cashFlowData.totalCashInflow,
    totalCashOutflow: cashFlowData.totalCashOutflow,
    netCashFlow: cashFlowData.netCashFlow,

    // Detailed Cash Flow
    contributionInflow: cashFlowData.contributionInflow,
    repaymentInflow: cashFlowData.repaymentInflow,
    auctionOutflow: cashFlowData.auctionOutflow,
    loanOutflow: cashFlowData.loanOutflow,

    // Outside Amount
    totalOutsideAmount: outsideAmountData.totalOutsideAmount,
    loanRemainingAmount: outsideAmountData.loanRemainingAmount,
    chitFundOutsideAmount: outsideAmountData.chitFundOutsideAmount,

    // Profit Breakdown
    interestPayments: loanProfitData.interestProfit,
    documentCharges: loanProfitData.documentCharges,
    auctionCommissions: chitFundProfitData.auctionCommissions,

    // Transaction Counts
    transactionCounts: transactionCountsData
  };
}

/**
 * Calculate financial metrics for multiple periods
 * Useful for generating time-series data for charts
 */
export function calculateMultiPeriodFinancialMetrics(
  periodsData: PeriodFinancialData[]
): {
  periods: string[];
  cashInflow: number[];
  cashOutflow: number[];
  profit: number[];
  outsideAmount: number[];
  periodsData: Array<{
    period: string;
    metrics: FinancialMetrics;
    periodRange: PeriodRange;
  }>;
} {
  const periods: string[] = [];
  const cashInflow: number[] = [];
  const cashOutflow: number[] = [];
  const profit: number[] = [];
  const outsideAmount: number[] = [];
  const detailedPeriodsData: Array<{
    period: string;
    metrics: FinancialMetrics;
    periodRange: PeriodRange;
  }> = [];

  periodsData.forEach(periodData => {
    const metrics = calculatePeriodFinancialMetrics(
      periodData.loansWithRepayments,
      periodData.chitFunds,
      periodData.loanDisbursements,
      periodData.periodRange
    );

    periods.push(periodData.period);
    cashInflow.push(metrics.totalCashInflow);
    cashOutflow.push(metrics.totalCashOutflow);
    profit.push(metrics.totalProfit);
    outsideAmount.push(metrics.totalOutsideAmount);

    detailedPeriodsData.push({
      period: periodData.period,
      metrics,
      periodRange: periodData.periodRange
    });
  });

  return {
    periods,
    cashInflow,
    cashOutflow,
    profit,
    outsideAmount,
    periodsData: detailedPeriodsData
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Filter data for a specific period
 */
export function filterDataForPeriod<T extends { paidDate?: Date; date?: Date; disbursementDate?: Date }>(
  data: T[],
  periodRange: PeriodRange,
  dateField: 'paidDate' | 'date' | 'disbursementDate' = 'paidDate'
): T[] {
  return data.filter(item => {
    const itemDate = item[dateField];
    if (!itemDate) return false;

    const date = new Date(itemDate);
    return date >= periodRange.startDate && date <= periodRange.endDate;
  });
}

/**
 * Check if a date falls within a period range
 */
export function isDateInPeriod(date: Date, periodRange: PeriodRange): boolean {
  return date >= periodRange.startDate && date <= periodRange.endDate;
}

/**
 * Create a period range object
 */
export function createPeriodRange(startDate: Date, endDate: Date): PeriodRange {
  return {
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  };
}

/**
 * Legacy compatibility functions
 * These maintain backward compatibility with existing code
 */

// Re-export existing functions for backward compatibility
export {
  calculateLoanProfit,
  calculateChitFundProfit,
  calculateTotalLoanProfit,
  calculateTotalChitFundProfit,
  calculateChitFundOutsideAmount
} from './financialUtils';

/**
 * Calculate total financial metrics (non-period specific)
 * This is for overall/lifetime calculations
 */
export function calculateTotalFinancialMetrics(
  loansWithRepayments: LoanWithRepayments[],
  chitFunds: ChitFundWithDetails[]
): Omit<FinancialMetrics, 'transactionCounts'> {
  // For total calculations, we include all document charges with loans
  const loanProfit = loansWithRepayments.reduce((sum, loan) => {
    const documentCharge = loan.documentCharge || 0;
    let interestProfit = 0;

    if (loan.repaymentType === 'Monthly') {
      const totalPayments = loan.repayments.length;
      interestProfit = totalPayments * (loan.interestRate || 0);
    } else if (loan.repaymentType === 'Weekly') {
      const totalPaid = loan.repayments.reduce((s, r) => s + (r.amount || 0), 0);
      const loanAmount = loan.amount || 0;
      interestProfit = totalPaid > loanAmount ? totalPaid - loanAmount : 0;
    }

    return sum + interestProfit + documentCharge;
  }, 0);

  const chitFundProfit = chitFunds.reduce((sum, fund) => {
    const membersCount = fund.membersCount || (fund.members ? fund.members.length : 0);
    let auctionProfit = 0;

    fund.auctions.forEach(auction => {
      const monthlyTotal = fund.monthlyContribution * membersCount;
      const currentAuctionProfit = monthlyTotal - (auction.amount || 0);
      if (currentAuctionProfit > 0) {
        auctionProfit += currentAuctionProfit;
      }
    });

    if (auctionProfit === 0) {
      const totalInflow = fund.contributions.reduce((s, c) => s + (c.amount || 0), 0);
      const totalOutflow = fund.auctions.reduce((s, a) => s + (a.amount || 0), 0);
      if (totalInflow > totalOutflow) {
        auctionProfit = totalInflow - totalOutflow;
      }
    }

    return sum + auctionProfit;
  }, 0);

  // Calculate cash flows
  const contributionInflow = chitFunds.reduce((sum, fund) =>
    sum + fund.contributions.reduce((s, c) => s + (c.amount || 0), 0), 0);

  const repaymentInflow = loansWithRepayments.reduce((sum, loan) =>
    sum + loan.repayments.reduce((s, r) => s + (r.amount || 0), 0), 0);

  const auctionOutflow = chitFunds.reduce((sum, fund) =>
    sum + fund.auctions.reduce((s, a) => s + (a.amount || 0), 0), 0);

  const loanOutflow = loansWithRepayments.reduce((sum, loan) => sum + loan.amount, 0);

  const totalCashInflow = contributionInflow + repaymentInflow;
  const totalCashOutflow = auctionOutflow + loanOutflow;

  return {
    totalProfit: loanProfit + chitFundProfit,
    loanProfit,
    chitFundProfit,
    totalCashInflow,
    totalCashOutflow,
    netCashFlow: totalCashInflow - totalCashOutflow,
    contributionInflow,
    repaymentInflow,
    auctionOutflow,
    loanOutflow,
    totalOutsideAmount: Math.max(0, totalCashOutflow - totalCashInflow),
    loanRemainingAmount: Math.max(0, loanOutflow - repaymentInflow),
    chitFundOutsideAmount: Math.max(0, auctionOutflow - contributionInflow),
    interestPayments: loanProfit - loansWithRepayments.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    documentCharges: loansWithRepayments.reduce((sum, loan) => sum + (loan.documentCharge || 0), 0),
    auctionCommissions: chitFundProfit
  };
}
