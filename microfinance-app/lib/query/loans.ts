/**
 * Loans data family: query keys, read hooks, writes and cache invalidation.
 *
 *   const { data: loan } = useLoan(12);
 *   const schedules = useLoanSchedules(12, false);
 *   await loanWrites.addRepayment(12, body);
 *   await invalidateLoan(12, loan.borrowerId);
 *
 * Keys follow lib/query/keys.ts: ['loans', action, id, params]. URLs are the
 * consolidated route (`/loans/consolidated?action=…&id=…`) except recovery data,
 * which lives at `/loans/:id/recovery`.
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { invalidateDashboardCache } from '../dashboardCache';
import { apiFetch } from './fetcher';
import { invalidate, MONEY_TAGS, type QueryTag } from './invalidate';
import { queryKeys, registerEndpoint, type QueryKey, type QueryParams } from './keys';
import { prefetchQuery } from './prefetch';

export const LOANS = 'loans';

registerEndpoint(LOANS, (action, id, params) => {
  if (action === 'recovery') return `/loans/${id}/recovery`;
  const search = new URLSearchParams({ action });
  if (id !== null && id !== undefined) search.set('id', String(id));
  for (const [name, value] of Object.entries(params)) search.set(name, value);
  return `/loans/consolidated?${search.toString()}`;
});

// ─────────────────────────────────────────────────────────────── types

export interface LoanBorrower {
  id: number;
  name: string;
  contact?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface LoanRecord {
  id: number;
  borrowerId: number;
  borrower?: LoanBorrower | null;
  loanType: string;
  repaymentType: string;
  amount: number;
  interestRate: number;
  interestPercentage?: number | null;
  documentCharge: number;
  installmentAmount: number;
  duration: number;
  currentMonth: number;
  disbursementDate: string;
  remainingAmount: number;
  overdueAmount: number;
  missedPayments: number;
  nextPaymentDate: string | null;
  status: string;
  purpose?: string | null;
  createdAt?: string;
  updatedAt?: string;
  nonRecoverableAt?: string | null;
  nonRecoverableReason?: string | null;
  nonRecoverableNotes?: string | null;
  recoveryPrincipalAtMark?: number | null;
  recoveryDuesAtMark?: number | null;
  recoveryInterestOutstanding?: number;
  recoveryAmount?: number;
  recoveryOutcome?: string | null;
  /** Server-computed (detail only). */
  totalProfit?: number;
  _count?: { repayments: number };
}

export interface LoanSchedule {
  id: number;
  period: number;
  dueDate: string;
  amount: number;
  interestAmount?: number;
  status: string;
  isPaid?: boolean;
  isInterestOnly?: boolean;
  isDueToday?: boolean;
  isDueTomorrow?: boolean;
  isOverdue?: boolean;
  isUpcoming?: boolean;
  isNextPayment?: boolean;
  paidDate?: string | null;
  paidAmount?: number | null;
}

export interface RepaymentRecord {
  id: number;
  loanId: number;
  amount: number;
  paidDate: string;
  period: number;
  paymentType: string;
  dueDate?: string | null;
  notes?: string | null;
  principalComponent?: number | null;
  interestComponent?: number | null;
}

export interface LoansListSummary {
  principal: number;
  interest: number;
  recovered: number;
}

