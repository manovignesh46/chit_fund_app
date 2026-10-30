/**
 * Pure helpers for working out what members owe and when.
 *
 * Used by the pending-loans / pending-chits APIs (month view) and the dues
 * API (overdue + upcoming view), so every screen agrees on the numbers.
 */
import { getFundMonthCalendarDate } from './monthlyAggregations';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DueStatus = 'overdue' | 'due-today' | 'upcoming';
export type AgingBucket = '1-30' | '31-60' | '61-90' | '90+';
export const AGING_BUCKETS: AgingBucket[] = ['1-30', '31-60', '61-90', '90+'];

export interface DuePeriod {
  period: number;
  dueDate: string; // ISO
  expected: number;
  paid: number;
  outstanding: number;
  daysOverdue: number; // 0 when due today or in the future
  status: DueStatus;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LoanLike {
  disbursementDate: Date | string;
  duration: number;
  repaymentType: string;
  loanType?: string | null;
  installmentAmount?: number | null;
  remainingAmount?: number | null;
  interestPercentage?: number | null;
  repayments: { period: number; amount: number; paidDate?: Date | string | null }[];
}

export interface ChitFundLike {
  startDate: Date | string;
  duration: number;
  monthlyContribution?: number | null;
  firstMonthContribution?: number | null;
}

export interface ContributionLike {
  month: number;
  amount: number;
  paidDate?: Date | string | null;
  balancePaymentStatus?: string | null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days `dueDate` is behind `asOf` (0 if not yet late). */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  const diff = Math.round((startOfDay(asOf).getTime() - startOfDay(dueDate).getTime()) / DAY_MS);
  return Math.max(0, diff);
}

export function dueStatus(dueDate: Date, asOf: Date): DueStatus {
  const a = startOfDay(asOf).getTime();
  const d = startOfDay(dueDate).getTime();
  if (d < a) return 'overdue';
  if (d === a) return 'due-today';
  return 'upcoming';
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getLoanInstallment(loan: LoanLike): number {
  if (loan.installmentAmount) return loan.installmentAmount;
  const reducing = loan.loanType === 'Reducing Balance' || loan.repaymentType === 'Reducing Balance';
  return reducing
    ? Math.round(((loan.remainingAmount || 0) * ((loan.interestPercentage || 0) / 100)) / 12)
    : 0;
}

export function getLoanDueDate(disbursementDate: Date | string, repaymentType: string, period: number): Date {
  const d = new Date(disbursementDate);
  if (repaymentType === 'Weekly') d.setDate(d.getDate() + period * 7);
  else d.setMonth(d.getMonth() + period);
  return d;
}

function buildPeriod(period: number, dueDate: Date, expected: number, paid: number, asOf: Date): DuePeriod {
  return {
    period,
    dueDate: dueDate.toISOString(),
    expected: round2(expected),
    paid: round2(paid),
    outstanding: round2(Math.max(0, expected - paid)),
    daysOverdue: daysOverdue(dueDate, asOf),
    status: dueStatus(dueDate, asOf),
  };
}

/** Unpaid (or partly paid) loan installments whose due date falls in `range`. */
export function computeLoanDuePeriods(loan: LoanLike, range: DateRange, asOf: Date = new Date()): DuePeriod[] {
  const installment = getLoanInstallment(loan);
  if (installment <= 0) return [];

  const paid = new Map<number, number>();
  for (const r of loan.repayments) {
    if (r.paidDate) paid.set(r.period, (paid.get(r.period) || 0) + r.amount);
  }

  const result: DuePeriod[] = [];
  for (let period = 1; period <= loan.duration; period++) {
    const dueDate = getLoanDueDate(loan.disbursementDate, loan.repaymentType, period);
    if (dueDate < range.start || dueDate > range.end) continue;
    const p = buildPeriod(period, dueDate, installment, paid.get(period) || 0, asOf);
    if (p.outstanding > 0) result.push(p);
  }
  return result;
}

export function getChitExpectedContribution(chitFund: ChitFundLike, month: number): number {
  const monthly = chitFund.monthlyContribution || 0;
  return month === 1 ? (chitFund.firstMonthContribution ?? monthly) : monthly;
}

/** Unpaid (or partly paid) chit contributions for one member whose due date falls in `range`. */
export function computeChitMemberDuePeriods(
  chitFund: ChitFundLike,
  contributions: ContributionLike[],
  range: DateRange,
  asOf: Date = new Date()
): DuePeriod[] {
  const paid = new Map<number, number>();
  const settled = new Set<number>();
  for (const c of contributions) {
    if (!c.paidDate) continue;
    paid.set(c.month, (paid.get(c.month) || 0) + c.amount);
    if (c.balancePaymentStatus === 'Paid') settled.add(c.month);
  }

  const result: DuePeriod[] = [];
  for (let month = 1; month <= chitFund.duration; month++) {
    const dueDate = getFundMonthCalendarDate(chitFund.startDate, month);
    if (dueDate < range.start || dueDate > range.end) continue;
    if (settled.has(month)) continue;
    const p = buildPeriod(month, dueDate, getChitExpectedContribution(chitFund, month), paid.get(month) || 0, asOf);
    if (p.outstanding > 0) result.push(p);
  }
  return result;
}

export interface DueAccountSummary {
  totalOutstanding: number;
  overdueAmount: number;
  upcomingAmount: number;
  overduePeriods: number;
  oldestDueDate: string | null;
  maxDaysOverdue: number;
}

export function summarizePeriods(periods: DuePeriod[]): DueAccountSummary {
  let totalOutstanding = 0;
  let overdueAmount = 0;
  let overduePeriods = 0;
  let maxDays = 0;
  let oldest: string | null = null;
  for (const p of periods) {
    totalOutstanding += p.outstanding;
    if (p.status === 'overdue') {
      overdueAmount += p.outstanding;
      overduePeriods++;
      maxDays = Math.max(maxDays, p.daysOverdue);
    }
    if (!oldest || p.dueDate < oldest) oldest = p.dueDate;
  }
  return {
    totalOutstanding: round2(totalOutstanding),
    overdueAmount: round2(overdueAmount),
    upcomingAmount: round2(totalOutstanding - overdueAmount),
    overduePeriods,
    oldestDueDate: oldest,
    maxDaysOverdue: maxDays,
  };
}

export function emptyAging(): Record<AgingBucket, number> {
  return { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
}

/** Sum overdue outstanding into aging buckets. */
export function addToAging(aging: Record<AgingBucket, number>, periods: DuePeriod[]): Record<AgingBucket, number> {
  for (const p of periods) {
    if (p.status === 'overdue') aging[agingBucket(p.daysOverdue)] = round2(aging[agingBucket(p.daysOverdue)] + p.outstanding);
  }
  return aging;
}
