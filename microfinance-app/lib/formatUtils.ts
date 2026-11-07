/**
 * Utility functions for formatting data consistently across the application
 */

import { formatMoney, formatDate as formatDateText } from './format';
import { calculateLoanProfit, calculateChitFundProfit, calculateChitFundProfitUpToCurrentMonth, calculateChitFundOutsideAmount } from './financialUtils';

/**
 * Format a currency value: ₹1,25,000 (Indian grouping, no decimals).
 * Delegates to lib/format.ts; null, undefined and unparsable input give "N/A" as before.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  return formatMoney(value, { fallback: 'N/A' });
}

/**
 * Format a date: 06 Nov 2026. Delegates to lib/format.ts; missing or invalid input gives "N/A".
 */
export function formatDate(date: Date | string | null | undefined): string {
  return formatDateText(date, { fallback: 'N/A' });
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
export { calculateLoanProfit, calculateChitFundProfit, calculateChitFundProfitUpToCurrentMonth, calculateChitFundOutsideAmount };

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
