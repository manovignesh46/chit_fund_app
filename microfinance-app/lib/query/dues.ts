/**
 * Dues data family (GET /api/dues): keys, types, the CSV export.
 *
 *   const query = useListQuery<DueAccount>(DUES, list, { itemsKey: 'accounts', extraParams: { horizonDays } });
 *
 * Keys: ['dues', 'list', null, params] → `/dues?params`. The dues are computed on the
 * server from every active loan and chit membership; list params filter, sort and page
 * that computed result (lib/duesList.ts). 'dues' is one of the MONEY tags, so every
 * financial write already invalidates it.
 */
import { apiFetch } from './fetcher';
import { registerEndpoint } from './keys';

export const DUES = 'dues';

registerEndpoint(DUES, (_action, _id, params) => {
  const search = new URLSearchParams(params).toString();
  return `/dues${search ? `?${search}` : ''}`;
});

// ─────────────────────────────────────────────────────────────── types

export type DueKind = 'loan' | 'chit';
export type DuePeriodStatus = 'overdue' | 'due-today' | 'upcoming';

export interface DuePeriod {
  period: number;
  dueDate: string;
  expected: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  status: DuePeriodStatus;
}

export interface DueAccount {
  key: string;
  kind: DueKind;
  entityId: number;
  memberId?: number;
  entityName: string;
  memberName: string;
  globalMemberId: number;
  contact?: string;
  installmentAmount: number;
  frequency: string;
  actionHref: string;
  detailHref: string;
  periods: DuePeriod[];
  totalOutstanding: number;
  overdueAmount: number;
  upcomingAmount: number;
  overduePeriods: number;
  oldestDueDate: string | null;
  maxDaysOverdue: number;
}

export const AGING_BUCKETS = ['1-30', '31-60', '61-90', '90+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export interface DuesSummary {
  overdueAmount: number;
  overdueAccounts: number;
  overdueMembers: number;
  dueSoonAmount: number;
  dueLaterAmount: number;
  totalOutstanding: number;
  aging: Record<string, number>;
}

export interface DuesListResponse {
  asOf: string;
  horizonDays: number;
  summary: DuesSummary;
  accounts: DueAccount[];
  /** Count and total of the whole filtered list (list mode only). */
  filtered?: { count: number; totalOutstanding: number };
}

// ─────────────────────────────────────────────────────────────── CSV

export function periodLabel(kind: DueKind, frequency: string, period: number): string {
  if (kind === 'chit') return `Month ${period}`;
  return frequency === 'Weekly' ? `Week ${period}` : `Installment ${period}`;
}

/** The Dues Tracker CSV, one row per unpaid period (same columns as before). */
export function duesCsv(accounts: DueAccount[]): string {
  const header = ['Member', 'Contact', 'Type', 'Account', 'Period', 'Due Date', 'Expected', 'Paid', 'Outstanding', 'Days Overdue', 'Status'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = accounts.flatMap((a) =>
    a.periods.map((p) => [
      a.memberName, a.contact, a.kind === 'loan' ? 'Loan' : 'Chit Fund', a.entityName,
      periodLabel(a.kind, a.frequency, p.period), p.dueDate.slice(0, 10), p.expected, p.paid, p.outstanding, p.daysOverdue, p.status,
    ])
  );
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

/**
 * Download every account matching the current filters (all pages) as CSV: one request
 * with the filter params and no page/pageSize, so the server returns the whole filtered list.
 */
export async function exportDuesCsv(params: Record<string, string | number>): Promise<number> {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === 'page' || name === 'pageSize') continue;
    search.set(name, String(value));
  }
  const data = await apiFetch<DuesListResponse>(`/dues?${search.toString()}`);
  const blob = new Blob([duesCsv(data.accounts)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dues-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return data.accounts.length;
}
