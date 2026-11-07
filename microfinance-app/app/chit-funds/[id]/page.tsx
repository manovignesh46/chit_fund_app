'use client';

/**
 * Chit fund detail (Detail template): header, key-figure strip, tabs in ?tab=, panels.
 *
 * Requests on view: the fund (often preloaded from the list row) and its auctions (all of
 * them in one page; the overview needs the winners to know whether anyone is still
 * eligible). The Contributions tab loads the contributions endpoint (complete status lists,
 * a 1-row page) when it is first opened. The fund's financial figures come from the
 * server's `derivedFields`.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CalendarClock, Eye, EyeOff, FileDown, Gavel, ListChecks, Pencil, Trash2, Users, Wallet } from 'lucide-react';

import { toast } from '@/lib/toast';
import { whenIdle } from '@/lib/query/prefetch';
import { ApiError } from '@/lib/query/fetcher';
import {
  chitFundWrites,
  fundExportFilename,
  invalidateDeletedChitFund,
  useChitFund,
  useChitFundAuctions,
  useChitFundContributionStatus,
  type ChitFundAuction,
  type ChitFundDetail,
} from '@/lib/query/chit-funds';
import SwipeableTabs from '@/app/components/SwipeableTabs';
import { FundContributionsPanel } from '@/app/components/chit-funds/FundContributionsPanel';
import { expectedEndDate } from '@/app/components/chit-funds/ChitFundForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { RowActions, type RowAction } from '@/components/kit/row-actions';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { UrlTabs, useUrlTabs } from '@/components/kit/url-tabs';
import { cn } from '@/lib/utils';

const TABS = ['overview', 'contributions', 'auctions'] as const;
type Tab = (typeof TABS)[number];
type Figure = 'profit' | 'inflow' | 'outflow' | 'outside';

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <SectionCard title={title}>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </SectionCard>
  );
}

export default function ChitFundDetailPage() {
  return (
    <PageContainer fallback={<DetailSkeleton />}>
      <ChitFundDetailView />
    </PageContainer>
  );
}

function ChitFundDetailView() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const fundQuery = useChitFund(id || null);
  const fund = fundQuery.data;
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);

  const tabs = useUrlTabs<Tab>({ values: TABS, defaultValue: 'overview' });
  const [visited, setVisited] = React.useState<ReadonlySet<Tab>>(() => new Set<Tab>(['overview']));
  React.useEffect(() => {
    setVisited((prev) => (prev.has(tabs.value) ? prev : new Set([...prev, tabs.value])));
  }, [tabs.value]);

  const auctionsQuery = useChitFundAuctions(id || null);
  const contributionsQuery = useChitFundContributionStatus(id || null, visited.has('contributions'));
  const [revealed, setRevealed] = React.useState<ReadonlySet<Figure>>(() => new Set());
  const [exporting, setExporting] = React.useState(false);

  if (!fund) {
    if (fundQuery.error) {
      const status = fundQuery.error instanceof ApiError ? fundQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Chit fund not found"
            description={
              status === 404
                ? `Chit fund with ID ${params.id} not found. It may have been deleted or you don't have permission to view it.`
                : errorMessage(fundQuery.error) ?? 'The chit fund you are looking for does not exist or has been removed.'
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/chit-funds">Return to chit funds</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Couldn't load this chit fund" error={fundQuery.error} onRetry={() => void fundQuery.mutate()} />;
    }
    return <DetailSkeleton />;
  }

  const auctions: ChitFundAuction[] = auctionsQuery.data?.auctions ?? [];
  const auctionsLoaded = auctionsQuery.data !== undefined;
  // Members who haven't won an auction yet - a fund can still have payouts left even after
  // its status flips to 'Completed' when multiple auctions share the final month.
  const hasEligibleMembers = auctionsLoaded && (fund.members ?? []).some((member) => !auctions.some((a) => a.winnerId === member.id));
  const canAuction = fund.status === 'Active' || hasEligibleMembers;
  const isFixed = fund.chitFundType === 'Fixed';
  const figures = fund.derivedFields ?? { totalProfit: 0, cashInflow: 0, cashOutflow: 0, outsideAmount: 0 };

  const exportFund = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await chitFundWrites.exportOne(fund.id, fundExportFilename(fund.name));
    } catch {
      toast.error('Failed to export chit fund details. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteFund = async () => {
    await chitFundWrites.remove(fund.id);
    toast.success('Chit fund deleted', { description: fund.name });
    const { forget } = invalidateDeletedChitFund(fund.id);
    router.push('/chit-funds');
    whenIdle(forget);
  };

  const menu: RowAction[] = [
    { label: 'Edit chit fund', icon: Pencil, href: `/chit-funds/${fund.id}/edit` },
    { label: 'Export to Excel', icon: FileDown, onSelect: () => void exportFund(), disabled: exporting },
    {
      label: 'Delete chit fund',
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      confirm: {
        title: `Delete ${fund.name}?`,
        description: 'Are you sure you want to delete this chit fund? This action cannot be undone. Its members, contributions and auctions are deleted with it.',
        confirmLabel: 'Delete chit fund',
        onConfirm: deleteFund,
      },
    },
  ];

  const reveal = (figure: Figure, label: string, value: React.ReactNode) =>
    revealed.has(figure) ? (
      <span className="inline-flex items-center gap-2">
        {value}
        <button
          type="button"
          onClick={() => setRevealed((prev) => new Set([...prev].filter((f) => f !== figure)))}
          aria-label={`Hide ${label}`}
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setRevealed((prev) => new Set([...prev, figure]))}
        aria-label={`Show ${label}`}
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye aria-hidden="true" className="h-4 w-4" />
        Show
      </button>
    );

  const detailItems = [
    { label: 'Total amount', value: <Money value={fund.totalAmount} tone="plain" />, numeric: true },
    { label: isFixed ? 'Monthly contribution (2nd+)' : 'Monthly contribution', value: <Money value={fund.monthlyContribution} tone="plain" />, numeric: true },
    ...(isFixed && fund.firstMonthContribution
      ? [{ label: '1st month contribution', value: <Money value={fund.firstMonthContribution} tone="plain" />, numeric: true }]
      : []),
    { label: 'Duration', value: `${fund.duration} months`, numeric: true },
    { label: 'Total profit', value: reveal('profit', 'total profit', <Money value={figures.totalProfit} tone="plain" className="text-success-text" />) },
    { label: 'Cash inflow', value: reveal('inflow', 'cash inflow', <Money value={figures.cashInflow} tone="plain" />) },
    { label: 'Cash outflow', value: reveal('outflow', 'cash outflow', <Money value={figures.cashOutflow} tone="plain" />) },
    ...(figures.outsideAmount > 0
      ? [{ label: 'Outside amount', value: reveal('outside', 'outside amount', <Money value={figures.outsideAmount} tone="plain" />) }]
      : []),
    {
      label: 'Members (auctioned / total)',
      value: (
        <span className="tabular-nums">
          {fund._count?.auctions ?? auctions.length} / {fund.membersCount}
        </span>
      ),
    },
    { label: 'Next auction date', value: <DateText value={fund.nextAuctionDate} /> },
    { label: 'Start date', value: <DateText value={fund.startDate} /> },
    { label: 'Expected end date', value: <DateText value={expectedEndDate(fund.startDate, fund.duration)} /> },
    { label: 'Chit fund type', value: fund.chitFundType || 'Auction' },
    {
      label: 'Template',
      value: fund.template ? (
        <Link href={`/chit-fund-templates/${fund.template.id}`} className="font-medium text-primary-text hover:underline">
          {fund.template.name}
        </Link>
      ) : (
        'Custom (Legacy)'
      ),
    },
  ];

  const nextPayout = !auctionsLoaded ? null : fund.status === 'Completed' && !hasEligibleMembers
    ? 'This chit fund has been completed.'
    : fund.currentMonth >= fund.duration && !hasEligibleMembers
      ? 'All payouts have been distributed.'
      : 'No eligible members for next payout.';

  const auctionColumns: DataTableColumn<ChitFundAuction>[] = [
    { id: 'month', header: 'Month', numeric: true, sortable: true, cell: (a) => a.month },
    { id: 'date', header: 'Date', sortable: true, sortValue: (a) => new Date(a.date), cell: (a) => <DateText value={a.date} /> },
    {
      id: 'winner',
      header: 'Winner',
      sortable: true,
      sortValue: (a) => a.winner?.globalMember?.name ?? '',
      cell: (a) => <span className="font-medium text-foreground">{a.winner?.globalMember?.name || `Member ID: ${a.winnerId}`}</span>,
    },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: (a) => <Money value={a.amount} tone="outflow" /> },
  ];

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
        eyebrow={`Chit fund #${fund.id} · ${fund.chitFundType || 'Auction'}`}
        title={fund.name}
        status={<StatusBadge status={fund.status} size="md" />}
        description={fund.description || undefined}
        actions={
          <>
            {canAuction ? (
              <Button className={iconOnPhone} asChild>
                <Link href={`/chit-funds/${fund.id}/auctions`}>
                  <Gavel aria-hidden="true" />
                  <span className="max-sm:sr-only">Conduct auction</span>
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className={iconOnPhone} asChild>
              <Link href={`/chit-funds/${fund.id}/members`}>
                <Users aria-hidden="true" />
                <span className="max-sm:sr-only">Members</span>
              </Link>
            </Button>
            <Button variant="outline" className={iconOnPhone} asChild>
              <Link href={`/chit-funds/${fund.id}/contributions`}>
                <ListChecks aria-hidden="true" />
                <span className="max-sm:sr-only">Contributions</span>
              </Link>
            </Button>
            <RowActions label="More chit fund actions" actions={menu} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Current month"
          icon={CalendarClock}
          value={
            <>
              {fund.currentMonth}
              <span className="text-base font-normal text-muted-foreground"> / {fund.duration}</span>
            </>
          }
          hint={<>Started <DateText value={fund.startDate} /></>}
        />
        <StatCard label="Total amount" icon={Wallet} value={<Money value={fund.totalAmount} tone="plain" compact />} hint={<><Money value={fund.monthlyContribution} tone="plain" /> a month</>} />
        <StatCard
          label="Members auctioned"
          icon={Gavel}
          value={
            <>
              {fund._count?.auctions ?? 0}
              <span className="text-base font-normal text-muted-foreground"> / {fund.membersCount}</span>
            </>
          }
          hint={`${fund._count?.members ?? 0} members enrolled`}
        />
        <StatCard label="Next auction" icon={CalendarClock} value={<DateText value={fund.nextAuctionDate} className="text-xl" />} hint={<>Ends <DateText value={expectedEndDate(fund.startDate, fund.duration)} /></>} />
      </div>

      <UrlTabs
        tabs={tabs}
        aria-label="Chit fund sections"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'contributions', label: 'Contributions' },
          { value: 'auctions', label: 'Auctions', count: fund._count?.auctions },
        ]}
      />

      <SwipeableTabs tabs={TABS} activeTab={tabs.value} onTabChange={tabs.setValue}>
        {panel(
          'overview',
          <div className="space-y-6">
            <SectionCard>
              <DescriptionList columns={4} items={detailItems} />
            </SectionCard>

            {isFixed && fund.fixedAmounts?.length > 0 ? (
              <SectionCard title="Fixed amounts by month" description="Predefined auction amounts for each month">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {[...fund.fixedAmounts]
                    .sort((a, b) => a.month - b.month)
                    .map((fixed) => (
                      <li key={fixed.month} className="rounded-lg border bg-elevated p-3 text-center">
                        <p className="text-xs font-medium text-muted-foreground">Month {fixed.month}</p>
                        <p className="mt-1 text-base font-semibold">
                          <Money value={fixed.amount} tone="plain" />
                        </p>
                      </li>
                    ))}
                </ul>
              </SectionCard>
            ) : null}

            <SectionCard title="Next payout">
              {nextPayout === null ? (
                auctionsQuery.error ? (
                  <ErrorState compact title="Couldn't load the auctions" error={auctionsQuery.error} onRetry={() => void auctionsQuery.mutate()} />
                ) : (
                  <div aria-hidden="true" className="space-y-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-6 w-1/2" />
                  </div>
                )
              ) : (
                <p className="text-center text-sm text-muted-foreground">{nextPayout}</p>
              )}
            </SectionCard>
          </div>
        )}
        {panel(
          'contributions',
          !visited.has('contributions') || (!contributionsQuery.data && !contributionsQuery.error) ? (
            <div className="space-y-6">
              <PanelSkeleton title="Contributions overview" />
              <PanelSkeleton title="Outstanding balances" />
            </div>
          ) : contributionsQuery.data ? (
            <FundContributionsPanel fund={fund as ChitFundDetail} data={contributionsQuery.data} />
          ) : (
            <SectionCard title="Contributions overview">
              <ErrorState compact title="Couldn't load the contributions" error={contributionsQuery.error} onRetry={() => void contributionsQuery.mutate()} />
            </SectionCard>
          )
        )}
        {panel(
          'auctions',
          <SectionCard
            title="Auction history"
            actions={
              canAuction ? (
                <Button size="sm" asChild>
                  <Link href={`/chit-funds/${fund.id}/auctions`}>Conduct next auction</Link>
                </Button>
              ) : null
            }
            flush
            contentClassName="p-3 sm:p-4"
          >
            <DataTable<ChitFundAuction>
              label="Auctions"
              mode="client"
              columns={auctionColumns}
              rows={auctions}
              getRowId={(a) => a.id}
              isInitialLoading={!auctionsLoaded && !auctionsQuery.error}
              isRefreshing={auctionsLoaded && auctionsQuery.isLoading}
              error={auctionsQuery.error}
              onRetry={() => void auctionsQuery.mutate()}
              skeletonRows={4}
              emptyState={<EmptyState compact title="No auctions conducted yet." />}
            />
          </SectionCard>
        )}
      </SwipeableTabs>
    </div>
  );
}
