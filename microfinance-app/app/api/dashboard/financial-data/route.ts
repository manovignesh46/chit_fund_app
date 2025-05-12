import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';

// Simple in-memory cache implementation
class FinancialDataCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly TTL: number = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_SIZE: number = 100;

  constructor(ttlMs = 5 * 60 * 1000, maxSize = 100) {
    this.TTL = ttlMs;
    this.MAX_SIZE = maxSize;
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > this.TTL) {
      // Item has expired
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key: string, data: any): void {
    // If cache is at max size, remove oldest entry
    if (this.cache.size >= this.MAX_SIZE) {
      const keys = Array.from(this.cache.keys());
      if (keys.length > 0) {
        this.cache.delete(keys[0]);
      }
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create a cache instance
const financialDataCache = new FinancialDataCache();

/**
 * Utility function to retry operations that might fail due to transient errors
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param isRetryable - Function to determine if an error is retryable
 * @returns Result of the operation
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  isRetryable: (error: any) => boolean = () => true
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry if the error is considered retryable
      if (!isRetryable(error)) {
        console.error('Non-retryable error encountered:', error);
        throw error;
      }

      // Log retry attempt
      console.warn(`Retry attempt ${attempt}/${maxRetries} after error:`, {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        maxRetries
      });

      // Exponential backoff with jitter
      const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Determines if an error is likely to be transient and worth retrying
 * @param error - The error to check
 * @returns Boolean indicating if the error is retryable
 */
function isTransientError(error: any): boolean {
  // Check for common transient error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Connection errors
    if (message.includes('connection') &&
        (message.includes('timeout') ||
         message.includes('closed') ||
         message.includes('reset'))) {
      return true;
    }

    // Database deadlocks or locks
    if (message.includes('deadlock') || message.includes('lock timeout')) {
      return true;
    }

    // Rate limiting
    if (message.includes('too many') || message.includes('rate limit')) {
      return true;
    }
  }

  return false;
}

/**
 * Interfaces for financial data structures
 */
interface TimePeriod {
  label: string;
  startDate: Date;
  endDate: Date;
}

// Define more specific types for domain objects
interface Loan {
  id: number;
  amount: number;
  disbursementDate: Date;
  documentCharge?: number;
  remainingAmount: number;
  createdById: number;
  status: string;
}

interface Repayment {
  id: number;
  amount: number;
  paidDate: Date;
  loanId: number;
  loan?: Loan;
  period?: number;
}

interface ChitFund {
  id: number;
  name: string;
  amount: number;
  duration: number;
  createdById: number;
  status: string;
}

interface Contribution {
  id: number;
  amount: number;
  paidDate: Date;
  chitFundId: number;
  memberId: number;
  period?: number;
}

interface Auction {
  id: number;
  amount: number;
  date: Date;
  chitFundId: number;
  chitFund?: ChitFund;
  period?: number;
}

interface LoanRepaymentGroup {
  loan: Loan;
  repayments: Repayment[];
}

interface ChitFundAuctionGroup {
  chitFund: ChitFund;
  auctions: Auction[];
  contributions: Contribution[];
}

interface CashFlowDetails {
  contributionInflow: number;
  repaymentInflow: number;
  auctionOutflow: number;
  loanOutflow: number;
  netCashFlow: number;
}

interface ProfitDetails {
  interestPayments: number;
  documentCharges: number;
  auctionCommissions: number;
}

interface TransactionCounts {
  loanDisbursements: number;
  loanRepayments: number;
  chitFundContributions: number;
  chitFundAuctions: number;
  totalTransactions: number;
}

interface OutsideAmountBreakdown {
  loanRemainingAmount: number;
  chitFundOutsideAmount: number;
}

interface PeriodFinancialData {
  period: string;
  cashInflow: number;
  cashOutflow: number;
  profit: number;
  loanProfit: number;
  chitFundProfit: number;
  outsideAmount: number;
  outsideAmountBreakdown: OutsideAmountBreakdown;
  cashFlowDetails: CashFlowDetails;
  profitDetails: ProfitDetails;
  transactionCounts: TransactionCounts;
  periodRange: {
    startDate: string;
    endDate: string;
  };
  error?: string; // Optional error field for partial results
}

/**
 * Type guards for domain objects
 */
function isLoan(obj: any): obj is Loan {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.amount === 'number' &&
    obj.disbursementDate instanceof Date;
}

function isRepayment(obj: any): obj is Repayment {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.amount === 'number' &&
    obj.paidDate instanceof Date;
}

// Used in groupByChitFund for type safety
function isChitFund(obj: any): obj is ChitFund {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.amount === 'number' &&
    typeof obj.name === 'string';
}

function isContribution(obj: any): obj is Contribution {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.amount === 'number' &&
    obj.paidDate instanceof Date;
}

function isAuction(obj: any): obj is Auction {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.amount === 'number' &&
    obj.date instanceof Date;
}


/**
 * Use ISR with a 5-minute revalidation period for caching
 */
export const revalidate = 300; // 5 minutes

/**
 * Validates the duration parameter
 * @param duration - The time period duration (weekly, monthly, yearly)
 * @returns boolean indicating if the duration is valid
 */
function isValidDuration(duration: string): boolean {
  return ['weekly', 'monthly', 'yearly'].includes(duration);
}

/**
 * Validates and normalizes the limit parameter
 * @param limit - The number of periods to return
 * @returns A valid limit between 1 and 60
 */
function normalizeLimit(limit: number): number {
  // Ensure limit is between 1 and 60 to prevent excessive queries
  return Math.min(Math.max(limit, 1), 60);
}

/**
 * @swagger
 * /api/dashboard/financial-data:
 *   get:
 *     summary: Get financial data for dashboard
 *     description: Returns financial data aggregated by time periods (weekly, monthly, yearly)
 *     parameters:
 *       - name: duration
 *         in: query
 *         description: Time period duration (weekly, monthly, yearly)
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *           default: monthly
 *       - name: limit
 *         in: query
 *         description: Number of periods to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 60
 *           default: 12
 *       - name: skipCache
 *         in: query
 *         description: Whether to skip the cache and fetch fresh data
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Financial data by time period
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PeriodFinancialData'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    // Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawDuration = searchParams.get('duration') || 'monthly';
    const rawLimit = searchParams.get('limit') || '12';
    const skipCache = searchParams.get('skipCache') === 'true';

    // Validate duration parameter
    if (!isValidDuration(rawDuration)) {
      return NextResponse.json(
        { error: 'Invalid duration parameter. Must be weekly, monthly, or yearly.' },
        { status: 400 }
      );
    }

    // Parse and validate limit parameter
    const parsedLimit = parseInt(rawLimit, 10);
    if (isNaN(parsedLimit)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be a number.' },
        { status: 400 }
      );
    }

    // Normalize limit to prevent excessive queries
    const limit = normalizeLimit(parsedLimit);

    // Get the current user ID from auth
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Generate cache key
    const cacheKey = `financial-data-${currentUserId}-${rawDuration}-${limit}`;

    // Try to get data from cache first (unless skipCache is true)
    if (!skipCache) {
      const cachedData = financialDataCache.get(cacheKey);
      if (cachedData) {
        console.info(`Cache hit for ${cacheKey}`);
        const endTime = performance.now();
        console.info(`Served financial data from cache in ${(endTime - startTime).toFixed(2)}ms`);
        return NextResponse.json(cachedData);
      }
      console.info(`Cache miss for ${cacheKey}`);
    } else {
      console.info(`Skipping cache for ${cacheKey} as requested`);
    }

    // Get financial data based on duration
    const data = await getFinancialDataByDuration(rawDuration, limit, currentUserId);

    // Store in cache for future requests
    financialDataCache.set(cacheKey, data);

    const endTime = performance.now();
    console.info(`Fetched and processed financial data in ${(endTime - startTime).toFixed(2)}ms`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching financial data:', {
      error: error instanceof Error ? error.message : String(error),
      url: request.url,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

/**
 * Generates time periods based on the specified duration and limit
 * @param duration - The time period duration (weekly, monthly, yearly)
 * @param limit - The number of periods to generate
 * @returns Array of time periods with labels and date ranges
 */
function generateTimePeriods(duration: string, limit: number): TimePeriod[] {
  const now = new Date();
  const periods: TimePeriod[] = [];

  switch (duration) {
    case 'weekly':
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
      break;

    case 'monthly':
      // Generate last N months
      for (let i = 0; i < limit; i++) {
        const endDate = new Date(now.getFullYear(), now.getMonth() - i, 0); // Last day of the month
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); // First day of the month

        // Format as "MMM YYYY" (e.g., "Jan 2023")
        const label = startDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

        periods.unshift({ label, startDate, endDate });
      }
      break;

    case 'yearly':
      // Generate last N years
      for (let i = 0; i < limit; i++) {
        const year = now.getFullYear() - i;
        const startDate = new Date(year, 0, 1); // January 1st
        const endDate = new Date(year, 11, 31); // December 31st

        // Format as "YYYY" (e.g., "2023")
        const label = year.toString();

        periods.unshift({ label, startDate, endDate });
      }
      break;

    default:
      // Default to monthly if an invalid duration is provided
      console.warn(`Invalid duration: ${duration}. Defaulting to monthly.`);
      return generateTimePeriods('monthly', limit);
  }

  return periods;
}

