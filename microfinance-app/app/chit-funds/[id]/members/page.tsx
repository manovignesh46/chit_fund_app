'use client';

/**
 * A fund's members (List template): who is in the fund, what each owes (server figures),
 * who has won, with assign / create, record contribution, export and remove.
 *
 * List state (page, pageSize, q, sort, order, auction) lives in the URL; search, the auction
 * filter and sort run on the server (`members` with list params). The fund comes from the
 * shared cache (the page used to read it with a plain fetch on every view). The global-member
 * picker searches the server 25 at a time (it used to load up to 1,000 people in one request).
 *
 * "Add month N due" and "Record contribution" are optimistic: the member's row shows "Saving"
 * and the server's missed/pending figures show "Updating…" until the fund has been refetched.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileDown, ListChecks, Plus, Trash2, UserPlus, X } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { normaliseListResponse, useListQuery } from '@/lib/list/useListQuery';
import { ApiError } from '@/lib/query/fetcher';
import { invalidate } from '@/lib/query/invalidate';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import {
  CHIT_FUNDS,
  chitFundKeys,
  chitFundWrites,
  invalidateChitFundMembership,
  useChitFund,
  type ChitFundMemberListRow,
  type ChitFundMembersResponse,
} from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn, type RowId } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { StatusBadge } from '@/components/kit/status-badge';
import { Updating } from '@/components/kit/updating';
import { ContributionBusyError, pendingFor, todayIso, useContributionWrites } from '@/app/components/chit-funds/contribution-writes';
import { quickContributionBody, quickContributionValues, type QuickContributionValues } from '@/app/components/chit-funds/QuickContributionDialog';

const AddFundMemberDialog = dynamic(() => import('@/app/components/chit-funds/AddFundMemberDialog'), { ssr: false });
const QuickContributionDialog = dynamic(() => import('@/app/components/chit-funds/QuickContributionDialog'), { ssr: false });

const SORTS = ['name', 'contact', 'joinDate', 'contribution'] as const;
const FILTERS = ['auction'] as const;
type Filter = (typeof FILTERS)[number];
const AUCTION_OPTIONS = [
  { value: '', label: 'All members' },
  { value: 'won', label: 'Won an auction' },
  { value: 'notwon', label: 'Not won yet' },
];
const AUCTION_LABEL: Record<string, string> = { won: 'Won an auction', notwon: 'Not won yet' };
const SORT_OPTIONS = [
  { value: 'joinDate:asc', label: 'Join date (oldest first)' },
  { value: 'name:asc', label: 'Name, A to Z' },
  { value: 'name:desc', label: 'Name, Z to A' },
  { value: 'contact:asc', label: 'Contact' },
  { value: 'joinDate:desc', label: 'Newest first' },
  { value: 'contribution:desc', label: 'Highest contribution' },
];
const REMOVE_WARNING = 'All contributions made by this member will be removed. Any auctions won by this member will be affected. This may affect the chit fund\'s financial records. (Members with contributions or auctions cannot be removed.)';

type MembersPage = { contributionMap: ChitFundMembersResponse['contributionMap'] };

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function ChitFundMembersPage() {
  return (
    <PageContainer fallback={<PageSkeleton />}>
      <FundMembers />
    </PageContainer>
  );
}

function FundMembers() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const fundQuery = useChitFund(id || null);
  const fund = fundQuery.data;
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);

  // Default order is the legacy one (join date, oldest first), sent explicitly so the server adds
  // the id tiebreaker: without it, members who joined on the same day could repeat across pages.
  const list = useListParams<Filter>({ id: 'chit-fund-members', filters: FILTERS, sortable: SORTS, defaults: { sort: 'joinDate', order: 'asc' } });
  const query = useListQuery<ChitFundMemberListRow, MembersPage>(CHIT_FUNDS, list, {
    action: 'members',
    id,
    enabled: !!id,
    select: (raw, request) => {
      const result = normaliseListResponse<ChitFundMemberListRow, MembersPage>(raw, request, 'members');
      return { ...result, summary: { contributionMap: (raw as ChitFundMembersResponse)?.contributionMap ?? [] } };
    },
  });
  const meta = query.meta;
  const writes = useContributionWrites(id);
  const [selected, setSelected] = React.useState<Set<RowId>>(() => new Set());
  const [bulkRemove, setBulkRemove] = React.useState<number[] | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addMounted, setAddMounted] = React.useState(false);
  const [record, setRecord] = React.useState<{ open: boolean; member: ChitFundMemberListRow; month: number; values: QuickContributionValues; error: string | null } | null>(null);

  const resultKey = JSON.stringify(list.apiParams);
  React.useEffect(() => setSelected(new Set()), [resultKey]);

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!id || !list.ready || !meta?.hasNext || query.isRefreshing) return;
    return whenIdle(() => prefetchQuery(chitFundKeys.members(id, { ...list.apiParams, page: meta.page + 1 })));
  }, [id, list.ready, list.apiParams, meta, query.isRefreshing]);

  const contributionMap = query.summary?.contributionMap;
  const paidMonths = React.useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const c of contributionMap ?? []) {
      let months = map.get(c.memberId);
      if (!months) map.set(c.memberId, (months = new Set()));
      months.add(c.month);
    }
    return map;
  }, [contributionMap]);
  const enrolled = React.useMemo(() => new Set((fund?.members ?? []).map((m) => m.globalMemberId)), [fund]);
  const rowsById = React.useMemo(() => new Map(query.items.map((m) => [m.id, m])), [query.items]);

  if (!fund) {
    if (fundQuery.error) {
      const status = fundQuery.error instanceof ApiError ? fundQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Chit fund not found"
            description="The chit fund you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/chit-funds">Back to chit funds</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Couldn't load this chit fund" error={fundQuery.error} onRetry={() => void fundQuery.mutate()} />;
    }
    return <PageSkeleton />;
  }

  const currentMonth = fund.currentMonth;
  const hasMonth = (memberId: number, month: number) => paidMonths.get(memberId)?.has(month) ?? false;
  const dueBody = (memberId: number) => ({
    memberId,
    month: currentMonth,
    amount: fund.monthlyContribution, // the full amount, as before
    paidDate: todayIso(),
    notes: null,
  });
  const failMessage = (error: unknown, fallback: string) => (error instanceof ContributionBusyError ? error.message : errorMessage(error) ?? fallback);

  const addDue = async (member: ChitFundMemberListRow) => {
    if (hasMonth(member.id, currentMonth)) {
      toast.error(`Contribution for month ${currentMonth} already exists for this member`);
      return;
    }
    try {
      await writes.record(dueBody(member.id), member.globalMemberId);
      toast.success(`Added month ${currentMonth} contribution for ${member.globalMember.name}`);
    } catch (error) {
      toast.error('Contribution not added', { description: failMessage(error, 'Failed to add contribution. Please try again.') });
    }
  };

  const selectedIds = Array.from(selected).map(Number);
  const addDueForSelected = async () => {
    try {
      const result = await writes.recordMany(
        selectedIds.map((memberId) => ({ body: dueBody(memberId), globalMemberId: rowsById.get(memberId)?.globalMemberId, skip: hasMonth(memberId, currentMonth) }))
      );
      if (result.saved > 0) toast.success(`Added month ${currentMonth} contribution for ${result.saved} member${result.saved > 1 ? 's' : ''}`);
      if (result.failed > 0) toast.error(`Failed to add contribution for ${result.failed} member${result.failed > 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Contributions not added', { description: failMessage(error, 'Failed to add contributions. Please try again.') });
    }
  };

  const openRecord = (member: ChitFundMemberListRow) => {
    // The first month from 1 to the current month without a contribution.
    let month = 1;
    for (let m = 1; m <= (currentMonth || 1); m++) {
      if (!hasMonth(member.id, m)) {
        month = m;
        break;
      }
    }
    const amount = month === 1 ? String(fund.firstMonthContribution || '') : String(fund.monthlyContribution || '');
    setRecord({ open: true, member, month, values: quickContributionValues(amount), error: null });
  };
  const submitRecord = (values: QuickContributionValues) => {
    if (!record) return;
    const { member, month } = record;
    setRecord({ ...record, open: false, values });
    void writes
      .record(quickContributionBody(member.id, month, values), member.globalMemberId)
      .then(() => toast.success('Contribution recorded', { description: `Successfully recorded contribution for ${member.globalMember.name} for month ${month}` }))
      .catch((error) => {
        const message = failMessage(error, 'Failed to record contribution. Please try again.');
        toast.error('Contribution not recorded', { description: message });
        setRecord({ open: true, member, month, values, error: message });
      });
  };

  const membershipChanged = (globalMemberIds: number[]) => {
    void invalidateChitFundMembership(fund.id, globalMemberIds.length === 1 ? globalMemberIds[0] : null);
    if (globalMemberIds.length > 1) for (const g of globalMemberIds) void invalidate(['members', undefined, g]);
  };

  const removeMember = async (member: ChitFundMemberListRow) => {
    await chitFundWrites.removeMember(fund.id, member.id);
    toast.success('Member removed', { description: `${member.globalMember.name} · ${fund.name}` });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    membershipChanged([member.globalMemberId]);
  };

  // One request at a time, in selection order, as before.
  const removeSelected = async () => {
    const ids = bulkRemove ?? [];
    const removed: number[] = [];
    let failed = 0;
    for (const memberId of ids) {
      try {
        await chitFundWrites.removeMember(fund.id, memberId);
        removed.push(memberId);
      } catch {
        failed += 1;
      }
    }
    if (removed.length > 0) {
      toast.success(`Successfully removed ${removed.length} member${removed.length > 1 ? 's' : ''} from the chit fund.`);
      setSelected(new Set());
      membershipChanged(removed.map((m) => rowsById.get(m)?.globalMemberId).filter((g): g is number => !!g));
    }
    if (failed > 0) toast.error(`Failed to remove ${failed} member${failed > 1 ? 's' : ''} from the chit fund.`, { description: 'Members with contributions or auctions cannot be removed.' });
  };

  const exportMembers = (ids: number[]) => {
    try {
      chitFundWrites.exportMembers(fund.id, ids);
    } catch (error) {
      toast.error('Export failed', { description: errorMessage(error) ?? 'Failed to export members' });
    }
  };

  const busyFor = (member: ChitFundMemberListRow) => !!pendingFor(writes.pending, member.id);
  const dueButton = (member: ChitFundMemberListRow) =>
    hasMonth(member.id, currentMonth) ? null : busyFor(member) ? (
      <StatusBadge status="saving" />
    ) : (
      <Button size="sm" variant="outline" className="whitespace-nowrap" disabled={writes.busy} onClick={() => void addDue(member)} aria-label={`Add month ${currentMonth} due`} title="Add current month contribution">
        <Plus aria-hidden="true" />
        Month {currentMonth} due
      </Button>
    );
  const actionsFor = (member: ChitFundMemberListRow) => (
    <RowActions
      label={`Actions for ${member.globalMember.name}`}
      actions={[
        { label: 'Contributions', icon: ListChecks, href: `/chit-funds/${fund.id}/members/${member.id}/contributions` },
        { label: 'Export', icon: FileDown, onSelect: () => exportMembers([member.id]) },
        {
          label: 'Remove from fund',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          confirm: {
            title: `Remove ${member.globalMember.name} from this chit fund?`,
            description: `Are you sure you want to remove this member from the chit fund? This action cannot be undone. ${REMOVE_WARNING}`,
            confirmLabel: 'Remove',
            onConfirm: () => removeMember(member),
          },
        },
      ]}
    />
  );
  const missedCell = (member: ChitFundMemberListRow) => (
    <Updating active={busyFor(member)}>
      <span className="flex flex-col items-end gap-1">
        <span className={member.missedContributions > 0 ? 'font-semibold text-destructive-text' : undefined}>{member.missedContributions}</span>
        {member.missedContributions > 0 && !busyFor(member) ? (
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" disabled={writes.busy} onClick={() => openRecord(member)} aria-label="Record contribution">
            Record
          </Button>
        ) : null}
      </span>
    </Updating>
  );
  const auctionBadge = (member: ChitFundMemberListRow) =>
    member.auctionWon ? <StatusBadge status="Paid" label={`Won in Month ${member.auctionMonth}`} /> : <StatusBadge status="Pending" label="Not Won Yet" />;
  const nameLink = (member: ChitFundMemberListRow) => (
    <Link href={`/chit-funds/${fund.id}/members/${member.id}/contributions`} className="font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {member.globalMember.name}
    </Link>
  );

  const columns: DataTableColumn<ChitFundMemberListRow>[] = [
    { id: 'name', header: 'Name', sortable: true, cell: nameLink },
    { id: 'contact', header: 'Contact', sortable: true, cell: (m) => <span className="whitespace-nowrap tabular-nums">{m.globalMember.contact}</span> },
    { id: 'joinDate', header: 'Join date', sortable: true, hideBelow: '2xl', cell: (m) => <DateText value={m.joinDate} /> },
    { id: 'contribution', header: 'Contribution', sortable: true, numeric: true, cell: (m) => <Money value={m.contribution} tone="plain" /> },
    { id: 'missed', header: 'Missed', numeric: true, cell: missedCell },
    { id: 'pending', header: 'Pending amount', numeric: true, cell: (m) => <Updating active={busyFor(m)}><Money value={m.pendingAmount} tone="overdue" className={m.pendingAmount > 0 ? 'font-semibold' : undefined} /></Updating> },
    { id: 'auction', header: 'Auction', cell: auctionBadge },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (m) => (
        <div className="flex items-center justify-end gap-1">
          {dueButton(m)}
          {actionsFor(m)}
        </div>
      ),
    },
  ];

  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'q' ? `Search: ${f.value}` : AUCTION_LABEL[f.value] ?? `${f.name}: ${f.value}`,
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));
  const openAdd = () => {
    setAddMounted(true);
    setAddOpen(true);
  };
  const toggleSelected = (memberId: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(memberId);
      else next.delete(memberId);
      return next;
    });

  return (
    <div>
      <PageHeader
        eyebrow={`Chit fund #${fund.id} · ${fund.name}`}
        title="Members"
        count={meta?.totalCount}
        description={
          <>
            Month {fund.currentMonth} of {fund.duration} · Monthly contribution <Money value={fund.monthlyContribution} tone="plain" />
          </>
        }
        actions={
          <>
            <Button className={iconOnPhone} variant="outline" asChild>
              <Link href={`/chit-funds/${fund.id}/contributions`}>
                <ListChecks aria-hidden="true" />
                <span className="max-sm:sr-only">View contributions</span>
              </Link>
            </Button>
            <Button className={iconOnPhone} onClick={openAdd}>
              <UserPlus aria-hidden="true" />
              <span className="max-sm:sr-only">Add member</span>
            </Button>
          </>
        }
      />

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search by name or phone" label="Search this fund's members by name or phone" />}
        primaryFilter={<NativeSelect aria-label="Auction" className="w-48" value={list.params.auction ?? ''} onValueChange={(value) => list.setParams({ auction: value || null })} options={AUCTION_OPTIONS} />}
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order ?? 'asc'}` : 'joinDate:asc'}
            onValueChange={(value) => {
              if (value === 'joinDate:asc') return list.setParams({ sort: null, order: null });
              const [sort, order] = value.split(':');
              list.setParams({ sort, order: order as 'asc' | 'desc' });
            }}
            options={SORT_OPTIONS}
          />
        }
        chips={<FilterChips chips={chips} onClearAll={list.clearFilters} />}
        resultSummary={meta ? formatRange(meta.page, meta.pageSize, meta.totalCount) : null}
      />

      <DataTable<ChitFundMemberListRow>
        label="Members"
        columns={columns}
        rows={query.items}
        getRowId={(m) => m.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        selection={{ selected, onChange: setSelected, rowLabel: (m) => `Select ${m.globalMember.name}` }}
        rowClassName={(m) => (busyFor(m) ? 'bg-info-subtle/60' : undefined)}
        emptyState={
          list.isFiltered ? (
            <EmptyState variant="no-results" description={list.params.q ? `No members match "${list.params.q}".` : 'No members match these filters.'} onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState
              title="No members found"
              description="Add members to this chit fund."
              action={
                <Button size="sm" onClick={openAdd}>
                  <UserPlus aria-hidden="true" />
                  Add member
                </Button>
              }
            />
          )
        }
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
        renderCard={(m) => (
          <div className="flex gap-3">
            <div className="pt-0.5">
              <Checkbox aria-label={`Select ${m.globalMember.name}`} checked={selected.has(m.id)} onCheckedChange={(c) => toggleSelected(m.id, c === true)} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {nameLink(m)}
                  <div className="text-sm tabular-nums text-muted-foreground">{m.globalMember.contact}</div>
                  <div className="mt-1">{auctionBadge(m)}</div>
                </div>
                <div className="-mr-2 -mt-2">{actionsFor(m)}</div>
              </div>
              <dl className="grid grid-cols-3 gap-x-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Contribution</dt>
                  <dd>
                    <Money value={m.contribution} tone="plain" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Missed</dt>
                  <dd>
                    <Updating active={busyFor(m)}>
                      <span className={m.missedContributions > 0 ? 'font-semibold text-destructive-text' : undefined}>{m.missedContributions}</span>
                    </Updating>
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">Pending</dt>
                  <dd>
                    <Updating active={busyFor(m)}>
                      <Money value={m.pendingAmount} tone="overdue" />
                    </Updating>
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap justify-end gap-1.5">
                {m.missedContributions > 0 && !busyFor(m) ? (
                  <Button size="sm" variant="outline" disabled={writes.busy} onClick={() => openRecord(m)}>
                    Record contribution
                  </Button>
                ) : null}
                {dueButton(m)}
              </div>
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
          <Button variant="outline" size="sm" onClick={() => void addDueForSelected()} disabled={writes.busy}>
            <Plus aria-hidden="true" />
            {writes.busy ? 'Processing…' : `Add month ${currentMonth} due (${selected.size})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMembers(selectedIds)}>
            <FileDown aria-hidden="true" />
            Export selected ({selected.size})
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkRemove(selectedIds)}>
            <Trash2 aria-hidden="true" />
            Remove selected ({selected.size})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkRemove !== null}
        onOpenChange={(open) => !open && setBulkRemove(null)}
        title={`Remove ${bulkRemove?.length ?? 0} ${bulkRemove?.length === 1 ? 'member' : 'members'} from the chit fund?`}
        description={`Are you sure you want to remove ${bulkRemove?.length ?? 0} selected member${(bulkRemove?.length ?? 0) > 1 ? 's' : ''} from the chit fund? This action cannot be undone. All contributions made by these members will be removed. Any auctions won by these members will be affected. This may affect the chit fund's financial records.`}
        confirmLabel="Remove selected"
        onConfirm={removeSelected}
      />

      {addMounted ? <AddFundMemberDialog open={addOpen} onOpenChange={setAddOpen} fund={fund} enrolled={enrolled} onChanged={membershipChanged} /> : null}
      {record ? (
        <QuickContributionDialog
          open={record.open}
          onOpenChange={(open) => setRecord((prev) => (prev ? { ...prev, open } : prev))}
          title={`Record contribution for ${record.member.globalMember.name}`}
          info={[
            { label: 'Member', value: <span className="font-semibold">{record.member.globalMember.name}</span> },
            { label: 'Month', value: <span className="font-semibold">Month {record.month}</span> },
            { label: 'Expected amount', value: <Money value={record.month == 1 ? fund.firstMonthContribution || 0 : fund.monthlyContribution || 0} tone="plain" className="font-semibold" /> },
          ]}
          values={record.values}
          onValuesChange={(values) => setRecord((prev) => (prev ? { ...prev, values } : prev))}
          dateMessage="Please select a payment date"
          submitError={record.error}
          busy={writes.busy}
          onSubmit={submitRecord}
        />
      ) : null}
    </div>
  );
}
