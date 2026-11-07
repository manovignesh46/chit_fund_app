'use client';

/**
 * Dues Tracker (Report template with a paged list).
 *
 * The dues are computed on the server from every active loan and chit membership. Search,
 * filters, sort and paging are URL state (q, kind, status, aging, horizonDays, sort, page,
 * pageSize) and run on the server over that computed result, with the same rules this page
 * used to apply in the browser (lib/duesList.ts). The KPI tiles and aging always describe
 * every account; the count line and the CSV describe the filtered list (all pages).
 */
import * as React from 'react';
import { Download, RefreshCw } from 'lucide-react';

import { toast } from '@/lib/toast';
import DueAccountCard from '@/app/components/dues/DueAccountCard';
import { useListParams } from '@/lib/list/useListParams';
import { normaliseListResponse, useListQuery } from '@/lib/list/useListQuery';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { AGING_BUCKETS, DUES, exportDuesCsv, type DueAccount, type DuesListResponse, type DuesSummary } from '@/lib/query/dues';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshProgress } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { FormField } from '@/components/kit/form-field';
import { ListPagination } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SearchInput } from '@/components/kit/search-input';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';

const FILTERS = ['kind', 'status', 'aging', 'horizonDays'] as const;
type Filter = (typeof FILTERS)[number];
const SORTS = ['overdue', 'amount', 'name'] as const;

const KIND_OPTIONS = [
  { value: '', label: 'Loans & chits' },
  { value: 'loan', label: 'Loans only' },
  { value: 'chit', label: 'Chit funds only' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'Overdue & upcoming' },
  { value: 'overdue', label: 'Overdue only' },
  { value: 'upcoming', label: 'Upcoming only' },
];
const HORIZON_OPTIONS = [
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
];
const SORT_OPTIONS = [
  { value: 'overdue', label: 'Most overdue' },
  { value: 'amount', label: 'Highest amount' },
  { value: 'name', label: 'Name A–Z' },
];
// Aging colours: older debt reads stronger (amber → red), no orange outside charts.
const AGING_STYLE: Record<string, string> = {
  '1-30': 'bg-warning/60',
  '31-60': 'bg-warning',
  '61-90': 'bg-destructive/70',
  '90+': 'bg-destructive',
};

interface DuesExtras {
  summary: DuesSummary;
  filtered: { count: number; totalOutstanding: number };
  horizonDays: number;
}

export default function DuesTrackerPage() {
  return (
    <PageContainer>
      <DuesTracker />
    </PageContainer>
  );
}

