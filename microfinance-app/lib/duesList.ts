/**
 * Search, filter, sort and page the computed dues accounts (GET /api/dues list params).
 *
 * The dues are computed in memory from every active loan and chit membership
 * (lib/duesAccounts.ts), so the list is filtered and paged after that computation, never
 * in SQL. The rules are the ones the Dues Tracker page applied in the browser before
 * Phase 5, moved here unchanged so a page of results covers the whole dataset:
 *   kind      'loan' | 'chit'
 *   status    'overdue' (overdueAmount > 0) | 'upcoming' (upcomingAmount > 0)
 *   aging     '1-30' | '31-60' | '61-90' | '90+' (overdue accounts whose maxDaysOverdue is in the bucket; 90+ is ≥ 91)
 *   q         case-insensitive substring of "memberName entityName contact"
 *   sort      'overdue' (most days overdue, then biggest total; the default) | 'amount' | 'name'
 * The summary totals are not touched: they always describe every account.
 */
import type { DueAccount } from './duesAccounts';

export const DUES_SORTS = ['overdue', 'amount', 'name'] as const;
export type DuesSort = (typeof DUES_SORTS)[number];
export const AGING_BUCKETS = ['1-30', '31-60', '61-90', '90+'] as const;

export interface DuesListQuery {
  q?: string | null;
  kind?: string | null;
  status?: string | null;
  aging?: string | null;
  sort?: string | null;
}

/** Names of the query params that switch /api/dues into list mode. */
export const DUES_LIST_PARAMS = ['q', 'kind', 'status', 'aging', 'sort', 'page', 'pageSize'] as const;

function inBucket(bucket: string, days: number): boolean {
  const [lo, hi] = bucket === '90+' ? [91, Infinity] : bucket.split('-').map(Number);
  return days >= lo && days <= hi;
}

export function filterDueAccounts<T extends DueAccount>(accounts: T[], query: DuesListQuery): T[] {
  const q = (query.q ?? '').trim().toLowerCase();
  const kind = query.kind === 'loan' || query.kind === 'chit' ? query.kind : null;
  const status = query.status === 'overdue' || query.status === 'upcoming' ? query.status : null;
  const aging = query.aging && (AGING_BUCKETS as readonly string[]).includes(query.aging) ? query.aging : null;
  const sort: DuesSort = (DUES_SORTS as readonly string[]).includes(query.sort ?? '') ? (query.sort as DuesSort) : 'overdue';

  const list = accounts.filter((a) => {
    if (kind && a.kind !== kind) return false;
    if (status === 'overdue' && a.overdueAmount <= 0) return false;
    if (status === 'upcoming' && a.upcomingAmount <= 0) return false;
    if (aging && (a.overdueAmount <= 0 || !inBucket(aging, a.maxDaysOverdue))) return false;
    if (q && !`${a.memberName} ${a.entityName} ${a.contact || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return [...list].sort((a, b) => {
    if (sort === 'amount') return b.totalOutstanding - a.totalOutstanding;
    if (sort === 'name') return a.memberName.localeCompare(b.memberName);
    return b.maxDaysOverdue - a.maxDaysOverdue || b.totalOutstanding - a.totalOutstanding;
  });
}