/**
 * Fetches contributions for a specific time period
 * @param period - The time period to fetch data for
 * @param userId - The ID of the current user
 * @returns Array of contributions within the period
 */
async function fetchContributions(period: TimePeriod, userId: number) {
  return await withRetry(
    async () => {
      return await prisma.contribution.findMany({
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
    },
    3, // Max retries
    isTransientError // Only retry on transient errors
  );
}

/**
 * Fetches repayments for a specific time period
 * @param period - The time period to fetch data for
 * @param userId - The ID of the current user
 * @returns Array of repayments within the period
 */
async function fetchRepayments(period: TimePeriod, userId: number) {
  return await prisma.repayment.findMany({
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
}

/**
 * Fetches auctions for a specific time period
 * @param period - The time period to fetch data for
 * @param userId - The ID of the current user
 * @returns Array of auctions within the period
 */
async function fetchAuctions(period: TimePeriod, userId: number) {
  return await prisma.auction.findMany({
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
}

/**
 * Fetches loans disbursed in a specific time period
 * @param period - The time period to fetch data for
 * @param userId - The ID of the current user
 * @returns Array of loans disbursed within the period
 */
async function fetchLoans(period: TimePeriod, userId: number) {
  return await prisma.loan.findMany({
    where: {
      disbursementDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
      createdById: userId,
    },
  });
}

/**
 * Fetches loan remaining amounts for outside amount calculation
 * @param endDate - The end date to consider for the calculation
 * @param userId - The ID of the current user
 * @returns Aggregated sum of remaining loan amounts
 */
async function fetchLoanRemainingAmount(endDate: Date, userId: number) {
  return await prisma.loan.aggregate({
    where: {
      createdById: userId,
      status: 'Active',
      createdAt: {
        lte: endDate,
      },
    },
    _sum: {
      remainingAmount: true,
    },
  });
}

/**
 * Fetches chit funds with their contributions and auctions for outside amount calculation
 * @param endDate - The end date to consider for the calculation
 * @param userId - The ID of the current user
 * @returns Chit funds with their related contributions and auctions
 */
async function fetchChitFundsWithDetails(endDate: Date, userId: number) {
  return await prisma.chitFund.findMany({
    where: {
      createdById: userId,
      createdAt: {
        lte: endDate,
      },
    },
    include: {
      contributions: {
        where: {
          paidDate: {
            lte: endDate,
          },
        },
      },
      auctions: {
        where: {
          date: {
            lte: endDate,
          },
        },
      },
    },
  });
}

/**
 * Calculates cash flow details from financial transactions
 * @param contributions - Array of contributions
 * @param repayments - Array of repayments
 * @param auctions - Array of auctions
 * @param loans - Array of loans
 * @returns Object containing cash flow details
 */
function calculateCashFlow(
  contributions: any[],
  repayments: any[],
  auctions: any[],
  loans: any[]
): CashFlowDetails {
  // Calculate inflows using type guards for safety
  const contributionInflow = contributions.reduce((sum: number, contribution: any) => {
    if (isContribution(contribution)) {
      return sum + contribution.amount;
    } else if (contribution && typeof contribution.amount === 'number') {
      return sum + contribution.amount;
    }
    console.warn('Invalid contribution object encountered:', contribution);
    return sum;
  }, 0);

  const repaymentInflow = repayments.reduce((sum: number, repayment: any) => {
    if (isRepayment(repayment)) {
      return sum + repayment.amount;
    } else if (repayment && typeof repayment.amount === 'number') {
      return sum + repayment.amount;
    }
    console.warn('Invalid repayment object encountered:', repayment);
    return sum;
  }, 0);

  // Calculate outflows using type guards for safety
  const auctionOutflow = auctions.reduce((sum: number, auction: any) => {
    if (isAuction(auction)) {
      return sum + auction.amount;
    } else if (auction && typeof auction.amount === 'number') {
      return sum + auction.amount;
    }
    console.warn('Invalid auction object encountered:', auction);
    return sum;
  }, 0);

  const loanOutflow = loans.reduce((sum: number, loan: any) => {
    if (isLoan(loan)) {
      return sum + loan.amount;
    } else if (loan && typeof loan.amount === 'number') {
      return sum + loan.amount;
    }
    console.warn('Invalid loan object encountered:', loan);
    return sum;
  }, 0);

  // Calculate totals
  const cashInflow = contributionInflow + repaymentInflow;
  const cashOutflow = auctionOutflow + loanOutflow;
  const netCashFlow = cashInflow - cashOutflow;

  return {
    contributionInflow,
    repaymentInflow,
    auctionOutflow,
    loanOutflow,
    netCashFlow
  };
}

/**
 * Groups repayments by loan for profit calculation
 * @param repayments - Array of repayments
 * @returns Record of loan IDs to loan data with repayments
 */
function groupRepaymentsByLoan(repayments: any[]): Record<number, LoanRepaymentGroup> {
  const repaymentsByLoan: Record<number, LoanRepaymentGroup> = {};

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

  return repaymentsByLoan;
}

/**
 * Calculates loan profit details
 * @param repaymentsByLoan - Record of loan IDs to loan data with repayments
 * @returns Object containing loan profit details
 */
function calculateLoanProfitDetails(repaymentsByLoan: Record<number, LoanRepaymentGroup>): {
  loanProfit: number;
  interestPayments: number;
  documentCharges: number;
} {
  let loanProfit = 0;
  let interestPayments = 0;
  let documentCharges = 0;

  Object.values(repaymentsByLoan).forEach((loanData: LoanRepaymentGroup) => {
    const loan = loanData.loan;
    const loanRepayments = loanData.repayments;

    // Calculate profit for this loan using the centralized utility function
    const loanProfitAmount = calculateLoanProfit(loan, loanRepayments);
    loanProfit += loanProfitAmount;

    // Calculate interest payments (profit minus document charge)
    const interestPaymentAmount = loanProfitAmount - (loan.documentCharge || 0);
    interestPayments += interestPaymentAmount;

    // Add to document charges total
    documentCharges += (loan.documentCharge || 0);
  });

  return { loanProfit, interestPayments, documentCharges };
}

/**
 * Groups auctions and contributions by chit fund
 * @param auctions - Array of auctions
 * @param contributions - Array of contributions
 * @returns Record of chit fund IDs to chit fund data with auctions and contributions
 */
function groupByChitFund(auctions: any[], contributions: any[]): Record<number, ChitFundAuctionGroup> {
  const auctionsByChitFund: Record<number, ChitFundAuctionGroup> = {};

  // First, collect all auctions by chit fund
  auctions.forEach((auction: any) => {
    if (auction.chitFund) {
      // Use type guard to ensure chitFund is valid
      if (isChitFund(auction.chitFund)) {
        const chitFundId = auction.chitFund.id;
        if (!auctionsByChitFund[chitFundId]) {
          auctionsByChitFund[chitFundId] = {
            chitFund: auction.chitFund,
            auctions: [],
            contributions: []
          };
        }
        auctionsByChitFund[chitFundId].auctions.push(auction);
      } else if (auction.chitFund && typeof auction.chitFund.id === 'number') {
        // Fallback for objects that don't fully match the type guard
        const chitFundId = auction.chitFund.id;
        if (!auctionsByChitFund[chitFundId]) {
          auctionsByChitFund[chitFundId] = {
            chitFund: auction.chitFund as ChitFund, // Type assertion as fallback
            auctions: [],
            contributions: []
          };
        }
        auctionsByChitFund[chitFundId].auctions.push(auction);
      } else {
        console.warn('Invalid chitFund object in auction:', auction.chitFund);
      }
    }
  });

  // Then, collect all contributions by chit fund
  contributions.forEach((contribution: any) => {
    if (isContribution(contribution)) {
      const chitFundId = contribution.chitFundId;
      if (auctionsByChitFund[chitFundId]) {
        auctionsByChitFund[chitFundId].contributions.push(contribution);
      }
    } else if (contribution && typeof contribution.chitFundId === 'number') {
      const chitFundId = contribution.chitFundId;
      if (auctionsByChitFund[chitFundId]) {
        auctionsByChitFund[chitFundId].contributions.push(contribution);
      }
    } else {
      console.warn('Invalid contribution object:', contribution);
    }
  });

  return auctionsByChitFund;
}

/**
 * Calculates chit fund profit details
 * @param auctionsByChitFund - Record of chit fund IDs to chit fund data with auctions and contributions
 * @returns Object containing chit fund profit details
 */
function calculateChitFundProfitDetails(auctionsByChitFund: Record<number, ChitFundAuctionGroup>): {
  chitFundProfit: number;
  auctionCommissions: number;
} {
  let chitFundProfit = 0;
  let auctionCommissions = 0;

  Object.values(auctionsByChitFund).forEach((data: ChitFundAuctionGroup) => {
    // Calculate profit using the centralized utility function
    const profit = calculateChitFundProfit(data.chitFund, data.contributions, data.auctions);
    chitFundProfit += profit;
    auctionCommissions += profit; // All chit fund profit comes from auction commissions
  });

  return { chitFundProfit, auctionCommissions };
}

/**
 * Counts transactions by type
 * @param loans - Array of loans
 * @param repayments - Array of repayments
 * @param contributions - Array of contributions
 * @param auctions - Array of auctions
 * @returns Object containing transaction counts
 */
function countTransactions(
  loans: any[],
  repayments: any[],
  contributions: any[],
  auctions: any[]
): TransactionCounts {
  const loanDisbursements = loans.length;
  const loanRepayments = repayments.length;
  const chitFundContributions = contributions.length;
  const chitFundAuctions = auctions.length;
  const totalTransactions = loanDisbursements + loanRepayments + chitFundContributions + chitFundAuctions;

  return {
    loanDisbursements,
    loanRepayments,
    chitFundContributions,
    chitFundAuctions,
    totalTransactions
  };
}

/**
 * Calculates outside amount for chit funds
 * @param chitFundsWithDetails - Array of chit funds with their contributions and auctions
 * @returns Total outside amount for all chit funds
 */
function calculateOutsideAmount(chitFundsWithDetails: any[]): number {
  let chitFundOutsideAmount = 0;

  chitFundsWithDetails.forEach((fund: any) => {
    const outsideAmount = calculateChitFundOutsideAmount(fund, fund.contributions, fund.auctions);
    chitFundOutsideAmount += outsideAmount;
  });

  return chitFundOutsideAmount;
}

/**
 * Builds the final financial data object for the period
 * @param period - The time period
 * @param cashFlowDetails - Cash flow details
 * @param profitDetails - Profit details
 * @param outsideAmountDetails - Outside amount details
 * @returns Complete financial data object for the period
 */
function buildPeriodFinancialData(
  period: TimePeriod,
  cashFlow: CashFlowDetails,
  profits: { loanProfit: number; chitFundProfit: number; totalProfit: number; interestPayments: number; documentCharges: number; auctionCommissions: number },
  outsideAmount: { loanRemainingAmount: number; chitFundOutsideAmount: number; totalOutsideAmount: number },
  transactions: TransactionCounts
): PeriodFinancialData {
  return {
    period: period.label,
    cashInflow: cashFlow.contributionInflow + cashFlow.repaymentInflow,
    cashOutflow: cashFlow.auctionOutflow + cashFlow.loanOutflow,
    profit: profits.totalProfit,
    loanProfit: profits.loanProfit,
    chitFundProfit: profits.chitFundProfit,
    outsideAmount: outsideAmount.totalOutsideAmount,
    outsideAmountBreakdown: {
      loanRemainingAmount: outsideAmount.loanRemainingAmount,
      chitFundOutsideAmount: outsideAmount.chitFundOutsideAmount,
    },
    cashFlowDetails: cashFlow,
    profitDetails: {
      interestPayments: profits.interestPayments,
      documentCharges: profits.documentCharges,
      auctionCommissions: profits.auctionCommissions
    },
    transactionCounts: transactions,
    periodRange: {
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString()
    }
  };
}

/**
 * Retrieves and processes financial data for the specified time periods
 * @param duration - The time period duration (weekly, monthly, yearly)
 * @param limit - The number of periods to return
 * @param userId - The ID of the current user
 * @returns Array of financial data for each time period
 */
async function getFinancialDataByDuration(duration: string, limit: number, userId: number): Promise<PeriodFinancialData[]> {
  // Generate time periods based on duration
  const periods = generateTimePeriods(duration, limit);

  // Fetch financial data for each period
  const result = await Promise.all(
    periods.map(async (period) => {
      const startTime = performance.now();
      console.info(`Processing financial data for period: ${period.label}`);

      try {
        // Fetch all data for this period in parallel
        const [contributions, repayments, auctions, loans] = await Promise.all([
          fetchContributions(period, userId),
          fetchRepayments(period, userId),
          fetchAuctions(period, userId),
          fetchLoans(period, userId),
        ]);

        console.info(`Fetched data for period ${period.label}: ${contributions.length} contributions, ${repayments.length} repayments, ${auctions.length} auctions, ${loans.length} loans`);

        // Calculate cash flow
        const cashFlowDetails = calculateCashFlow(contributions, repayments, auctions, loans);

        // Group repayments by loan and calculate loan profit
        const repaymentsByLoan = groupRepaymentsByLoan(repayments);
        const { loanProfit, interestPayments, documentCharges } = calculateLoanProfitDetails(repaymentsByLoan);

        // Group by chit fund and calculate chit fund profit
        const auctionsByChitFund = groupByChitFund(auctions, contributions);
        const { chitFundProfit, auctionCommissions } = calculateChitFundProfitDetails(auctionsByChitFund);

        // Calculate total profit
        const totalProfit = loanProfit + chitFundProfit;

        // Count transactions
        const transactionCounts = countTransactions(loans, repayments, contributions, auctions);

        // Fetch outside amount data in parallel
        const [loanRemainingAmount, chitFundsWithDetails] = await Promise.all([
          fetchLoanRemainingAmount(period.endDate, userId),
          fetchChitFundsWithDetails(period.endDate, userId),
        ]);

        // Calculate outside amount
        const chitFundOutsideAmount = calculateOutsideAmount(chitFundsWithDetails);
        const loanRemainingAmountValue = loanRemainingAmount._sum.remainingAmount || 0;
        const totalOutsideAmount = loanRemainingAmountValue + chitFundOutsideAmount;

        // Build the final financial data object
        const result = buildPeriodFinancialData(
          period,
          cashFlowDetails,
          {
            loanProfit,
            chitFundProfit,
            totalProfit,
            interestPayments,
            documentCharges,
            auctionCommissions
          },
          {
            loanRemainingAmount: loanRemainingAmountValue,
            chitFundOutsideAmount,
            totalOutsideAmount
          },
          transactionCounts
        );

        const endTime = performance.now();
        console.info(`Processed financial data for period ${period.label} in ${(endTime - startTime).toFixed(2)}ms`);

        return result;
      } catch (error) {
        console.error('Error processing financial data for period:', {
          period: period.label,
          error: error instanceof Error ? error.message : String(error),
          userId,
          timestamp: new Date().toISOString()
        });

        // Return a partial result with error information
        return {
          period: period.label,
          cashInflow: 0,
          cashOutflow: 0,
          profit: 0,
          loanProfit: 0,
          chitFundProfit: 0,
          outsideAmount: 0,
          outsideAmountBreakdown: {
            loanRemainingAmount: 0,
            chitFundOutsideAmount: 0,
          },
          cashFlowDetails: {
            contributionInflow: 0,
            repaymentInflow: 0,
            auctionOutflow: 0,
            loanOutflow: 0,
            netCashFlow: 0
          },
          profitDetails: {
            interestPayments: 0,
            documentCharges: 0,
            auctionCommissions: 0
          },
          transactionCounts: {
            loanDisbursements: 0,
            loanRepayments: 0,
            chitFundContributions: 0,
            chitFundAuctions: 0,
            totalTransactions: 0
          },
          periodRange: {
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString()
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        } as PeriodFinancialData;
      }
    })
  );

  return result;
}
