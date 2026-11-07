/**
 * Chit funds data family: query keys, read hooks, writes, tags and cache invalidation.
 *
 *   const { data: fund } = useChitFund(9);
 *   const auctions = useChitFundAuctions(9);
 *   await chitFundWrites.update(9, body);
 *   await invalidateChitFunds();
 *
 * Keys follow lib/query/keys.ts: ['chit-funds', action, id, params]. URLs are the
 * consolidated route (`/chit-funds/consolidated?action=…&id=…`), except a fund's auction
 * bookings (`/chit-funds/:id/auction-bookings`). The Auction Plan reads live under the
 * 'projection' resource (`/projection/consolidated`, `/projection/auction-history`).
 *
 * Tags for the fund's own pages (members, contributions, auctions: Phase 6b) are exported
 * below: chitFundTag, chitFundDetailTag, chitFundMembersTag, chitFundContributionsTag,
 * chitFundAuctionsTag, chitFundBookingsTag, PROJECTION.
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { invalidateDashboardCache } from '../dashboardCache';
import { apiFetch } from './fetcher';
import { dropQueries, invalidate, invalidateExcept, MONEY_TAGS, type QueryTag } from './invalidate';
import { queryKeys, registerEndpoint, type QueryKey, type QueryParams } from './keys';
import { prefetchQuery } from './prefetch';

export const CHIT_FUNDS = 'chit-funds';
export const PROJECTION = 'projection';
/** The templates resource (lib/query/chit-fund-templates.ts); named here to avoid an import cycle. */
const TEMPLATES = 'chit-fund-templates';

const consolidatedUrl = (resource: string, action: string, id: string | number | null, params: Record<string, string>) => {
  const search = new URLSearchParams({ action });
  if (id !== null && id !== undefined) search.set('id', String(id));
  for (const [name, value] of Object.entries(params)) search.set(name, value);
  return `/${resource}/consolidated?${search.toString()}`;
};

registerEndpoint(CHIT_FUNDS, (action, id, params) => {
  if (action === 'auction-bookings') return `/chit-funds/${id}/auction-bookings`;
  return consolidatedUrl(CHIT_FUNDS, action, id, params);
});

registerEndpoint(PROJECTION, (action, _id, params) => {
  const search = new URLSearchParams(params).toString();
  if (action === 'auction-history') return `/projection/auction-history${search ? `?${search}` : ''}`;
  return `/projection/consolidated${search ? `?${search}` : ''}`;
});

// ─────────────────────────────────────────────────────────────── types

export interface ChitFundCounts {
  members: number;
  auctions: number;
  contributions: number;
}

/** A row of the list endpoint (scalar columns + counts + the pending-contribution flag). */
export interface ChitFundRecord {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  firstMonthContribution: number | null;
  duration: number;
  membersCount: number;
  status: string;
  startDate: string;
  currentMonth: number;
  nextAuctionDate: string | null;
  description: string | null;
  chitFundType: string;
  createdAt: string;
  updatedAt: string;
  createdById: number;
  templateId: number | null;
  _count: ChitFundCounts;
  hasPendingContribution?: boolean;
}

export interface ChitFundsSummary {
  active: number;
  upcoming: number;
  totalMembers: number;
  totalValue: number;
}

export interface ChitFundFixedAmount {
  id: number;
  chitFundId: number;
  month: number;
  amount: number;
}

export interface ChitFundMemberRow {
  id: number;
  globalMemberId: number;
  chitFundId: number;
  joinDate: string;
  contribution: number;
  auctionWon?: boolean;
  auctionMonth?: number | null;
}

/** The detail endpoint: the fund, its fixed amounts, template, members and server figures. */
export interface ChitFundDetail extends Omit<ChitFundRecord, 'hasPendingContribution'> {
  fixedAmounts: ChitFundFixedAmount[];
  template: { id: number; name: string } | null;
  contributions: { id: number; amount: number; month: number; paidDate: string }[];
  auctions: { id: number; amount: number; month: number; date: string }[];
  members: ChitFundMemberRow[];
  derivedFields?: {
    totalProfit: number;
    cashInflow: number;
    cashOutflow: number;
    outsideAmount: number;
  };
}

