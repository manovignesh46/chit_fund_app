import { addMonths, format, isValid } from 'date-fns';

/** Calendar month of a chit fund's nth month ("Dec 2025"), or '' when the start date is unknown. */
export function calendarMonth(startDate: string | null | undefined, month: number): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  return isValid(start) ? format(addMonths(start, month - 1), 'MMM yyyy') : '';
}

/** "Month 5 · Apr 2026" (or just "Month 5"). */
export function monthLabel(startDate: string | null | undefined, month: number): string {
  const name = calendarMonth(startDate, month);
  return name ? `Month ${month} · ${name}` : `Month ${month}`;
}
