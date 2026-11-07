'use client';

/**
 * Dashboard (Dashboard template): partner balances first, then the KPI grid on Overview, then Trends,
 * Monthly collections (with the overdue banner), recent activities and upcoming events.
 *
 * - The tab is `?tab=` (UrlTabs owns the bar, SwipeableTabs the swipe panels).
 * - Trends and Collections mount on first visit, so their requests wait until opened.
 * - The summary paints from the localStorage cache (lib/dashboardCache.ts facade) or the
 *   SWR cache at once and always revalidates; a skeleton shows only with neither.
 */
import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Eye,
  EyeOff,
  HandCoins,
  Landmark,
  PiggyBank,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { loadDashboardCache, saveDashboardCache } from '@/lib/dashboardCache';
import { prefetchQuery } from '@/lib/query/prefetch';
import {
  dashboardKeys,
  useBalanceSummary,
  useDashboardSummary,
  usePartnerBalances,
  type DashboardActivity,
  type DashboardEvent,
  type DashboardSummaryResponse,
} from '@/lib/query/dashboard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { chartColor } from '@/components/kit/chart-card';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { Updating } from '@/components/kit/updating';
import { UrlTabs, useUrlTabs } from '@/components/kit/url-tabs';

import SwipeableTabs from '../components/SwipeableTabs';
import CurrentMonthCollections from '../components/CurrentMonthCollections';
import OverdueAlert from '../components/OverdueAlert';
import BusinessROICard from '../components/BusinessROICard';
import CollectionHealthCard from '../components/CollectionHealthCard';
import CapitalUtilizationCard from '../components/CapitalUtilizationCard';
import MonthlyFlowCard from '../components/MonthlyFlowCard';
import YieldMetricsCard from '../components/YieldMetricsCard';
import LoanProfitCard from '../components/LoanProfitCard';
import ChitFundMonthlyProfitCard from '../components/ChitFundMonthlyProfitCard';

// A document load of /dashboard starts its three requests while the page's code is still
// being evaluated, not after hydration (the SWR fetch takes over the request in flight).
if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
  prefetchQuery(dashboardKeys.summary());
  prefetchQuery(dashboardKeys.balanceSummary());
  prefetchQuery(dashboardKeys.partnerBalances());
}

const TABS = ['overview', 'trends', 'collections', 'activities', 'events'] as const;
type Tab = (typeof TABS)[number];

/** The summary as the page has always kept it (also the localStorage cache's shape). */
interface DashboardData {
  totalCashInflow: number;
  totalCashOutflow: number;
  totalProfit: number;
  loanProfit: number;
  chitFundProfit: number;
  totalOutsideAmount: number;
  investedAmount?: number;
  loanDisbursed?: number;
  repaymentInflow?: number;
  loanInterestIncome?: number;
  loanDocumentCharges?: number;
  outsideAmountBreakdown: {
    loanRemainingAmount: number;
    activeLoanRemainingAmount?: number;
    nonRecoverableLoanRemainingAmount?: number;
    chitFundOutsideAmount: number;
  };
  activeChitFunds: number;
  totalMembers: number;
  activeLoans: number;
  recentActivities: DashboardActivity[];
  upcomingEvents: DashboardEvent[];
  totalUpcomingEvents?: number;
  totalActivities?: number;
}

const applyApiData = (data: DashboardSummaryResponse): DashboardData => ({
  totalCashInflow: data.cashInflow || 0,
  totalCashOutflow: data.cashOutflow || 0,
  totalProfit: data.profit?.total || 0,
  loanProfit: data.profit?.loans || 0,
  chitFundProfit: data.profit?.chitFunds || 0,
  totalOutsideAmount: data.outsideAmount || 0,
  investedAmount: data.investedAmount || 0,
  loanDisbursed: data.loanDisbursed || 0,
  repaymentInflow: data.repaymentInflow || 0,
  loanInterestIncome: data.loanInterestIncome,
  loanDocumentCharges: data.loanDocumentCharges,
  outsideAmountBreakdown: {
    loanRemainingAmount: data.outsideAmountBreakdown?.loanRemainingAmount || 0,
    activeLoanRemainingAmount: data.outsideAmountBreakdown?.activeLoanRemainingAmount,
    nonRecoverableLoanRemainingAmount: data.outsideAmountBreakdown?.nonRecoverableLoanRemainingAmount,
    chitFundOutsideAmount: data.outsideAmountBreakdown?.chitFundOutsideAmount || 0,
  },
  activeChitFunds: data.counts?.activeChitFunds || 0,
  totalMembers: data.counts?.members || 0,
  activeLoans: data.counts?.activeLoans || 0,
  recentActivities: data.recentActivities || [],
  upcomingEvents: data.upcomingEvents || [],
  totalUpcomingEvents: data.totalUpcomingEvents || 0,
});

