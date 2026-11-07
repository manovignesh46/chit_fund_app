/**
 * Transactions data family: keys, endpoints, writes and invalidation.
 *
 *   const query = useListQuery<TransactionRecord>(TRANSACTIONS, list, { itemsKey: 'transactions' });
 *   const summary = useTransactionSummary(filters);
 *   await transactionWrites.create(body, partnerName);
 *   await invalidateTransactions();
 *
 * Keys: ['transactions', action, null, params]. URLs: list → `/transactions?…`, other
 * actions → `/transactions/<action>?…` (summary, aggregations, pending-loans, pending-chits).
 */
import useSWR from 'swr';
import { invalidateDashboardCache } from '../dashboardCache';
import { apiFetch } from './fetcher';
import { invalidate, MONEY_TAGS } from './invalidate';
import { queryKeys, registerEndpoint, type QueryKey, type QueryParams } from './keys';
import type { Aggregations, AggregationMonth } from './dashboard';
import { PARTNERS } from './dashboard';

export const TRANSACTIONS = 'transactions';

registerEndpoint(TRANSACTIONS, (action, _id, params) => {
  const query = new URLSearchParams(params).toString();
  const path = action === 'list' ? '/transactions' : `/transactions/${action}`;
  return `${path}${query ? `?${query}` : ''}`;
});

// ─────────────────────────────────────────────────────────────── types

export interface TransactionRecord {
  id: number;
  type: string;
  amount: number;
  member?: string;
  from_partner?: string | null;
  to_partner?: string | null;
  action_performer: string;
  entered_by: string;
  date: string;
  createdAt: string;
  note?: string | null;
  partnerBalance?: number | null;
  totalBalance?: number | null;
}

export interface PartnerSummaryRow {
  partnerName: string;
  loanRepayments: number;
  loanDisbursements: number;
  documentCharges: number;
  chitContributions: number;
  auctionPayouts: number;
  recordedAmounts: number;
  partnerTransfers: number;
  partnerTotalAmount: number;
}

export interface TransactionSummaryResponse {
  totalLoanRepayment: number;
  totalLoanDisbursement: number;
  totalDocumentCharges: number;
  totalChitContributions: number;
  totalAuctionPayouts: number;
  totalRecordedAmount: number;
  totalPartnerTransfers: number;
  totalAmount: number;
  totalTransactions: number;
  partnerBreakdown: PartnerSummaryRow[];
}

export interface PendingLoan {
  id: number;
  borrowerName: string;
  loanType: string;
  totalAmount: number;
  installmentAmount: number;
  pendingAmount: number;
  pendingPeriods: number;
  repaymentType: string;
  maxDaysOverdue?: number;
  periods?: PendingPeriod[];
}

export interface PendingPeriod {
  period: number;
  dueDate: string;
  outstanding: number;
  status: string;
  daysOverdue: number;
}

export interface PendingChitMember {
  memberId?: number;
  memberName: string;
  pendingAmount: number;
  pendingPeriods: number;
  pendingMonths?: number[];
  maxDaysOverdue?: number;
  periods?: PendingPeriod[];
}

export interface PendingChitFund {
  id: number;
  name: string;
  totalAmount: number;
  installmentAmount: number;
  frequency: string;
  pendingMembers: PendingChitMember[];
  totalPendingAmount: number;
}

/** Body of POST /api/transactions for a manual entry (as TransactionForm has always sent it). */
export interface ManualTransactionBody {
  type: string;
  amount: string;
  date: string;
  note: string;
  from_partner_id: string | number | null;
  to_partner_id: string | number | null;
}

// ─────────────────────────────────────────────────────────────── keys

export const transactionKeys = {
  list: (params?: QueryParams): QueryKey => queryKeys.list(TRANSACTIONS, params),
  summary: (params?: QueryParams): QueryKey => queryKeys.action(TRANSACTIONS, 'summary', null, params ?? {}),
  aggregations: (startDate: string, endDate: string): QueryKey =>
    queryKeys.action(TRANSACTIONS, 'aggregations', null, { startDate, endDate }),
  aggregationMonths: (months: number): QueryKey => queryKeys.action(TRANSACTIONS, 'aggregations', null, { months }),
  pendingLoans: (startDate: string, endDate: string): QueryKey =>
    queryKeys.action(TRANSACTIONS, 'pending-loans', null, { startDate, endDate }),
  pendingChits: (startDate: string, endDate: string): QueryKey =>
    queryKeys.action(TRANSACTIONS, 'pending-chits', null, { startDate, endDate }),
};

// ─────────────────────────────────────────────────────────────── reads

export function useTransactionSummary(params: QueryParams | null) {
  return useSWR<TransactionSummaryResponse>(params ? transactionKeys.summary(params) : null);
}

export function useAggregations(startDate: string | null, endDate: string | null) {
  return useSWR<Aggregations>(startDate && endDate ? transactionKeys.aggregations(startDate, endDate) : null);
}

export function useAggregationMonths(months: number, enabled = true) {
  return useSWR<{ months: AggregationMonth[] }>(enabled ? transactionKeys.aggregationMonths(months) : null);
}

export function usePendingLoans(range: { startDate: string; endDate: string } | null) {
  return useSWR<{ pendingLoans: PendingLoan[] }>(range ? transactionKeys.pendingLoans(range.startDate, range.endDate) : null);
}

export function usePendingChits(range: { startDate: string; endDate: string } | null) {
  return useSWR<{ pendingChitFunds: PendingChitFund[] }>(range ? transactionKeys.pendingChits(range.startDate, range.endDate) : null);
}

// ─────────────────────────────────────────────────────────────── writes

export const transactionWrites = {
  /** Manual entry; `partner` goes in x-active-partner (the selected partner's name, or ''). */
  create: (body: ManualTransactionBody, partner: string) =>
    apiFetch<unknown>('/transactions', { method: 'POST', body, headers: { 'x-active-partner': partner } }),
  /** Recompute every stored running balance (POST /api/recalculate-balances, no body, as before). */
  recalculateBalances: () =>
    apiFetch<{ transactionsProcessed?: number; finalTotalBalance?: number }>('/recalculate-balances', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────── invalidation

/** After a manual transaction, a partner transfer or a balance recalculation. */
export function invalidateTransactions(): Promise<void> {
  invalidateDashboardCache();
  return invalidate(PARTNERS, ...MONEY_TAGS);
}
