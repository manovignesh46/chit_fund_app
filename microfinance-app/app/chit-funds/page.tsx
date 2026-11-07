'use client';

/**
 * Chit funds list (List template). List state lives in the URL (page, pageSize, q, sort,
 * order, status; status defaults to Active); search, filter and sort run on the server over
 * the whole dataset. The key figures come from one summary request. Rows preload the fund's
 * page after the pointer rests on them; the next page preloads when idle.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Copy, Eye, FileDown, Files, Pencil, Plus, RotateCw, Trash2, Users, Wallet, X } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import {
  CHIT_FUNDS,
  chitFundWrites,
  invalidateChitFunds,
  invalidateDeletedChitFund,
  listExportFilename,
  prefetchChitFund,
  useChitFundsSummary,
  type ChitFundRecord,
} from '@/lib/query/chit-funds';
import { errorMessage } from '@/components/kit/error-state';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn, type RowId } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';

const SORTS = ['name', 'totalAmount', 'monthlyContribution', 'currentMonth', 'members', 'status', 'nextAuctionDate', 'startDate', 'createdAt'] as const;
const FILTERS = ['status'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Completed', label: 'Completed' },
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name, A to Z' },
  { value: 'name:desc', label: 'Name, Z to A' },
  { value: 'totalAmount:desc', label: 'Largest total amount' },
  { value: 'monthlyContribution:desc', label: 'Largest monthly contribution' },
  { value: 'currentMonth:desc', label: 'Furthest along' },
  { value: 'nextAuctionDate:asc', label: 'Next auction soonest' },
  { value: 'startDate:desc', label: 'Started most recently' },
];

/**
 * Hover preloads the fund's page, but only for the row the pointer rests on (400 ms), and
 * never for a fund just deleted. The chit-funds GETs run the shared current-month update
 * (which can write), so a preload is not free on the server.
 */
function usePrefetchOnRest(delay = 400) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gone = React.useRef(new Set<number>());
  const cancel = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  React.useEffect(() => cancel, [cancel]);
  const schedule = React.useCallback(
    (id: number) => {
      cancel();
      if (gone.current.has(id)) return;
      timer.current = setTimeout(() => {
        // Checked again when the timer fires: the fund may have been deleted meanwhile.
        if (!gone.current.has(id)) prefetchChitFund(id);
      }, delay);
    },
    [cancel, delay]
  );
  const forget = React.useCallback((id: number) => {
    gone.current.add(id);
  }, []);
  return { schedule, cancel, forget };
}

export default function ChitFundsPage() {
  return (
    <PageContainer>
      <ChitFundsList />
    </PageContainer>
  );
}