/** Body of POST add-repayment, as both repayment entry points have always sent it. */
export interface AddRepaymentBody {
  amount: number;
  paidDate: string;
  paymentType: string;
  scheduleId: number;
  collected_by_id: number;
  collected_by: string;
  entered_by_id: number | string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────── keys

export const loanKeys = {
  list: (params?: QueryParams): QueryKey => queryKeys.list(LOANS, params),
  detail: (id: number): QueryKey => queryKeys.detail(LOANS, id),
  repayments: (id: number, params?: QueryParams): QueryKey => queryKeys.action(LOANS, 'repayments', id, params),
  /** includeAll=false: the detail page view ({schedules}); true: every unpaid period (array). */
  schedules: (id: number, includeAll: boolean): QueryKey =>
    queryKeys.action(LOANS, 'payment-schedules', id, { includeAll: includeAll ? 'true' : 'false' }),
  recovery: (id: number): QueryKey => queryKeys.action(LOANS, 'recovery', id),
};

// ─────────────────────────────────────────────────────────────── reads

export function useLoan(id: number | null, config?: SWRConfiguration<LoanRecord>) {
  return useSWR<LoanRecord>(id ? loanKeys.detail(id) : null, config);
}

/** Schedules as an array whichever shape the server returned. */
export function schedulesOf(data: unknown): LoanSchedule[] {
  if (Array.isArray(data)) return data as LoanSchedule[];
  const list = (data as { schedules?: unknown } | undefined)?.schedules;
  return Array.isArray(list) ? (list as LoanSchedule[]) : [];
}

export function useLoanSchedules(id: number | null, includeAll: boolean, enabled = true) {
  const query = useSWR<unknown>(id && enabled ? loanKeys.schedules(id, includeAll) : null);
  return { ...query, schedules: schedulesOf(query.data) };
}

export function useLoanRecovery(id: number | null, enabled = true) {
  return useSWR<unknown>(id && enabled ? loanKeys.recovery(id) : null);
}

/** Start loading a loan's detail ahead of navigation (row hover/focus/touch). */
export function prefetchLoan(id: number): void {
  prefetchQuery(loanKeys.detail(id));
}

// ─────────────────────────────────────────────────────────────── writes

const consolidated = (action: string, id?: number) =>
  `/loans/consolidated?action=${action}${id !== undefined ? `&id=${id}` : ''}`;

export const loanWrites = {
  /** `partner` is sent as x-active-partner (the selected partner's name, or '' when none). */
  create: (body: Record<string, unknown>, partner: string) =>
    apiFetch<{ id: number }>(consolidated('create'), { method: 'POST', body, headers: { 'x-active-partner': partner } }),
  update: (id: number, body: Record<string, unknown>) => apiFetch<unknown>(consolidated('update', id), { method: 'PUT', body }),
  remove: (id: number) => apiFetch<{ message?: string }>(consolidated('delete', id), { method: 'DELETE', body: { id } }),
  addRepayment: (id: number, body: AddRepaymentBody) =>
    apiFetch<{ loan?: unknown }>(consolidated('add-repayment', id), { method: 'POST', body }),
  deleteRepayment: (id: number, repaymentId: number) =>
    apiFetch<{ message?: string }>(consolidated('delete-repayment', id), { method: 'DELETE', body: { repaymentId } }),
  /**
   * Recalculate the stored overdue figures (sent on every loan view, as before). A plain
   * fetch on purpose: it must not clear the dashboard cache like real writes do, and a
   * failure must never block the page.
   */
  updateOverdue: async (id: number): Promise<{ overdueAmount?: number; missedPayments?: number } | null> => {
    try {
      const response = await fetch(`/api${consolidated('update-overdue', id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return response.ok ? await response.json() : null;
    } catch (error) {
      console.error('Error updating overdue amount:', error);
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────── invalidation

const memberTags = (borrowerId?: number | null): QueryTag[] =>
  borrowerId ? [['members', 'detail', borrowerId]] : [];

/**
 * After a repayment add/delete or a recovery action: that loan's detail, repayments,
 * schedules and recovery data, the loans list, the borrower's member page, and the
 * money views. Resolves when the mounted queries have refetched.
 */
export function invalidateLoan(id: number, borrowerId?: number | null): Promise<void> {
  invalidateDashboardCache();
  return invalidate(
    [LOANS, 'detail', id],
    [LOANS, 'repayments', id],
    [LOANS, 'payment-schedules', id],
    [LOANS, 'recovery', id],
    [LOANS, 'list'],
    ...memberTags(borrowerId),
    ...MONEY_TAGS
  );
}

/** After a loan create/update/delete: every loans query, the members list and the borrower, money views. */
export function invalidateLoans(borrowerId?: number | null): Promise<void> {
  invalidateDashboardCache();
  return invalidate(LOANS, ['members', 'list'], ...memberTags(borrowerId), ...MONEY_TAGS);
}
