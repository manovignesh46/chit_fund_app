'use client';

/**
 * Members list (List template). List state lives in the URL (page, pageSize, q, sort,
 * order, has); search, filter and sort run on the server over the whole dataset. Rows
 * preload the member's page on hover/touch; the next page preloads when idle.
 * Add and edit open the shared member form in a dialog (no separate edit route).
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, FileDown, Pencil, Plus, Trash2, X } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { invalidateDeletedMember, invalidateMembers, MEMBERS, memberWrites, prefetchMember, type MemberRecord } from '@/lib/query/members';
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
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';

// The form dialog (and its Radix dialog/sheet code) loads on first use.
const MemberFormDialog = dynamic(() => import('@/app/components/members/MemberForm'), { ssr: false });

const SORTS = ['name', 'contact', 'email', 'chitFunds', 'loans', 'createdAt'] as const;
const FILTERS = ['has'] as const;
type Filter = (typeof FILTERS)[number];

const HAS_OPTIONS = [
  { value: ALL, label: 'All members' },
  { value: 'loans', label: 'With loans' },
  { value: 'chits', label: 'In chit funds' },
  { value: 'none', label: 'No loans or chit funds' },
];
const HAS_LABEL: Record<string, string> = { loans: 'With loans', chits: 'In chit funds', none: 'No loans or chit funds' };
const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name, A to Z' },
  { value: 'name:desc', label: 'Name, Z to A' },
  { value: 'contact:asc', label: 'Contact' },
  { value: 'email:asc', label: 'Email' },
  { value: 'chitFunds:desc', label: 'Most chit funds' },
  { value: 'loans:desc', label: 'Most loans' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
];

/**
 * Hover preloads the member page, but only for the row the pointer rests on, and never for
 * a member just deleted (its row stays on screen until the list refetch returns).
 */
// 400 ms: a deliberate rest, not a pointer sweeping down the list. The member detail GET
// recalculates (and writes) the overdue figures of the member's active loans, so a preload
// is not free on the server.
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
      timer.current = setTimeout(() => prefetchMember(id), delay);
    },
    [cancel, delay]
  );
  const forget = React.useCallback((id: number) => {
    gone.current.add(id);
  }, []);
  return { schedule, cancel, forget };
}

export default function MembersPage() {
  return (
    <PageContainer>
      <MembersList />
    </PageContainer>
  );
}

