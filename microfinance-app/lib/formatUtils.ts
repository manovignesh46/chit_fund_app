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
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numValue);
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
    
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
  
  let profit = 0;
  
  // Add document charge to profit
  profit += loan.documentCharge || 0;
  
  if (loan.repaymentType === 'Monthly') {
    // For monthly loans with interest
    
    // Count interest-only payments
    const interestOnlyPayments = repayments.filter(r => r.paymentType === 'interestOnly');
    const interestOnlyProfit = interestOnlyPayments.length * loan.interestRate;
    profit += interestOnlyProfit;
    
    // Count regular payments (interest portion only)
    const regularPayments = repayments.filter(r => r.paymentType !== 'interestOnly');
    const regularPaymentsProfit = regularPayments.length * loan.interestRate;
    profit += regularPaymentsProfit;
  } else if (loan.repaymentType === 'Weekly') {
    // For weekly loans: profit is the difference between total payments and principal
    const totalPaid = repayments
      .filter(r => r.paymentType !== 'interestOnly')
      .reduce((sum, r) => sum + r.amount, 0);
    
    // Only count as profit if total paid exceeds loan amount
    if (totalPaid > loan.amount) {
      profit += totalPaid - loan.amount;
    }
  }
  
  return profit;
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
