'use client';

/**
 * Activities (List template): every loan repayment, chit contribution, auction and loan
 * disbursement, newest first. List state is in the URL (q, type, from, to, sort, order,
 * page, pageSize); the server pages the whole dataset in SQL (lib/activitiesList.ts), so
 * search, filters and sort cover every activity, not just the current page.
 * A row opens its loan or chit fund.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

import { formatDate } from '@/lib/format';
import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { ACTIVITIES, activityHref, type ActivityRow } from '@/lib/query/activities';

import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { FormField } from '@/components/kit/form-field';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money, type MoneyTone } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { DateRangePicker, describePeriod } from '@/components/kit/period-picker';
import { SearchInput } from '@/components/kit/search-input';

const FILTERS = ['type', 'from', 'to'] as const;
type Filter = (typeof FILTERS)[number];
const SORTS = ['date', 'amount'] as const;

const TYPE_OPTIONS = [
  { value: ALL, label: 'Loans and chit funds' },
  { value: 'loan', label: 'Loans' },
  { value: 'chit', label: 'Chit funds' },
];
const TYPE_LABEL: Record<string, string> = { loan: 'Loans only', chit: 'Chit funds only' };
const SORT_OPTIONS = [
  { value: 'default', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'amount:desc', label: 'Largest amount' },
  { value: 'amount:asc', label: 'Smallest amount' },
];

/** Money received shows as an inflow (+₹, green); disbursements and auctions as plain amounts. */
function amountTone(activity: ActivityRow): MoneyTone {
  return activity.action === 'Repayment Received' || activity.action === 'Contribution Received' ? 'inflow' : 'plain';
}

/**
 * The server already formats the date ("06 Nov 2026", the same text as formatDate); it is
 * shown as is because re-parsing that text with `new Date()` is not reliable in every browser.
 */
function ActivityDate({ value }: { value: string }) {
  return <span className="whitespace-nowrap tabular-nums">{value || '—'}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full border bg-muted px-2 text-xs font-medium text-muted-foreground">
      {type}
    </span>
  );
}

export default function ActivitiesPage() {
  return (
    <PageContainer>
      <ActivitiesList />
    </PageContainer>
  );
}

function ActivitiesList() {
  const router = useRouter();
  const list = useListParams<Filter>({ id: 'activities', filters: FILTERS, sortable: SORTS });
  const p = list.params;

  // The server's default order is newest first; it is sent explicitly so every request
  // takes the SQL-paged path (a request without list params runs the legacy handler).
  const request = React.useMemo(() => {
    const out: Record<string, string | number> = { ...list.apiParams };
    if (!p.sort) {
      out.sort = 'date';
      out.order = 'desc';
    }
    return out;
  }, [list.apiParams, p.sort]);

  const query = useListQuery<ActivityRow>(ACTIVITIES, { apiParams: request, ready: list.ready, setParams: list.setParams }, { itemsKey: 'activities' });
  const meta = query.meta;

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(ACTIVITIES, { ...request, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, request, meta, query.isRefreshing]);

  const columns: DataTableColumn<ActivityRow>[] = [
    { id: 'type', header: 'Type', cell: (a) => <TypeBadge type={a.type} /> },
    { id: 'action', header: 'Action', cell: (a) => <span className="whitespace-nowrap font-medium text-foreground">{a.action}</span> },
    { id: 'details', header: 'Details', cell: (a) => <span className="text-muted-foreground">{a.details}</span> },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: (a) => <Money value={a.amount} tone={amountTone(a)} /> },
    { id: 'date', header: 'Date', sortable: true, cell: (a) => <ActivityDate value={a.date} /> },
    {
      id: 'view',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      width: '5rem',
      cell: (a) => {
        const href = activityHref(a);
        return href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View
            <span className="sr-only"> {a.entityType === 'loan' ? 'loan' : 'chit fund'}</span>
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">N/A</span>
        );
      },
    },
  ];

  const chipLabel = (name: string, value: string): string => {
    if (name === 'q') return `Search: ${value}`;
    if (name === 'type') return TYPE_LABEL[value] ?? value;
    if (name === 'from') return `From ${formatDate(value)}`;
    if (name === 'to') return `To ${formatDate(value)}`;
    return value;
  };
  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: chipLabel(f.name, f.value),
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));
  const filterCount = (p.from ? 1 : 0) + (p.to ? 1 : 0);

  const emptyState = list.isFiltered ? (
    <EmptyState
      variant="no-results"
      description={p.q ? `No activities match "${p.q}".` : 'No activities match these filters.'}
      onClearFilters={list.clearFilters}
    />
  ) : (
    <EmptyState title="No activities yet" description="Loan repayments, chit contributions, auctions and loan disbursements appear here as they are recorded." />
  );

  return (
    <div>
      <PageHeader
        title="Activities"
        count={meta?.totalCount}
        description="Repayments, contributions, auctions and loan disbursements."
      />

      <ListToolbar
        search={<SearchInput value={p.q} onChange={(q) => list.setParams({ q })} placeholder="Search by borrower or chit fund" label="Search activities by borrower or chit fund name" />}
        primaryFilter={
          <NativeSelect
            aria-label="Type"
            className="w-52"
            value={p.type ?? ALL}
            onValueChange={(value) => list.setParams({ type: value === ALL ? null : value })}
            options={TYPE_OPTIONS}
          />
        }
        filters={
          <FormField label="Period">
            <DateRangePicker from={p.from} to={p.to} onChange={(from, to) => list.setParams({ from, to })} />
          </FormField>
        }
        filterCount={filterCount}
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={p.sort ? `${p.sort}:${p.order ?? 'asc'}` : 'default'}
            onValueChange={(value) => {
              if (value === 'default') return list.setParams({ sort: null, order: null });
              const [sort, order] = value.split(':');
              list.setParams({ sort, order: order as 'asc' | 'desc' });
            }}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={meta ? `${formatRange(meta.page, meta.pageSize, meta.totalCount)}${p.from || p.to ? ` · ${describePeriod(p.from, p.to)}` : ''}` : null}
      />

      <DataTable<ActivityRow>
        label="Activities"
        columns={columns}
        rows={query.items}
        getRowId={(a) => a.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: p.sort, order: p.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        onRowClick={(a) => {
          const href = activityHref(a);
          if (href) router.push(href);
        }}
        emptyState={emptyState}
        pagination={
          meta
            ? {
                page: meta.page,
                pageSize: p.pageSize,
                totalCount: meta.totalCount,
                onPageChange: (page) => list.setParams({ page }),
                onPageSizeChange: (pageSize) => list.setParams({ pageSize }),
              }
            : undefined
        }
        renderCard={(a) => {
          const href = activityHref(a);
          return (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{a.action}</p>
                  <p className="text-sm text-muted-foreground">{a.details}</p>
                </div>
                <Money value={a.amount} tone={amountTone(a)} className="font-medium" />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <TypeBadge type={a.type} />
                  <ActivityDate value={a.date} />
                </div>
                {href ? (
                  <Link
                    href={href}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary-text"
                  >
                    {a.entityType === 'loan' ? 'Open loan' : 'Open chit fund'}
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
