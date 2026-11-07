/**
 * Dashboard, trends and calendar data: query keys, read hooks and their endpoints.
 *
 *   const { data } = useDashboardSummary();
 *   const commission = useChitCommission(6);
 *   const month = useCalendarMonth(2026, 11);
 *
 * Every resource here is a MONEY tag ('dashboard', 'trends', 'calendar'), so financial
 * writes elsewhere already invalidate them. Requests are the same URLs the pages sent
 * before (the calendar's month is one request: `action=calendar-month`).
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { queryKeys, registerEndpoint, type QueryKey } from './keys';
import { DUES, type DuesSummary } from './dues';

export const DASHBOARD = 'dashboard';
export const TRENDS = 'trends';
export const CALENDAR = 'calendar';
export const PARTNERS = 'partners';

const search = (params: Record<string, string>) => new URLSearchParams(params).toString();

registerEndpoint(DASHBOARD, (action, _id, params) => {
  if (action === 'balance-summary') return '/balance/summary';
  const query = search(params);
  return `/dashboard/consolidated?action=${action}${query ? `&${query}` : ''}`;
});

registerEndpoint(TRENDS, (action, _id, params) => {
  if (action === 'commission') return `/chit-funds/monthly-profit?${search(params)}`;
  const query = search(params);
  return `/dashboard/consolidated?action=${action}${query ? `&${query}` : ''}`;
});

registerEndpoint(CALENDAR, (_action, _id, params) => `/dashboard/consolidated?action=calendar-month&${search(params)}`);

registerEndpoint(PARTNERS, (action) => (action === 'balances' ? '/partners?includeBalances=true' : '/partners'));

// ─────────────────────────────────────────────────────────────── types

export interface DashboardActivity {
  id: string | number;
  type: string;
  action: string;
  details: string;
  date: string;
  amount?: number;
  entityId?: number;
  entityType?: string;
}

export interface DashboardEvent {
  id: string | number;
  title: string;
  date: string;
  type: string;
  isDueTomorrow?: boolean;
  entityId?: number;
  entityType?: string;
  period?: number;
  dueAmount?: number;
  status?: 'Paid' | 'Overdue';
}

/** GET /dashboard/consolidated?action=summary (raw). */
export interface DashboardSummaryResponse {
  cashInflow?: number;
  cashOutflow?: number;
  investedAmount?: number;
  outsideAmount?: number;
  outsideAmountBreakdown?: {
    activeLoanRemainingAmount?: number;
    nonRecoverableLoanRemainingAmount?: number;
    loanRemainingAmount?: number;
    chitFundOutsideAmount?: number;
  };
  loanDisbursed?: number;
  repaymentInflow?: number;
  loanInterestIncome?: number;
  loanDocumentCharges?: number;
  profit?: { total?: number; loans?: number; chitFunds?: number };
  counts?: { chitFunds?: number; activeChitFunds?: number; members?: number; loans?: number; activeLoans?: number };
  recentActivities?: DashboardActivity[];
  upcomingEvents?: DashboardEvent[];
  totalUpcomingEvents?: number;
  totalActivities?: number;
}

export interface PartnerWithBalance {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  balance?: number;
}

export interface BalanceSummary {
  totalBalance: number;
  partnerBalances?: { partnerId: number; partnerName: string; balance: number }[];
}

/** GET /transactions/aggregations (one window). */
export interface Aggregations {
  expectedLoanRepayment: number;
  actualLoanRepayment: number;
  expectedChitContribution: number;
  actualChitContribution: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
}

export interface AggregationMonth extends Aggregations {
  label: string;
}

export interface CommissionMonth {
  key: string;
  label: string;
  commission: number;
  auctionCount: number;
}

export interface CommissionTrends {
  months: CommissionMonth[];
  summary: {
    commission: number;
    collections: number;
    payouts: number;
    collectionPayoutBalance: number;
    expectedRemainingCommission: number | null;
  };
}

export type TrendDuration = 'weekly' | 'monthly' | 'yearly';