export default function DashboardPage() {
  return (
    <PageContainer fallback={<DashboardSkeleton />}>
      <Dashboard />
    </PageContainer>
  );
}

function Dashboard() {
  const query = useDashboardSummary();
  // The localStorage copy is read after hydration (the prerendered HTML has none).
  const [cached, setCached] = React.useState<DashboardData | null>(null);
  React.useEffect(() => {
    setCached(loadDashboardCache());
  }, []);
  const fresh = React.useMemo(() => (query.data ? applyApiData(query.data) : null), [query.data]);
  React.useEffect(() => {
    if (fresh) saveDashboardCache(fresh);
  }, [fresh]);
  const data = fresh ?? cached;
  const updating = !!data && query.isValidating;

  const tabs = useUrlTabs<Tab>({ values: TABS, defaultValue: 'overview' });
  const [visited, setVisited] = React.useState<ReadonlySet<Tab>>(() => new Set<Tab>(['overview']));
  React.useEffect(() => {
    setVisited((prev) => (prev.has(tabs.value) ? prev : new Set([...prev, tabs.value])));
  }, [tabs.value]);

  const panel = (tab: Tab, children: React.ReactNode) => {
    const active = tabs.value === tab;
    return (
      <div
        role="tabpanel"
        id={tabs.panelId(tab)}
        aria-labelledby={tabs.tabId(tab)}
        className={cn(!active && 'lg:h-0 lg:overflow-hidden')}
        {...({ inert: active ? undefined : true } as Record<string, unknown>)}
      >
        {children}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={updating ? <Updating active>Dashboard</Updating> : 'Dashboard'}
        actions={
          <>
            <Button className={iconOnPhone} variant="outline" asChild>
              <Link href="/members" aria-label="Manage Members">
                <Users aria-hidden="true" />
                <span className="max-sm:sr-only">Members</span>
              </Link>
            </Button>
            <Button className={iconOnPhone} variant="outline" asChild>
              <Link href="/chit-funds/new" aria-label="New Chit Fund">
                <Plus aria-hidden="true" />
                <span className="max-sm:sr-only">New chit fund</span>
              </Link>
            </Button>
            <Button className={iconOnPhone} asChild>
              <Link href="/loans/new" aria-label="New Loan">
                <HandCoins aria-hidden="true" />
                <span className="max-sm:sr-only">New loan</span>
              </Link>
            </Button>
          </>
        }
      />

      {!data ? (
        query.error ? (
          <ErrorState title="Failed to load dashboard data" error={query.error} onRetry={() => void query.mutate()} />
        ) : (
          <DashboardBodySkeleton />
        )
      ) : (
        <>
          <UrlTabs
            tabs={tabs}
            aria-label="Dashboard sections"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'trends', label: 'Trends' },
              { value: 'collections', label: 'Monthly collections' },
              { value: 'activities', label: 'Recent activities', count: data.totalActivities || undefined },
              { value: 'events', label: 'Upcoming events', count: data.totalUpcomingEvents || undefined },
            ]}
          />
          <SwipeableTabs tabs={TABS} activeTab={tabs.value} onTabChange={tabs.setValue}>
            {panel('overview', <OverviewPanel data={data} />)}
            {panel('trends', visited.has('trends') ? <TrendsPanel data={data} /> : <PanelSkeleton />)}
            {panel(
              'collections',
              visited.has('collections') ? (
                <>
                  <OverdueAlert />
                  <CurrentMonthCollections />
                </>
              ) : (
                <PanelSkeleton />
              )
            )}
            {panel('activities', <ActivitiesPanel activities={data.recentActivities} total={data.totalActivities} />)}
            {panel('events', <EventsPanel events={data.upcomingEvents} total={data.totalUpcomingEvents} />)}
          </SwipeableTabs>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── overview

function OverviewPanel({ data }: { data: DashboardData }) {
  const [showProfit, setShowProfit] = React.useState(false);
  const breakdown = data.outsideAmountBreakdown;
  return (
    <div className="space-y-6">
      <PartnerBalances />

      <section aria-label="Cash flow" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Invested amount" icon={PiggyBank} value={<Money value={data.investedAmount || 0} tone="plain" />} hint="Total recorded transactions" />
        <StatCard label="Cash inflow" icon={ArrowUpRight} value={<Money value={data.totalCashInflow} tone="inflow" />} hint="Loan repayments + chit contributions" />
        <StatCard label="Cash outflow" icon={ArrowDownRight} value={<Money value={data.totalCashOutflow} tone="plain" />} hint="Loan disbursements + auction payouts" />
        <StatCard
          label={
            <span className="inline-flex items-center gap-1.5">
              Total profit
              {showProfit ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
            </span>
          }
          aria-label={showProfit ? 'Hide profit' : 'Show profit'}
          aria-pressed={showProfit}
          onClick={() => setShowProfit((v) => !v)}
          value={showProfit ? <Money value={data.totalProfit} tone="auto" /> : <span aria-hidden="true" className="tracking-widest text-muted-foreground">• • •</span>}
          hint={showProfit ? 'Click to hide' : 'Click to show'}
        />
      </section>

      {showProfit ? (
        <section aria-label="Profit breakdown" className="grid grid-cols-2 gap-3">
          <StatCard label="Loan profit" value={<Money value={data.loanProfit} tone="auto" />} hint="From interest and document charges" />
          <StatCard label="Chit fund profit" value={<Money value={data.chitFundProfit} tone="auto" />} hint="From auction commissions" />
        </section>
      ) : null}

      <section aria-label="Outstanding" className="grid grid-cols-2 gap-3">
        <StatCard
          label="Active loan principal"
          icon={Landmark}
          value={<Money value={breakdown.activeLoanRemainingAmount ?? breakdown.loanRemainingAmount} tone="plain" />}
          hint={
            <span className="space-y-0.5">
              <span className="block">
                Total principal: <Money value={breakdown.loanRemainingAmount} tone="plain" />
              </span>
              <Link href="/loans?status=Non-Recoverable" className="block font-medium text-primary-text underline-offset-2 hover:underline">
                Non-Recoverable: <Money value={breakdown.nonRecoverableLoanRemainingAmount || 0} tone="plain" />
              </Link>
            </span>
          }
        />
        <StatCard label="Outstanding chit funds" icon={Wallet} value={<Money value={breakdown.chitFundOutsideAmount} tone="plain" />} hint="Pending or over-disbursed" />
      </section>

      <section aria-label="Counts" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active loans" value={data.activeLoans.toLocaleString('en-IN')} href="/loans" hint="View loans" />
        <StatCard label="Active chit funds" value={data.activeChitFunds.toLocaleString('en-IN')} href="/chit-funds" hint="View chit funds" />
        <StatCard label="Total members" icon={Users} value={data.totalMembers.toLocaleString('en-IN')} href="/members" hint="Chit fund members and borrowers" className="col-span-2 sm:col-span-1" />
      </section>
    </div>
  );
}

function PartnerBalances({ className }: { className?: string }) {
  const balance = useBalanceSummary();
  const partners = usePartnerBalances();
  const list = partners.data?.partners ?? [];
  const total = balance.data?.totalBalance ?? 0;
  return (
    <SectionCard
      title="Partner-wise balance"
      className={className}
      actions={
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total balance</p>
          <div className="text-lg font-semibold">{balance.data ? <Money value={total} tone="plain" className={total < 0 ? 'text-destructive-text' : undefined} /> : <Skeleton className="h-6 w-24" />}</div>
        </div>
      }
      flush
    >
      {!partners.data ? (
        partners.error ? (
          <ErrorState compact title="Couldn't load partner balances" error={partners.error} onRetry={() => void partners.mutate()} />
        ) : (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState compact title="No partners found" />
      ) : (
        <ul className="max-h-64 divide-y overflow-y-auto">
          {list.map((partner) => {
            const amount = partner.balance ?? 0;
            const credit = amount >= 0;
            return (
              <li key={partner.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {partner.name.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{partner.name}</p>
                    <p className="text-xs text-muted-foreground">{credit ? 'Credit balance' : 'Debit balance'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    <Money value={Math.abs(amount)} tone="plain" className={credit ? undefined : 'text-destructive-text'} />
                  </p>
                  <p className={cn('text-xs font-medium', credit ? 'text-muted-foreground' : 'text-destructive-text')}>{credit ? 'CR' : 'DR'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────── trends

function TrendsPanel({ data }: { data: DashboardData }) {
  const loanOutstanding = data.outsideAmountBreakdown.loanRemainingAmount;
  return (
    <div className="space-y-8">
      <section aria-labelledby="chit-trends-title" className="space-y-4">
        <div>
          <h2 id="chit-trends-title" className="text-lg font-semibold text-foreground">Chit Fund</h2>
          <p className="text-sm text-muted-foreground">Member-funded rotation. Earnings come from payout commission.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ChitFundMonthlyProfitCard />
          <CollectionHealthCard business="chit" />
        </div>
      </section>
      <section aria-labelledby="loan-trends-title" className="space-y-4">
        <div>
          <h2 id="loan-trends-title" className="text-lg font-semibold text-foreground">Loans</h2>
          <p className="text-sm text-muted-foreground">Invested capital earns interest and document charges.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LoanProfitCard
            loanDisbursed={data.loanDisbursed || 0}
            repaymentInflow={data.repaymentInflow || 0}
            loanOutstanding={loanOutstanding}
            loanProfit={data.loanProfit}
            interestIncome={data.loanInterestIncome}
            documentCharges={data.loanDocumentCharges}
          />
          <CollectionHealthCard business="loan" />
          <BusinessROICard loanProfit={data.loanProfit} investedAmount={data.investedAmount || 0} />
          <CapitalUtilizationCard loanOutstanding={loanOutstanding} investedAmount={data.investedAmount || 0} />
        </div>
      </section>
      <section aria-labelledby="business-trends-title" className="space-y-4">
        <div>
          <h2 id="business-trends-title" className="text-lg font-semibold text-foreground">Business &amp; Capital</h2>
          <p className="text-sm text-muted-foreground">Combined earnings, with member collections kept separate from income.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <YieldMetricsCard loanProfit={data.loanProfit} chitFundProfit={data.chitFundProfit} investedAmount={data.investedAmount || 0} />
          <MonthlyFlowCard />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── activity lists

function entityHref(item: { entityType?: string; entityId?: number }): string | null {
  if (item.entityType === 'loan' && item.entityId) return `/loans/${item.entityId}`;
  if (item.entityType === 'chitFund' && item.entityId) return `/chit-funds/${item.entityId}`;
  return null;
}

function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColor(type === 'Chit Fund' ? 2 : 1) }} />
      {type}
    </span>
  );
}

function ListRow({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = 'block px-4 py-3 sm:px-6';
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function ActivitiesPanel({ activities, total }: { activities: DashboardActivity[]; total?: number }) {
  return (
    <SectionCard
      title="Recent activities"
      flush
      footer={
        <Button variant="outline" size="sm" asChild>
          <Link href="/activities">
            {total && total > 3 ? `View all ${total} activities` : 'View all activities'}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {activities.length === 0 ? (
        <EmptyState compact title="No recent activities found." />
      ) : (
        <ul className="divide-y">
          {activities.map((activity) => (
            <li key={activity.id}>
              <ListRow href={entityHref(activity)}>
                <div className="flex items-start justify-between gap-3">
                  <TypeTag type={activity.type} />
                  <span className="text-xs text-muted-foreground">{activity.date}</span>
                </div>
                <p className="mt-1 font-medium text-foreground">{activity.action}</p>
                <p className="text-sm text-muted-foreground">{activity.details}</p>
                {activity.amount ? (
                  <p className="mt-1 text-sm">
                    Amount: <Money value={activity.amount} tone="plain" />
                  </p>
                ) : null}
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EventsPanel({ events, total }: { events: DashboardEvent[]; total?: number }) {
  return (
    <SectionCard
      title="Upcoming events"
      flush
      footer={
        <Button variant="outline" size="sm" asChild>
          <Link href="/calendar">
            <CalendarDays aria-hidden="true" />
            {total && total > 3 ? `View all ${total} events` : 'View full calendar'}
          </Link>
        </Button>
      }
    >
      {!events || events.length === 0 ? (
        <EmptyState compact title="No upcoming events found." />
      ) : (
        <ul className="divide-y">
          {events.map((event) => (
            <li key={event.id}>
              <ListRow href={entityHref(event)}>
                <p className="font-medium text-foreground">{event.title}</p>
                <p className="text-sm text-muted-foreground">{event.date}</p>
                {event.dueAmount !== undefined ? (
                  <p className="mt-1 text-sm">
                    Amount: <Money value={event.dueAmount} tone="plain" />
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <TypeTag type={event.type} />
                  {event.isDueTomorrow ? <StatusBadge status="Due Tomorrow" /> : null}
                  {event.status === 'Paid' ? <StatusBadge status="Paid" /> : null}
                  {event.status === 'Overdue' ? <StatusBadge status="Overdue" /> : null}
                </div>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────── skeletons

function PanelSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function DashboardBodySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex gap-4 border-b pb-3">
        {[5, 4, 9, 8, 8].map((w, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${w}rem` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <DashboardBodySkeleton />
    </div>
  );
}