export interface GlobalMemberRef {
  id: number;
  name: string;
  contact: string;
  email?: string | null;
}

export interface ChitFundAuction {
  id: number;
  chitFundId: number;
  month: number;
  date: string;
  winnerId: number;
  amount: number;
  lowestBid?: number | null;
  highestBid?: number | null;
  numberOfBidders?: number | null;
  notes?: string | null;
  winner?: { id: number; globalMember?: GlobalMemberRef | null } | null;
}

export interface ChitFundAuctionsResponse {
  auctions: ChitFundAuction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** One row of `allContributions` from the contributions endpoint. */
export interface ContributionStatusRow {
  id: number;
  memberId: number;
  month: number;
  amount: number;
  paidDate: string;
  balance: number;
  balancePaymentStatus: string | null;
  balancePaymentDate: string | null;
  actualBalancePaymentDate: string | null;
}

export interface ContributionsResponse {
  contributions: unknown[];
  allContributions: ContributionStatusRow[];
  members: (ChitFundMemberRow & { globalMember: GlobalMemberRef })[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuctionBooking {
  id: number;
  month: number;
  memberId: number;
  memberName: string;
  isPlanned?: boolean;
}

export interface AuctionBookingsResponse {
  chitFund: { id: number; name: string; duration: number; currentMonth: number; status: string; startDate: string };
  bookings: AuctionBooking[];
  completedAuctions: { id: number; month: number; memberId: number; memberName: string; amount: number; date: string; isPlanned: false }[];
  members: { id: number; name: string; contribution: number }[];
}

/** Body of POST create / PUT update, as the new and edit pages have always built it. */
export type ChitFundBody = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────── keys

/** Every auction of a fund fits one page: funds run at most 60 months (one winner each). */
export const FUND_AUCTIONS_PAGE_SIZE = 100;

export const chitFundKeys = {
  list: (params?: QueryParams): QueryKey => queryKeys.list(CHIT_FUNDS, params),
  summary: (): QueryKey => queryKeys.action(CHIT_FUNDS, 'summary'),
  detail: (id: number): QueryKey => queryKeys.detail(CHIT_FUNDS, id),
  auctions: (id: number, params: QueryParams = { page: 1, pageSize: FUND_AUCTIONS_PAGE_SIZE }): QueryKey =>
    queryKeys.action(CHIT_FUNDS, 'auctions', id, params),
  /**
   * The contributions endpoint for status figures only: `allContributions` and `members`
   * are always complete; the paginated `contributions` page is not needed, so it is 1 row.
   */
  contributionStatus: (id: number): QueryKey => queryKeys.action(CHIT_FUNDS, 'contributions', id, { page: 1, pageSize: 1 }),
  bookings: (id: number): QueryKey => queryKeys.action(CHIT_FUNDS, 'auction-bookings', id),
  /** Active funds for the auction-bookings picker (unchanged request: status=Active, pageSize=100). */
  activeFunds: (): QueryKey => queryKeys.list(CHIT_FUNDS, { status: 'Active', pageSize: 100 }),
  projection: (params?: QueryParams): QueryKey => queryKeys.action(PROJECTION, 'consolidated', null, params ?? {}),
  auctionHistory: (): QueryKey => queryKeys.action(PROJECTION, 'auction-history'),
};

// ─────────────────────────────────────────────────────────────── tags (Phase 6b uses these)

/** Every cached query about one fund (detail, members, contributions, auctions, bookings). */
export const chitFundTag = (id: number): QueryTag => [CHIT_FUNDS, undefined, id];
export const chitFundDetailTag = (id: number): QueryTag => [CHIT_FUNDS, 'detail', id];
export const chitFundMembersTag = (id: number): QueryTag => [CHIT_FUNDS, 'members', id];
export const chitFundContributionsTag = (id: number): QueryTag => [CHIT_FUNDS, 'contributions', id];
export const chitFundAuctionsTag = (id: number): QueryTag => [CHIT_FUNDS, 'auctions', id];
export const chitFundBookingsTag = (id: number): QueryTag => [CHIT_FUNDS, 'auction-bookings', id];
/** The chit funds list and its key figures. */
export const CHIT_FUND_LIST_TAGS: readonly QueryTag[] = [
  [CHIT_FUNDS, 'list'],
  [CHIT_FUNDS, 'summary'],
];

// ─────────────────────────────────────────────────────────────── reads

export function useChitFund(id: number | null, config?: SWRConfiguration<ChitFundDetail>) {
  return useSWR<ChitFundDetail>(id ? chitFundKeys.detail(id) : null, config);
}

export function useChitFundsSummary() {
  return useSWR<ChitFundsSummary>(chitFundKeys.summary());
}

/** All of a fund's auctions (one page of FUND_AUCTIONS_PAGE_SIZE), newest month first. */
export function useChitFundAuctions(id: number | null, enabled = true) {
  return useSWR<ChitFundAuctionsResponse>(id && enabled ? chitFundKeys.auctions(id) : null);
}

export function useChitFundContributionStatus(id: number | null, enabled = true) {
  return useSWR<ContributionsResponse>(id && enabled ? chitFundKeys.contributionStatus(id) : null);
}

export function useAuctionBookings(id: number | null) {
  return useSWR<AuctionBookingsResponse>(id ? chitFundKeys.bookings(id) : null);
}

/** Start loading what a fund's page shows first (detail + auctions), ahead of navigation. */
export function prefetchChitFund(id: number): void {
  prefetchQuery(chitFundKeys.detail(id));
  prefetchQuery(chitFundKeys.auctions(id));
}

// ─────────────────────────────────────────────────────────────── writes

const consolidated = (action: string, id?: number) =>
  `/chit-funds/consolidated?action=${action}${id !== undefined ? `&id=${id}` : ''}`;

/** Save a blob response as a download. */
async function download(response: Response, filename: string): Promise<void> {
  const url = window.URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

const today = () => new Date().toISOString().split('T')[0];

export const chitFundWrites = {
  create: (body: ChitFundBody) => apiFetch<ChitFundRecord>(consolidated('create'), { method: 'POST', body }),
  update: (id: number, body: ChitFundBody) => apiFetch<ChitFundRecord>(consolidated('update', id), { method: 'PUT', body }),
  /** Same request as before: DELETE with no body. Deletes the fund's members, contributions and auctions too. */
  remove: (id: number) => apiFetch<{ success?: boolean }>(consolidated('delete', id), { method: 'DELETE' }),
  /** Body `{ globalMemberId, contribution }`, as the assign-member page always built it. */
  addMember: (id: number, body: { globalMemberId: number; contribution: number }) =>
    apiFetch<unknown>(consolidated('add-member', id), { method: 'POST', body }),
  /** One fund: GET /api/chit-funds/:id/export, saved as `<filename>` (the caller names it, as each page did). */
  exportOne: async (id: number, filename: string): Promise<void> => {
    const response = await fetch(`/api/chit-funds/${id}/export`, { method: 'GET' });
    if (!response.ok) throw new Error('Failed to export chit fund');
    await download(response, filename);
  },
  /** Several funds: POST /api/chit-funds/export `{ chitFundIds }`, saved as ChitFunds_Export_<date>.xlsx. */
  exportMany: async (ids: number[]): Promise<void> => {
    const response = await fetch('/api/chit-funds/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chitFundIds: ids }),
    });
    if (!response.ok) throw new Error('Failed to export chit funds');
    await download(response, `ChitFunds_Export_${today()}.xlsx`);
  },
  /** POST /api/chit-funds/:id/auction-bookings `{ month, memberId }` (as the bookings page sent it). */
  addBooking: (id: number, body: { month: number; memberId: number }) =>
    apiFetch<AuctionBooking>(`/chit-funds/${id}/auction-bookings`, { method: 'POST', body }),
  /** DELETE /api/chit-funds/:id/auction-bookings `{ bookingId }`. */
  removeBooking: (id: number, bookingId: number) =>
    apiFetch<{ success?: boolean }>(`/chit-funds/${id}/auction-bookings`, { method: 'DELETE', body: { bookingId } }),
};

/** Default file name of a single-fund export from the list (as before). */
export const listExportFilename = () => `ChitFund_Details_${today()}.xlsx`;
/** File name of a fund's export from its own page (as before). */
export const fundExportFilename = (name: string) => `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${today()}.xlsx`;

// ─────────────────────────────────────────────────────────────── invalidation

const FUND_WRITE_TAGS: QueryTag[] = [CHIT_FUNDS, TEMPLATES, PROJECTION, ...MONEY_TAGS];

/**
 * After a chit fund create/update: every chit funds query, the templates (their "used by"
 * counts), the Auction Plan and the money views. Resolves when mounted queries refetch.
 * `exclude`: queries of the page being left (they would refetch for nothing; the page
 * navigated to revalidates its own queries on mount).
 */
export function invalidateChitFunds(exclude: QueryTag[] = []): Promise<void> {
  invalidateDashboardCache();
  return exclude.length ? invalidateExcept(FUND_WRITE_TAGS, exclude) : invalidate(...FUND_WRITE_TAGS);
}

/**
 * After deleting a fund: as invalidateChitFunds plus the members (their chit-fund counts),
 * except the deleted fund's own queries, which are dropped instead (call `forget` once its
 * page has gone, so it is not refetched into a 404).
 */
export function invalidateDeletedChitFund(id: number): { done: Promise<void>; forget: () => void } {
  invalidateDashboardCache();
  return {
    done: invalidateExcept([...FUND_WRITE_TAGS, 'members'], [chitFundTag(id)]),
    forget: () => dropQueries(chitFundTag(id)),
  };
}

/**
 * After an auction create/update/delete (Phase 6b): that fund's detail, auctions,
 * contributions, members and bookings, the list, the Auction Plan and the money views.
 */
export function invalidateChitFundAuctions(id: number): Promise<void> {
  invalidateDashboardCache();
  return invalidate(chitFundTag(id), ...CHIT_FUND_LIST_TAGS, PROJECTION, ...MONEY_TAGS);
}

/**
 * After a contribution add/delete or a balance payment (Phase 6b): that fund's queries, the
 * list, the member's page (global member id) and the money views.
 */
export function invalidateChitFundContributions(id: number, globalMemberId?: number | null): Promise<void> {
  invalidateDashboardCache();
  return invalidate(
    chitFundTag(id),
    ...CHIT_FUND_LIST_TAGS,
    PROJECTION,
    ...(globalMemberId ? [['members', undefined, globalMemberId] as QueryTag] : []),
    ...MONEY_TAGS
  );
}

/**
 * After a chit member assign/remove/edit: that fund's queries, the list, the members list
 * and the member's page, dues, the Auction Plan and the dashboard. `exclude`: queries of the
 * page being left (the destination revalidates its own on mount).
 */
export function invalidateChitFundMembership(id: number, globalMemberId?: number | null, exclude: QueryTag[] = []): Promise<void> {
  invalidateDashboardCache();
  return invalidateExcept([
    chitFundTag(id),
    ...CHIT_FUND_LIST_TAGS,
    ['members', 'list'],
    ...(globalMemberId ? [['members', undefined, globalMemberId] as QueryTag] : []),
    'dues',
    PROJECTION,
    'dashboard',
  ], exclude);
}

/**
 * After an auction booking add/remove: the Auction Plan (projection). The bookings page
 * updates its own cached bookings in place from the response (as it always updated its
 * state), so the bookings are not refetched.
 */
export function invalidateProjection(): Promise<void> {
  return invalidate(PROJECTION);
}