/** How many periods each duration shows (as the trends page always requested). */
export const TREND_LIMITS: Record<TrendDuration, number> = { weekly: 8, monthly: 12, yearly: 5 };

export interface FinancialPeriod {
  label?: string;
  period: string;
  cashInflow: number;
  cashOutflow: number;
  profit: number;
  loanProfit?: number;
  chitFundProfit?: number;
  outsideAmount: number;
  outsideAmountBreakdown?: { loanRemainingAmount?: number; chitFundOutsideAmount?: number };
  cashFlowDetails?: { contributionInflow?: number; repaymentInflow?: number; auctionOutflow?: number; loanOutflow?: number; netCashFlow?: number };
  profitDetails?: { interestPayments?: number; documentCharges?: number; auctionCommissions?: number };
  transactionCounts?: Record<string, number>;
  periodRange?: { startDate: string; endDate: string };
}

export interface FinancialDataResponse {
  labels?: string[];
  cashInflow?: number[];
  cashOutflow?: number[];
  profit?: number[];
  outsideAmount?: number[];
  periodsData?: Partial<FinancialPeriod>[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'Loan' | 'Chit Fund';
  isDueTomorrow?: boolean;
  entityId?: number;
  entityType?: string;
  period?: number;
  status?: 'Paid' | 'Overdue';
  paymentType?: string;
  dueAmount?: number;
}

/** GET /dashboard/consolidated?action=calendar-month&year&month. */
export interface CalendarMonthResponse {
  year: number;
  month: number;
  events: CalendarEvent[];
  aggregations: Partial<Aggregations> | null;
  summary: { totalLoanDisbursement?: number; totalDocumentCharges?: number; totalTransactions?: number; totalAmount?: number } | null;
  chitCommission: { commission: number; auctionCount: number } | null;
  auctionPayoutTotal: number;
}

// ─────────────────────────────────────────────────────────────── keys

export const dashboardKeys = {
  summary: (): QueryKey => queryKeys.action(DASHBOARD, 'summary'),
  balanceSummary: (): QueryKey => queryKeys.action(DASHBOARD, 'balance-summary'),
  partnerBalances: (): QueryKey => queryKeys.action(PARTNERS, 'balances'),
  /** The Dues Tracker figures for the next 7 days (dashboard alert). */
  duesSoon: (): QueryKey => queryKeys.list(DUES, { horizonDays: 7 }),
};

export const trendKeys = {
  commission: (months: number): QueryKey => queryKeys.action(TRENDS, 'commission', null, { months }),
  financialData: (duration: TrendDuration): QueryKey =>
    queryKeys.action(TRENDS, 'financial-data', null, { duration, limit: TREND_LIMITS[duration] }),
};

export const calendarKeys = {
  month: (year: number, month: number): QueryKey => queryKeys.action(CALENDAR, 'month', null, { year, month }),
};

// ─────────────────────────────────────────────────────────────── reads

export function useDashboardSummary(config?: SWRConfiguration<DashboardSummaryResponse>) {
  return useSWR<DashboardSummaryResponse>(dashboardKeys.summary(), config);
}

export function useBalanceSummary(enabled = true) {
  return useSWR<BalanceSummary>(enabled ? dashboardKeys.balanceSummary() : null);
}

export function usePartnerBalances(enabled = true) {
  return useSWR<{ partners: PartnerWithBalance[] }>(enabled ? dashboardKeys.partnerBalances() : null);
}

export function useDuesSoon(enabled = true) {
  return useSWR<{ summary: DuesSummary; accounts?: { maxDaysOverdue?: number }[] }>(enabled ? dashboardKeys.duesSoon() : null);
}

export function useChitCommission(months: number, enabled = true) {
  return useSWR<CommissionTrends>(enabled ? trendKeys.commission(months) : null);
}

export function useFinancialData(duration: TrendDuration | null) {
  return useSWR<FinancialDataResponse>(duration ? trendKeys.financialData(duration) : null);
}

export function useCalendarMonth(year: number | null, month: number | null) {
  return useSWR<CalendarMonthResponse>(year && month ? calendarKeys.month(year, month) : null);
}