function MembersList() {
  const router = useRouter();
  const list = useListParams<Filter>({ id: 'members', filters: FILTERS, sortable: SORTS });
  const query = useListQuery<MemberRecord>(MEMBERS, list, { itemsKey: 'members' });
  const meta = query.meta;
  const [selected, setSelected] = React.useState<Set<RowId>>(() => new Set());
  const [bulkIds, setBulkIds] = React.useState<number[] | null>(null);
  const [exporting, setExporting] = React.useState(false);
  // Form dialog: null = never opened; then { member } (null member = add).
  const [form, setForm] = React.useState<{ open: boolean; member: MemberRecord | null } | null>(null);
  const prefetch = usePrefetchOnRest();

  // Selection clears whenever the result set changes (page, search, filter, sort, size).
  const resultKey = JSON.stringify(list.apiParams);
  React.useEffect(() => setSelected(new Set()), [resultKey]);

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(MEMBERS, { ...list.apiParams, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, list.apiParams, meta, query.isRefreshing]);

  const selectedIds = React.useMemo(() => Array.from(selected).map(Number), [selected]);
  // From a row menu, focus goes back to that row's menu button when the form closes.
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const openForm = (member: MemberRecord | null, fromMenu = false) => {
    returnFocus.current = fromMenu ? document.querySelector<HTMLElement>('button[aria-haspopup="menu"][data-state="open"]') : null;
    setForm({ open: true, member });
  };

  const deleteMember = async (member: MemberRecord) => {
    prefetch.cancel();
    try {
      await memberWrites.remove(member.id);
      prefetch.forget(member.id);
    } catch (error) {
      toast.error(`Couldn't delete ${member.name}`, { description: errorMessage(error) ?? 'Failed to delete member. Please try again.' });
      return;
    }
    toast.success('Member deleted', { description: member.name });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    invalidateDeletedMember(member.id).forget();
  };

  const exportMembers = async (ids: number[]) => {
    if (exporting || ids.length === 0) return;
    setExporting(true);
    try {
      await memberWrites.exportMembers(ids);
    } catch (error) {
      toast.error('Export failed', { description: errorMessage(error) ?? 'Failed to export members' });
    } finally {
      setExporting(false);
    }
  };

  // One request at a time, in selection order, as before.
  const bulkDelete = async () => {
    const ids = bulkIds ?? [];
    const failures: string[] = [];
    let deleted = 0;
    for (const id of ids) {
      try {
        await memberWrites.remove(id);
        prefetch.forget(id);
        deleted += 1;
      } catch (error) {
        failures.push(errorMessage(error) ?? 'Unknown error');
      }
    }
    if (deleted > 0) {
      setSelected(new Set());
      void invalidateMembers();
    }
    const reasons = Array.from(new Set(failures)).join(' ');
    if (failures.length === 0) {
      toast.success(`${deleted} ${deleted === 1 ? 'member' : 'members'} deleted`);
    } else if (deleted === 0) {
      toast.error(`None of the ${ids.length} ${ids.length === 1 ? 'member was' : 'members were'} deleted`, {
        description: `${reasons} Members with loans or chit funds cannot be deleted.`,
      });
    } else {
      toast.error(`${deleted} of ${ids.length} members deleted, ${failures.length} failed`, {
        description: `${reasons} Members with loans or chit funds cannot be deleted.`,
      });
    }
  };

  const actionsFor = (member: MemberRecord) => (
    <RowActions
      label={`Actions for ${member.name}`}
      actions={[
        { label: 'View', icon: Eye, href: `/members/${member.id}` },
        { label: 'Edit', icon: Pencil, opensDialog: true, onSelect: () => openForm(member, true) },
        { label: 'Export', icon: FileDown, onSelect: () => void exportMembers([member.id]), disabled: exporting },
        {
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          confirm: {
            title: `Delete ${member.name}?`,
            description:
              'This action cannot be undone. Members associated with chit funds or loans cannot be deleted: remove them from all chit funds and loans first.',
            onConfirm: () => deleteMember(member),
          },
        },
      ]}
    />
  );

  const columns: DataTableColumn<MemberRecord>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (member) => (
        <Link
          href={`/members/${member.id}`}
          className="font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {member.name}
        </Link>
      ),
    },
    { id: 'contact', header: 'Contact', sortable: true, cell: (member) => <span className="whitespace-nowrap tabular-nums">{member.contact}</span> },
    {
      id: 'email',
      header: 'Email',
      sortable: true,
      hideBelow: 'lg',
      cell: (member) => (member.email ? <span className="break-all">{member.email}</span> : <span className="text-muted-foreground">—</span>),
    },
    { id: 'chitFunds', header: 'Chit funds', numeric: true, sortable: true, cell: (member) => member._count.chitFundMembers },
    { id: 'loans', header: 'Loans', numeric: true, sortable: true, cell: (member) => member._count.loans },
    { id: 'createdAt', header: 'Added', sortable: true, hideBelow: 'xl', cell: (member) => <DateText value={member.createdAt} /> },
    { id: 'actions', header: <span className="sr-only">Actions</span>, width: '3.5rem', align: 'right', cell: actionsFor },
  ];

  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'q' ? `Search: ${f.value}` : HAS_LABEL[f.value] ?? `${f.name}: ${f.value}`,
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

  const emptyState = list.isFiltered ? (
    <EmptyState
      variant="no-results"
      description={list.params.q ? `No members match "${list.params.q}".` : 'No members match these filters.'}
      onClearFilters={list.clearFilters}
    />
  ) : (
    <EmptyState
      title="No members yet"
      description="Add members to get started: they can then borrow or join chit funds."
      action={
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" />
          Add your first member
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Members"
        count={meta?.totalCount}
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden="true" />
            Add member
          </Button>
        }
      />

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search by name or phone" label="Search members by name or phone" />}
        primaryFilter={
          <NativeSelect
            aria-label="Show"
            className="w-52"
            value={list.params.has ?? ALL}
            onValueChange={(value) => list.setParams({ has: value === ALL ? null : value })}
            options={HAS_OPTIONS}
          />
        }
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order ?? 'asc'}` : 'name:asc'}
            onValueChange={(value) => {
              if (value === 'name:asc') return list.setParams({ sort: null, order: null });
              const [sort, order] = value.split(':');
              list.setParams({ sort, order: order as 'asc' | 'desc' });
            }}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={meta ? formatRange(meta.page, meta.pageSize, meta.totalCount) : null}
      />

      <DataTable<MemberRecord>
        label="Members"
        columns={columns}
        rows={query.items}
        getRowId={(member) => member.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        selection={{ selected, onChange: setSelected, rowLabel: (member) => `Select ${member.name}` }}
        onRowClick={(member) => {
          prefetch.cancel();
          router.push(`/members/${member.id}`);
        }}
        onRowIntent={(member) => prefetch.schedule(member.id)}
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
        renderCard={(member) => (
          <div className="flex gap-3">
            <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                aria-label={`Select ${member.name}`}
                checked={selected.has(member.id)}
                onCheckedChange={(checked) => toggleSelected(member.id, checked === true)}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/members/${member.id}`} className="font-medium text-foreground hover:underline" onClick={(event) => event.stopPropagation()}>
                    {member.name}
                  </Link>
                  <div className="text-sm tabular-nums text-muted-foreground">{member.contact}</div>
                  {member.email ? <div className="truncate text-xs text-muted-foreground">{member.email}</div> : null}
                </div>
                <div className="-mr-2 -mt-2" onClick={(event) => event.stopPropagation()}>
                  {actionsFor(member)}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Chit funds</dt>
                  <dd className="tabular-nums">{member._count.chitFundMembers}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">Loans</dt>
                  <dd className="tabular-nums">{member._count.loans}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      />

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selected members"
          className="sticky bottom-[calc(var(--bottom-nav-height,0px)+0.75rem)] z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-lg"
        >
          <p className="mr-auto text-sm font-medium tabular-nums text-foreground" aria-live="polite">
            {selected.size} selected
          </p>
          <Button variant="outline" size="sm" onClick={() => void exportMembers(selectedIds)} disabled={exporting}>
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
        title={`Delete ${bulkIds?.length ?? 0} ${bulkIds?.length === 1 ? 'member' : 'members'}?`}
        description="This action cannot be undone. Only members not associated with any chit funds or loans are deleted; the others are reported as failures."
        confirmLabel="Delete selected"
        onConfirm={bulkDelete}
      />

      {form ? (
        <MemberFormDialog
          open={form.open}
          onOpenChange={(open) => setForm((prev) => (prev ? { ...prev, open } : prev))}
          member={form.member}
          returnFocusRef={returnFocus}
        />
      ) : null}
    </div>
  );
}