function DuesTracker() {
  const list = useListParams<Filter>({ id: 'dues', filters: FILTERS, sortable: SORTS, defaults: { horizonDays: '30', sort: 'overdue', pageSize: 25 } });
  const query = useListQuery<DueAccount, DuesExtras>(DUES, list, {
    itemsKey: 'accounts',
    select: (raw, request) => {
      const body = (raw ?? {}) as DuesListResponse;
      return {
        ...normaliseListResponse<DueAccount>(raw, request, 'accounts'),
        summary: { summary: body.summary, filtered: body.filtered ?? { count: 0, totalOutstanding: 0 }, horizonDays: body.horizonDays },
      };
    },
  });
  const meta = query.meta;
  const extras = query.summary;
  const summary = extras?.summary;
  const horizonDays = list.params.horizonDays ?? '30';
  const [exporting, setExporting] = React.useState(false);

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(DUES, { ...list.apiParams, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, list.apiParams, meta, query.isRefreshing]);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await exportDuesCsv(list.apiParams);
      toast(`Downloading ${rows} ${rows === 1 ? 'account' : 'accounts'}`);
    } catch (error) {
      toast.error('Export failed', { description: errorMessage(error) ?? 'Failed to load dues' });
    } finally {
      setExporting(false);
    }
  };

  const agingTotal = summary ? AGING_BUCKETS.reduce((s, k) => s + (summary.aging[k] || 0), 0) : 0;
  const loadingFirst = query.isInitialLoading;

  const chipLabel = (name: string, value: string) => {
    if (name === 'q') return `Search: ${value}`;
    if (name === 'kind') return KIND_OPTIONS.find((o) => o.value === value)?.label ?? value;
    if (name === 'status') return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
    if (name === 'aging') return `Overdue ${value} days`;
    if (name === 'horizonDays') return `Look ahead: ${value} days`;
    return `${name}: ${value}`;
  };
  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: chipLabel(f.name, f.value),
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));
  const filterCount = (list.params.kind ? 1 : 0) + (list.params.aging ? 1 : 0) + (horizonDays !== '30' ? 1 : 0);
  const narrowed = !!(list.params.q || list.params.kind || list.params.status || list.params.aging);

  return (
    <div>
      <PageHeader
        title="Dues Tracker"
        description="Overdue and upcoming loan installments and chit contributions"
        actions={
          <>
            <Button variant="outline" onClick={() => void query.mutate()} disabled={query.isValidating}>
              <RefreshCw aria-hidden="true" className={cn(query.isValidating && 'motion-safe:animate-spin')} />
              {query.isValidating ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button onClick={() => void exportCsv()} disabled={!extras?.filtered.count || exporting}>
              <Download aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          loading={loadingFirst}
          tone={(summary?.overdueAmount ?? 0) > 0 ? 'destructive' : 'neutral'}
          value={summary ? <Money value={summary.overdueAmount} tone="plain" /> : '—'}
          hint={summary ? `${summary.overdueAccounts} accounts · ${summary.overdueMembers} members` : undefined}
          onClick={() => list.setParams({ status: 'overdue', aging: null })}
        />
        <StatCard
          label="Due in next 7 days"
          loading={loadingFirst}
          tone={(summary?.dueSoonAmount ?? 0) > 0 ? 'warning' : 'neutral'}
          value={summary ? <Money value={summary.dueSoonAmount} tone="plain" /> : '—'}
          hint="Includes today"
          onClick={() => list.setParams({ status: 'upcoming', aging: null })}
        />
        <StatCard
          label={`Due later (≤ ${horizonDays} days)`}
          loading={loadingFirst}
          value={summary ? <Money value={summary.dueLaterAmount} tone="plain" /> : '—'}
          hint="Upcoming"
          onClick={() => list.setParams({ status: 'upcoming', aging: null })}
        />
        <StatCard
          label="Total to collect"
          loading={loadingFirst}
          value={summary ? <Money value={summary.totalOutstanding} tone="plain" /> : '—'}
          hint="Overdue + upcoming"
          onClick={() => list.setParams({ status: null, aging: null })}
        />
      </div>

      {summary && agingTotal > 0 ? (
        <SectionCard
          title="Overdue aging"
          className="mb-4"
          contentClassName="p-4"
          actions={
            list.params.aging ? (
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => list.setParams({ aging: null })}>
                Clear aging filter
              </Button>
            ) : undefined
          }
        >
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {AGING_BUCKETS.map((k) =>
              summary.aging[k] > 0 ? <div key={k} className={AGING_STYLE[k]} style={{ width: `${(summary.aging[k] / agingTotal) * 100}%` }} /> : null
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AGING_BUCKETS.map((k) => {
              const active = list.params.aging === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => list.setParams({ aging: active ? null : k, status: 'overdue' })}
                  className={cn(
                    'min-h-11 rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'border-primary bg-primary-subtle' : 'border-transparent hover:bg-accent'
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 rounded-sm', AGING_STYLE[k])} />
                    {k} days
                  </span>
                  <span className="block text-sm font-semibold text-foreground">
                    <Money value={summary.aging[k] || 0} tone="plain" />
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search member, account, phone" label="Search dues" />}
        primaryFilter={
          <NativeSelect
            aria-label="Status"
            className="w-56"
            value={list.params.status ?? ''}
            onValueChange={(value) => list.setParams({ status: value || null, aging: null })}
            options={STATUS_OPTIONS}
          />
        }
        filters={
          <>
            <FormField label="Type">
              <NativeSelect value={list.params.kind ?? ''} onValueChange={(value) => list.setParams({ kind: value || null })} options={KIND_OPTIONS} />
            </FormField>
            <FormField label="Look ahead">
              <NativeSelect value={horizonDays} onValueChange={(value) => list.setParams({ horizonDays: value === '30' ? null : value })} options={HORIZON_OPTIONS} />
            </FormField>
            <FormField label="Overdue for">
              <NativeSelect
                value={list.params.aging ?? ''}
                onValueChange={(value) => list.setParams(value ? { aging: value, status: 'overdue' } : { aging: null })}
                placeholder="Any age"
                options={AGING_BUCKETS.map((k) => ({ value: k, label: `${k} days` }))}
              />
            </FormField>
          </>
        }
        filterCount={filterCount}
        actions={
          <NativeSelect
            aria-label="Sort"
            size="sm"
            value={list.params.sort ?? 'overdue'}
            onValueChange={(value) => list.setParams({ sort: value === 'overdue' ? null : value })}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={
          extras && meta ? (
            <>
              {extras.filtered.count.toLocaleString('en-IN')} {extras.filtered.count === 1 ? 'account' : 'accounts'} · <Money value={extras.filtered.totalOutstanding} tone="plain" />
            </>
          ) : null
        }
      />

      {query.error && query.items.length === 0 ? (
        <ErrorState title="Couldn't load dues" error={query.error} onRetry={() => void query.mutate()} />
      ) : loadingFirst ? (
        <div className="space-y-2" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : query.items.length === 0 ? (
        <div className="rounded-xl border bg-card">
          {narrowed ? (
            <EmptyState variant="no-results" title="Nothing to collect here" description="No dues match the current filters." onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState title="Nothing to collect" description={`Nothing is overdue or due in the next ${horizonDays} days.`} />
          )}
        </div>
      ) : (
        <div className="relative" data-state={query.isRefreshing ? 'refreshing' : 'ready'} aria-busy={query.isRefreshing || undefined}>
          <RefreshProgress active={query.isRefreshing} />
          <ul className={cn('space-y-2 transition-opacity', query.isRefreshing && 'opacity-60')}>
            {query.items.map((a) => (
              <DueAccountCard key={a.key} account={a} />
            ))}
          </ul>
          {meta ? (
            <ListPagination
              className="mt-4"
              page={meta.page}
              pageSize={list.params.pageSize}
              totalCount={meta.totalCount}
              onPageChange={(page) => list.setParams({ page })}
              onPageSizeChange={(pageSize) => list.setParams({ pageSize })}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
