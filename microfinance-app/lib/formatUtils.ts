/**
 * Utility functions for formatting data consistently across the application
 */

/**
 * Format a currency value consistently
 * @param value The value to format
 * @param currency The currency code (default: INR)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) return 'N/A';

  // Use a more consistent approach that doesn't rely on locale-specific formatting
  // Format as INR with ₹ symbol and no decimal places
  const formattedValue = numValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₹${formattedValue}`;
}

/**
 * Format a date consistently
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = new Date(date);

    if (isNaN(d.getTime())) return 'N/A';

    // Use a more consistent approach that doesn't rely on locale-specific formatting
    const day = d.getDate();
    const month = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][d.getMonth()];
    const year = d.getFullYear();

    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 * @param date The date to format
 * @returns Formatted date string for input fields
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const d = new Date(date);

    if (isNaN(d.getTime())) return '';

    return d.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

/**
 * Calculate loan profit consistently
 * @param loan The loan object
 * @param repayments Array of repayments
 * @returns Calculated profit
 */
export function calculateLoanProfit(loan: any, repayments: any[]): number {
  if (!loan) return 0;

  // Debug log
  console.log('calculateLoanProfit input:', {
    loan: {
      id: loan.id,
      amount: loan.amount,
      interestRate: loan.interestRate,
      documentCharge: loan.documentCharge,
      repaymentType: loan.repaymentType
    },
    repayments: Array.isArray(repayments) ? repayments.length : 'not an array'
  });

  let profit = 0;

  // Add document charge to profit
  profit += loan.documentCharge || 0;

  // Ensure repayments is an array
  const repaymentsArray = Array.isArray(repayments) ? repayments : [];

  // Check if repaymentType is missing
  if (!loan.repaymentType) {
    console.log('WARNING: loan.repaymentType is missing, defaulting to Monthly');
    loan.repaymentType = 'Monthly'; // Default to Monthly if missing
  }

  if (loan.repaymentType === 'Monthly') {
    // For monthly loans with interest

    // Count interest-only payments
    const interestOnlyPayments = repaymentsArray.filter(r => r.paymentType === 'interestOnly');
    const interestOnlyProfit = interestOnlyPayments.length * loan.interestRate;
    profit += interestOnlyProfit;

    // Count regular payments (interest portion only)
    const regularPayments = repaymentsArray.filter(r => r.paymentType !== 'interestOnly');
    const regularPaymentsProfit = regularPayments.length * loan.interestRate;
    profit += regularPaymentsProfit;

    // Debug log
    console.log('Monthly loan profit calculation:', {
      documentCharge: loan.documentCharge || 0,
      interestRate: loan.interestRate,
      interestOnlyPayments: interestOnlyPayments.length,
      interestOnlyProfit,
      regularPayments: regularPayments.length,
      regularPaymentsProfit,
      totalProfit: profit
    });
  } else if (loan.repaymentType === 'Weekly') {
    // For weekly loans: profit is the difference between total payments and principal
    const totalPaid = repaymentsArray
      .filter(r => r.paymentType !== 'interestOnly')
      .reduce((sum, r) => sum + r.amount, 0);

    // Only count as profit if total paid exceeds loan amount
    if (totalPaid > loan.amount) {
      profit += totalPaid - loan.amount;
    }

    // Debug log
    console.log('Weekly loan profit calculation:', {
      documentCharge: loan.documentCharge || 0,
      totalPaid,
      loanAmount: loan.amount,
      profitFromPayments: totalPaid > loan.amount ? totalPaid - loan.amount : 0,
      totalProfit: profit
    });
  }

  return profit;
}

/**
 * Calculate chit fund profit consistently
 * @param chitFund The chit fund object
 * @param contributions Array of contributions
 * @param auctions Array of auctions
 * @returns Calculated profit
 */
export function calculateChitFundProfit(
  chitFund: any,
  contributions: any[] = [],
  auctions: any[] = []
): number {
  if (!chitFund) return 0;

  let profit = 0;

  // Calculate total inflow from contributions
  const totalInflow = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);

  // Calculate total outflow and auction profits
  let totalOutflow = 0;
  let auctionProfit = 0;

  if (auctions.length > 0) {
    auctions.forEach(auction => {
      totalOutflow += auction.amount;

      // Each auction's profit is the difference between the total monthly contribution and the auction amount
      const membersCount = chitFund.membersCount || (chitFund.members ? chitFund.members.length : 0);
      const monthlyTotal = chitFund.monthlyContribution * membersCount;
      const currentAuctionProfit = monthlyTotal - auction.amount;

      if (currentAuctionProfit > 0) {
        auctionProfit += currentAuctionProfit;
      }
    });

    profit = auctionProfit;
  }

  // If there are no auctions or the calculated profit is 0, but there's a difference between inflow and outflow,
  // use that difference as the profit (especially for completed chit funds)
  if ((auctions.length === 0 || profit === 0) && totalInflow > totalOutflow) {
    profit = totalInflow - totalOutflow;
  }

  return profit;
}

/**
 * Calculate outside amount for a chit fund
 * @param chitFund The chit fund object
 * @param contributions Array of contributions
 * @param auctions Array of auctions
 * @returns Calculated outside amount
 */
export function calculateChitFundOutsideAmount(
  chitFund: any,
  contributions: any[] = [],
  auctions: any[] = []
): number {
  if (!chitFund) return 0;

  // Calculate total inflow from contributions
  const totalInflow = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);

  // Calculate total outflow from auctions
  const totalOutflow = auctions.reduce((sum, auction) => sum + auction.amount, 0);

  // Outside amount is when outflow exceeds inflow
  return totalOutflow > totalInflow ? totalOutflow - totalInflow : 0;
}

/**
 * Get status color class for loan status
 * @param status The loan status
 * @returns CSS class for the status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-800';
    case 'Completed':
      return 'bg-blue-100 text-blue-800';
    case 'Defaulted':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Calculate installment amount for a loan
 * @param loan The loan object
 * @returns Calculated installment amount
 */
export function calculateInstallmentAmount(loan: any): number {
  if (!loan) return 0;

  let installmentAmount = 0;

  if (loan.repaymentType === 'Monthly') {
    // For monthly loans: Principal/Duration + Interest
    const principalPerMonth = loan.amount / loan.duration;
    installmentAmount = principalPerMonth + loan.interestRate;
  } else {
    // For weekly loans: Principal/(Duration-1)
    const effectiveDuration = Math.max(1, loan.duration - 1);
    installmentAmount = loan.amount / effectiveDuration;
  }

  return installmentAmount;
}
