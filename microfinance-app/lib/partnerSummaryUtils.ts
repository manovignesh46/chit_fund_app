import { format, parse, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Convert a date to YYYY-MM format
 */
export function dateToMonthString(date: Date): string {
  return format(date, 'yyyy-MM');
}

/**
 * Get the previous month in YYYY-MM format
 */
export function getPreviousMonth(monthStr: string): string {
  // Parse the month string to a date (using the first day of the month)
  const date = parse(monthStr + '-01', 'yyyy-MM-dd', new Date());
  // Get the previous month
  const prevMonth = subMonths(date, 1);
  // Return in YYYY-MM format
  return format(prevMonth, 'yyyy-MM');
}

/**
 * Extract month and year from YYYY-MM format
 */
export function extractMonthYear(monthString: string): { month: number; year: number } {
  const [yearStr, monthStr] = monthString.split('-');
  return {
    month: parseInt(monthStr),
    year: parseInt(yearStr)
  };
}

/**
 * Format month and year to YYYY-MM format
 */
export function formatMonthYear(month: number, year: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Get the start date of a month
 */
export function monthStart(monthStr: string): Date {
  const date = parse(monthStr + '-01', 'yyyy-MM-dd', new Date());
  return startOfMonth(date);
}

/**
 * Get the end date of a month
 */
export function monthEnd(monthStr: string): Date {
  const date = parse(monthStr + '-01', 'yyyy-MM-dd', new Date());
  return endOfMonth(date);
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Get an array of the last 12 months in YYYY-MM format
 */
export function getLast12Months(): string[] {
  const months = [];
  let currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    months.push(format(currentDate, 'yyyy-MM'));
    currentDate = subMonths(currentDate, 1);
  }
  
  return months;
}
