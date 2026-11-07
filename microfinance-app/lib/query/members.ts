/**
 * Members data family: query keys, read hooks, writes and cache invalidation.
 *
 *   const { data: member } = useMember(12);
 *   const { data: dues } = useMemberDues(12);
 *   await memberWrites.update(12, body);
 *   await invalidateMembers(12);
 *
 * Keys follow lib/query/keys.ts: ['members', action, id, params]. URLs are the default
 * consolidated pattern (`/members/consolidated?action=…&id=…`), so no custom endpoint.
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { invalidateDashboardCache } from '../dashboardCache';
import { apiFetch, ApiError } from './fetcher';
import { dropQueries, invalidate, invalidateExcept, type QueryTag } from './invalidate';
import { queryKeys, type QueryKey, type QueryParams } from './keys';
import { prefetchQuery } from './prefetch';
import type { DueAccount, DuesSummary } from './dues';

export const MEMBERS = 'members';
/** Horizon of the dues shown on a member's page (overdue + next 30 days), as before. */
export const MEMBER_DUES_HORIZON = 30;

// ─────────────────────────────────────────────────────────────── types

export interface MemberCounts {
  chitFundMembers: number;
  loans: number;
}

export interface MemberRecord {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: MemberCounts;
}

export interface MemberChitMembership {
  id: number;
  joinDate: string;
  contribution: number;
  missedContributions?: number;
  pendingAmount?: number;
  pendingMonths?: number[];
  partialMonths?: { month: number; balance: number }[];
  chitFund: { id: number; name: string; status: string; currentMonth: number; duration: number; monthlyContribution?: number };
}

export interface MemberLoan {
  id: number;
  loanType: string;
  amount: number;
  status: string;
  disbursementDate: string;
  remainingAmount: number;
  overdueAmount: number;
  missedPayments: number;
  installmentAmount?: number;
  nextPaymentDate?: string | null;
  nonRecoverableAt?: string | null;
  nonRecoverableReason?: string | null;
  recoveryAmount?: number | null;
  recoveryInterestOutstanding?: number | null;
  recoveryOutcome?: string | null;
}

export interface MemberDetail extends MemberRecord {
  chitFundMembers: MemberChitMembership[];
  loans: MemberLoan[];
}

export interface MemberDues {
  horizonDays: number;
  summary: DuesSummary;
  accounts: DueAccount[];
  lastPayment: { date: string; amount: number } | null;
}

export interface PaymentHistoryItem {
  key: string;
  kind: 'contribution' | 'repayment';
  date: string;
  amount: number;
  accountKey: string;
  accountName: string;
  periodLabel: string;
  balance: number;
  detail: string | null;
  collectedBy: string | null;
  href: string;
}

/** Body of create/update, in the key order the members page has always sent. */
export interface MemberBody {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────── keys

export const memberKeys = {
  list: (params?: QueryParams): QueryKey => queryKeys.list(MEMBERS, params),
  detail: (id: number): QueryKey => queryKeys.detail(MEMBERS, id),
  dues: (id: number, horizonDays = MEMBER_DUES_HORIZON): QueryKey => queryKeys.action(MEMBERS, 'dues', id, { horizonDays }),
};

/** Every cached query about one member (detail, dues, history). */
export const memberTag = (id: number): QueryTag => [MEMBERS, undefined, id];

// ─────────────────────────────────────────────────────────────── reads

export function useMember(id: number | null, config?: SWRConfiguration<MemberDetail>) {
  return useSWR<MemberDetail>(id ? memberKeys.detail(id) : null, config);
}

export function useMemberDues(id: number | null, config?: SWRConfiguration<MemberDues>) {
  return useSWR<MemberDues>(id ? memberKeys.dues(id) : null, config);
}

/** Start loading what a member's page shows first (detail + dues), ahead of navigation. */
export function prefetchMember(id: number): void {
  prefetchQuery(memberKeys.detail(id));
  prefetchQuery(memberKeys.dues(id));
}

// ─────────────────────────────────────────────────────────────── writes

const consolidated = (action: string, id?: number) =>
  `/members/consolidated?action=${action}${id !== undefined ? `&id=${id}` : ''}`;

/** Save a blob response as a download, using the server's filename when it sends one. */
async function download(response: Response, fallbackName: string): Promise<void> {
  const disposition = response.headers.get('Content-Disposition');
  const filename = disposition ? disposition.split('filename=')[1].replace(/"/g, '') : fallbackName;
  const url = window.URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const memberWrites = {
  create: (body: MemberBody) => apiFetch<MemberRecord>(consolidated('create'), { method: 'POST', body }),
  update: (id: number, body: MemberBody) => apiFetch<MemberRecord>(consolidated('update', id), { method: 'PUT', body }),
  /** Same request as before: DELETE with `{}` as the body. The server refuses members with loans or chit funds (400). */
  remove: (id: number) => apiFetch<{ message?: string }>(consolidated('delete', id), { method: 'DELETE', body: {} }),
  /** POST /api/members/export with `{ memberIds }` (a plain fetch, as before), then download the workbook. */
  exportMembers: async (memberIds: number[]): Promise<void> => {
    const response = await fetch('/api/members/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds }),
    });
    if (!response.ok) throw new Error(memberIds.length === 1 ? 'Failed to export member' : 'Failed to export members');
    await download(response, memberIds.length === 1 ? 'member_export.xlsx' : 'members_export.xlsx');
  },
  /**
   * Add the member to a chit fund. Body as the page always built it,
   * `{ globalMemberId, contribution }`, sent (like the chit fund's own "assign member" page)
   * to the consolidated add-member action; the old target `/api/chit-funds/:id/members`
   * has no POST handler.
   */
  assignToChitFund: async (chitFundId: number, body: { globalMemberId: number; contribution: number }): Promise<unknown> => {
    const response = await fetch(`/api/chit-funds/consolidated?action=add-member&id=${chitFundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = (data as { error?: unknown } | null)?.error;
      throw new ApiError(typeof message === 'string' ? message : 'Failed to assign member to chit fund', response.status, data);
    }
    invalidateDashboardCache();
    return data;
  },
};

// ─────────────────────────────────────────────────────────────── invalidation

/**
 * After a member create/update/delete: every members query, the loans list (borrower
 * names), chit-fund member lists and the dues views. Resolves when mounted queries refetch.
 */
export function invalidateMembers(): Promise<void> {
  invalidateDashboardCache();
  return invalidate(...MEMBER_WRITE_TAGS);
}

const MEMBER_WRITE_TAGS: QueryTag[] = [MEMBERS, ['loans', 'list'], ['chit-funds', 'members'], 'dues'];

/**
 * After deleting a member: the same as invalidateMembers, except the deleted member's own
 * queries, which are dropped from the cache instead (call once its page has gone).
 */
export function invalidateDeletedMember(id: number): { done: Promise<void>; forget: () => void } {
  invalidateDashboardCache();
  return { done: invalidateExcept(MEMBER_WRITE_TAGS, [memberTag(id)]), forget: () => dropQueries(memberTag(id)) };
}

/** After assigning a member to a chit fund: that fund, the chit-funds list, the member, dues, dashboard. */
export function invalidateChitMembership(memberId: number, chitFundId: number): Promise<void> {
  invalidateDashboardCache();
  return invalidate(
    ['chit-funds', 'detail', chitFundId],
    ['chit-funds', 'members', chitFundId],
    ['chit-funds', 'list'],
    [MEMBERS, 'list'],
    memberTag(memberId),
    'dues',
    'dashboard'
  );
}
