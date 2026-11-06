/**
 * The one place that turns amounts and dates into display text.
 *
 * Money: Indian grouping (₹1,25,000), no decimals unless asked for.
 * Dates: "06 Nov 2026", using the runtime's local time zone (as the old helpers did).
 *
 * Pure functions with no React or DOM dependency, so server code, tests and the
 * kit (components/kit/money.tsx, date-text.tsx) can all use them.
 */

export type MoneyInput = number | string | bigint | null | undefined;
export type DateInput = Date | string | number | null | undefined;

export interface FormatMoneyOptions {
  /** Digits after the decimal point. Default 0. */
  decimals?: number;
  /** Prefix positive amounts with "+" (inflows). Default false. */
  signed?: boolean;
  /** Text for null, undefined and unparsable input. Default "—". */
  fallback?: string;
}

export interface FormatDateOptions {
  /** Append the time as "14:05". Default false. */
  withTime?: boolean;
  /** Text for null, undefined and invalid dates. Default "—". */
  fallback?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatterCache = new Map<number, Intl.NumberFormat>();

function moneyFormatter(decimals: number): Intl.NumberFormat {
  let formatter = formatterCache.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatterCache.set(decimals, formatter);
  }
  return formatter;
}

/** Parse a money input to a finite number, or null. Accepts "1,25,000" and "₹1,25,000". */
export function toAmount(value: MoneyInput): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return Number(value);
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(/[₹,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** ₹1,25,000 — Indian digit grouping, minus sign before the rupee symbol. */
export function formatMoney(value: MoneyInput, options: FormatMoneyOptions = {}): string {
  const { decimals = 0, signed = false, fallback = '—' } = options;
  const amount = toAmount(value);
  if (amount === null) return fallback;

  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(amount) * factor) / factor;
  const isZero = rounded === 0;
  const body = moneyFormatter(decimals).format(rounded);
  if (isZero) return body;
  if (amount < 0) return `-${body}`;
  return signed ? `+${body}` : body;
}

/**
 * Short form for stat cards: below one lakh the full amount, then ₹1.25 L and ₹2.4 Cr.
 * Show the full value (formatMoney) alongside, for example in a tooltip.
 */
export function formatMoneyCompact(value: MoneyInput, options: Pick<FormatMoneyOptions, 'fallback'> = {}): string {
  const amount = toAmount(value);
  if (amount === null) return options.fallback ?? '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  return formatMoney(amount);
}

/** Parse a date input; returns null when missing or invalid. "2026-11-06" is read as a local date. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(value);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 06 Nov 2026 (optionally "06 Nov 2026, 14:05"). */
export function formatDate(value: DateInput, options: FormatDateOptions = {}): string {
  const { withTime = false, fallback = '—' } = options;
  const date = toDate(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const text = `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  if (!withTime) return text;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${text}, ${hh}:${mm}`;
}

/** Machine-readable value for <time dateTime>: "2026-11-06" (local date). */
export function toIsoDate(value: DateInput): string | null {
  const date = toDate(value);
  if (!date) return null;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
