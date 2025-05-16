/**
 * Utility functions for formatting data consistently across the application
 */

import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount } from './financialUtils';

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
 * Re-export financial utility functions for backward compatibility
 * These functions are now defined in financialUtils.ts
 */
export { calculateLoanProfit, calculateChitFundProfit, calculateChitFundOutsideAmount };

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