function ChitFundsList() {
  const router = useRouter();
  // The default sort is sent explicitly (sort=createdAt&order=desc): the server then adds the id
  // tiebreaker, so funds created at the same moment never repeat or vanish across pages. Calls
  // without a sort keep the legacy order.
  const list = useListParams<Filter>({ id: 'chit-funds', filters: FILTERS, defaults: { status: 'Active', sort: 'createdAt', order: 'desc' }, sortable: SORTS });
  const query = useListQuery<ChitFundRecord>(CHIT_FUNDS, list, { itemsKey: 'chitFunds' });
  const summary = useChitFundsSummary();
  const meta = query.meta;
  const status = list.params.status ?? 'Active';
  const [selected, setSelected] = React.useState<Set<RowId>>(() => new Set());
  const [bulkIds, setBulkIds] = React.useState<number[] | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const prefetch = usePrefetchOnRest();

  // Selection clears whenever the result set changes (page, search, filter, sort, size).
  const resultKey = JSON.stringify(list.apiParams);
  React.useEffect(() => setSelected(new Set()), [resultKey]);

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(CHIT_FUNDS, { ...list.apiParams, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, list.apiParams, meta, query.isRefreshing]);

  const rows = query.items;
  const selectedIds = React.useMemo(() => Array.from(selected).map(Number), [selected]);
  const nameOf = (id: number) => rows.find((f) => f.id === id)?.name ?? `Chit fund #${id}`;

  const refresh = () => {
    void query.mutate();
    void summary.mutate();
  };

  const deleteFund = async (fund: ChitFundRecord) => {
    prefetch.cancel();
    prefetch.forget(fund.id);
    try {
      await chitFundWrites.remove(fund.id);
    } catch (error) {
      throw new Error(errorMessage(error) ?? 'Failed to delete chit fund');
    }
    toast.success('Chit fund deleted', { description: fund.name });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(fund.id);
      return next;
    });
    invalidateDeletedChitFund(fund.id).forget();
  };

  const exportFunds = async (ids: number[]) => {
    if (exporting || ids.length === 0) return;
    setExporting(true);
    try {
      // One fund: the single-fund export; several: the bulk export (as before).
      if (ids.length === 1) await chitFundWrites.exportOne(ids[0], listExportFilename());
      else await chitFundWrites.exportMany(ids);
    } catch {
      toast.error('Failed to export chit funds. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // One request at a time, in selection order; HTTP errors count as failures.
  const bulkDelete = async () => {
    const ids = bulkIds ?? [];
    prefetch.cancel();
    ids.forEach(prefetch.forget);
    const failures: string[] = [];
    let deleted = 0;
    for (const id of ids) {
      try {
        await chitFundWrites.remove(id);
        deleted += 1;
      } catch (error) {
        failures.push(`${nameOf(id)}: ${errorMessage(error) ?? 'Unknown error'}`);
      }
    }
    if (deleted > 0) {
      setSelected(new Set());
      void invalidateChitFunds();
    }
    if (failures.length === 0) {
      toast.success(`${deleted} chit ${deleted === 1 ? 'fund' : 'funds'} deleted`);
    } else if (deleted === 0) {
      throw new Error(`Failed to delete ${failures.length} chit ${failures.length === 1 ? 'fund' : 'funds'}. ${failures.join(' · ')}`);
    } else {
      toast.error(`${deleted} of ${ids.length} chit funds deleted, ${failures.length} failed`, { description: failures.join(' · ') });
    }
  };

  const deleteDescription = (count: number) =>
    `This action cannot be undone. This will also delete all members, contributions, and auctions associated with ${count === 1 ? 'this chit fund' : 'these chit funds'}.`;

  const actionsFor = (fund: ChitFundRecord) => (
    <RowActions
      label={`Actions for ${fund.name}`}
      actions={[
        { label: 'View', icon: Eye, href: `/chit-funds/${fund.id}` },
        { label: 'Edit', icon: Pencil, href: `/chit-funds/${fund.id}/edit` },
        { label: 'Copy', icon: Copy, href: `/chit-funds/new?copy=${fund.id}` },
        { label: 'Export', icon: FileDown, onSelect: () => void exportFunds([fund.id]), disabled: exporting },
        {
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          confirm: {
            title: `Delete ${fund.name}?`,
            description: deleteDescription(1),
            confirmLabel: 'Delete chit fund',
            onConfirm: () => deleteFund(fund),
          },
        },
      ]}
    />
  );

  const fundName = (fund: ChitFundRecord, onClick?: (event: React.MouseEvent) => void) => (
    <span className="inline-flex min-w-0 items-center gap-2">
      {fund.hasPendingContribution ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" title="Pending contribution">
          <span className="sr-only">Pending contribution</span>
        </span>
      ) : null}
      <Link
        href={`/chit-funds/${fund.id}`}
        onClick={onClick}
        className="truncate font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {fund.name}
      </Link>
    </span>
  );

  const columns: DataTableColumn<ChitFundRecord>[] = [
    { id: 'name', header: 'Name', sortable: true, cell: (fund) => fundName(fund) },
    { id: 'totalAmount', header: 'Total amount', numeric: true, sortable: true, cell: (fund) => <Money value={fund.totalAmount} tone="plain" /> },
    {
      id: 'monthlyContribution',
      header: 'Monthly',
      numeric: true,
      sortable: true,
      hideBelow: 'lg',
      cell: (fund) => <Money value={fund.monthlyContribution} tone="plain" />,
    },
    {
      id: 'currentMonth',
      header: <span title="Current month / duration">Month</span>,
      numeric: true,
      sortable: true,
      cell: (fund) => (
        <span className="whitespace-nowrap">
          {fund.currentMonth || 0}
          <span className="text-muted-foreground"> / {fund.duration}</span>
        </span>
      ),
    },
    {
      id: 'members',
      header: <span title="Members auctioned / members">Auctioned</span>,
      numeric: true,
      sortable: true,
      hideBelow: 'xl',
      cell: (fund) => (
        <span className="whitespace-nowrap">
          {fund._count?.auctions || 0}
          <span className="text-muted-foreground"> / {fund._count?.members || 0}</span>
        </span>
      ),
    },
    { id: 'status', header: 'Status', sortable: true, cell: (fund) => <StatusBadge status={fund.status} /> },
    { id: 'nextAuctionDate', header: 'Next auction', sortable: true, hideBelow: 'lg', cell: (fund) => <DateText value={fund.nextAuctionDate} /> },
    { id: 'actions', header: <span className="sr-only">Actions</span>, width: '3.5rem', align: 'right', cell: actionsFor },
  ];

  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'q' ? `Search: ${f.value}` : `Status: ${f.value === ALL ? 'All' : f.value}`,
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));

  const toggleSelected = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const emptyState = list.params.q ? (
    <EmptyState variant="no-results" description={`No chit funds match "${list.params.q}".`} onClearFilters={list.clearFilters} />
  ) : status !== ALL ? (
    <EmptyState
      title={`No ${status.toLowerCase()} chit funds`}
      description={`No chit funds found with status "${status}".`}
      action={
        <Button size="sm" variant="outline" onClick={() => list.setParams({ status: ALL })}>
          Show all statuses
        </Button>
      }
    />
  ) : (
    <EmptyState
      title="No chit funds yet"
      description="Create a chit fund, or start from a template."
      action={
        <Button size="sm" asChild>
          <Link href="/chit-funds/new">
            <Plus aria-hidden="true" />
            Create your first chit fund
          </Link>
        </Button>
      }
    />
  );

  const stats = summary.data;
  return (
    <div>
      <PageHeader
        title="Chit funds"
        count={meta?.totalCount}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh" title="Refresh">
              <RotateCw aria-hidden="true" className={query.isValidating ? 'motion-safe:animate-spin' : undefined} />
            </Button>
            <Button variant="outline" className={iconOnPhone} asChild>
              <Link href="/chit-fund-templates">
                <Files aria-hidden="true" />
                <span className="max-sm:sr-only">Templates</span>
              </Link>
            </Button>
            <Button className={iconOnPhone} asChild>
              <Link href="/chit-funds/new">
                <Plus aria-hidden="true" />
                <span className="max-sm:sr-only">Add chit fund</span>
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active chit funds"
          icon={Building2}
          loading={!stats && !summary.error}
          value={stats ? stats.active.toLocaleString('en-IN') : '—'}
          onClick={() => list.setParams({ status: null })}
        />
        <StatCard
          label="Total value"
          icon={Wallet}
          loading={!stats && !summary.error}
          value={<Money value={stats?.totalValue ?? null} tone="plain" compact />}
          hint="Active funds"
        />
        <StatCard
          label="Total members"
          icon={Users}
          loading={!stats && !summary.error}
          value={stats ? stats.totalMembers.toLocaleString('en-IN') : '—'}
          hint="Active funds"
        />
        <StatCard
          label="Upcoming"
          icon={Clock}
          loading={!stats && !summary.error}
          value={stats ? stats.upcoming.toLocaleString('en-IN') : '—'}
          onClick={() => list.setParams({ status: 'Upcoming' })}
        />
      </div>

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search chit funds by name" label="Search chit funds by name" />}
        primaryFilter={
          <NativeSelect
            aria-label="Status"
            className="w-44"
            value={status}
            onValueChange={(value) => list.setParams({ status: value === 'Active' ? null : value })}
            options={STATUS_OPTIONS}
          />
        }
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order ?? 'asc'}` : 'createdAt:desc'}
            onValueChange={(value) => {
              if (value === 'createdAt:desc') return list.setParams({ sort: null, order: null });
              const [sort, order] = value.split(':');
              list.setParams({ sort, order: order as 'asc' | 'desc' });
            }}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={meta ? formatRange(meta.page, meta.pageSize, meta.totalCount) : null}
      />

      <DataTable<ChitFundRecord>
        label="Chit funds"
        columns={columns}
        rows={rows}
        getRowId={(fund) => fund.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        selection={{ selected, onChange: setSelected, rowLabel: (fund) => `Select ${fund.name}` }}
        onRowClick={(fund) => {
          prefetch.cancel();
          router.push(`/chit-funds/${fund.id}`);
        }}
        onRowIntent={(fund) => prefetch.schedule(fund.id)}
        emptyState={emptyState}
        pagination={
          meta
            ? {
                page: meta.page,
                pageSize: list.params.pageSize,
                totalCount: meta.totalCount,
                onPageChange: (page) => list.setParams({ page }),
                onPageSizeChange: (pageSize) => list.setParams({ pageSize }),
              }
            : undefined
        }
        renderCard={(fund) => (
          <div className="flex gap-3">
            <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
              <Checkbox aria-label={`Select ${fund.name}`} checked={selected.has(fund.id)} onCheckedChange={(checked) => toggleSelected(fund.id, checked === true)} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {/* Same shape as the loans card: name and type on the left, status and menu on the right. */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {fundName(fund, (event) => event.stopPropagation())}
                  <div className="text-xs text-muted-foreground">
                    {fund.chitFundType || 'Chit fund'} · <Money value={fund.totalAmount} tone="plain" />
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <StatusBadge status={fund.status} />
                  <div className="-mr-2 -mt-2" onClick={(event) => event.stopPropagation()}>
                    {actionsFor(fund)}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Monthly</dt>
                  <dd>
                    <Money value={fund.monthlyContribution} tone="plain" />
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">Month</dt>
                  <dd className="tabular-nums">
                    {fund.currentMonth || 0} / {fund.duration}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Auctioned / members</dt>
                  <dd className="tabular-nums">
                    {fund._count?.auctions || 0} / {fund._count?.members || 0}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">Next auction</dt>
                  <dd>
                    <DateText value={fund.nextAuctionDate} />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      />

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selected chit funds"
          className="sticky bottom-[calc(var(--bottom-nav-height,0px)+0.75rem)] z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-lg"
        >
          <p className="mr-auto text-sm font-medium tabular-nums text-foreground" aria-live="polite">
            {selected.size} selected
          </p>
          <Button variant="outline" size="sm" onClick={() => void exportFunds(selectedIds)} disabled={exporting}>
            <FileDown aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export selected'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkIds(selectedIds)}>
            <Trash2 aria-hidden="true" />
            Delete selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkIds !== null}
        onOpenChange={(open) => !open && setBulkIds(null)}
        title={`Delete ${bulkIds?.length ?? 0} chit ${bulkIds?.length === 1 ? 'fund' : 'funds'}?`}
        description={deleteDescription(bulkIds?.length ?? 0)}
        confirmLabel="Delete selected"
        onConfirm={bulkDelete}
      />
    </div>
  );
}
