'use client';

/**
 * A fund's contributions (List template over a month × member grid).
 *
 * Without `?month=` the page lists every month of the fund (1..duration) with its counts and
 * totals; with `?month=m` it lists every member for that month. The month, the member search
 * and the paid/unpaid filter live in the URL (replace), so refresh and Back keep them.
 *
 * Requests: the fund (usually cached from its page) and the contributions endpoint as the
 * documented "all rows for this fund" request (`chitFundKeys.contributionStatus`, a 1-row
 * `contributions` page: `allContributions` and `members` are always complete). The grid is
 * built from one month → member index (O(contributions + months × members)) instead of
 * scanning every contribution for every cell.
 *
 * Recording a contribution is optimistic: the member's cell shows "Saving" at once, the
 * server-computed balance and the month's totals show "Updating…" until the fund has been
 * refetched; on failure the row goes away and the form reopens with its values.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { addMonths, format, isValid } from 'date-fns';
import { ArrowLeft, Plus, Trash2, Users, Wallet } from 'lucide-react';

import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';
import { useListParams } from '@/lib/list/useListParams';
import { ApiError } from '@/lib/query/fetcher';
import { useChitFund, useChitFundContributionStatus, type ContributionStatusRow, type ContributionsResponse } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SearchInput } from '@/components/kit/search-input';
import { StatusBadge } from '@/components/kit/status-badge';
import { Updating } from '@/components/kit/updating';
import { BalanceCell, hasPendingBalance, type ShownContribution } from '@/app/components/chit-funds/contribution-display';
import { ContributionBusyError, pendingFor, useContributionWrites, type PendingContribution } from '@/app/components/chit-funds/contribution-writes';
import { contributionBody, emptyContributionForm, type ContributionFormValues } from '@/app/components/chit-funds/ContributionFormDialog';

// Dialogs (and their Radix code) load on first use.
const ContributionFormDialog = dynamic(() => import('@/app/components/chit-funds/ContributionFormDialog'), { ssr: false });
const PayBalanceDialog = dynamic(() => import('@/app/components/chit-funds/PayBalanceDialog'), { ssr: false });
const ContributionDetailsDialog = dynamic(() => import('@/app/components/chit-funds/contribution-display').then((m) => m.ContributionDetailsDialog), { ssr: false });

type StatusMember = ContributionsResponse['members'][number];
const FILTERS = ['month', 'status'] as const;
type Filter = (typeof FILTERS)[number];
const STATUS_OPTIONS = [
  { value: '', label: 'All members' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Not paid' },
];

interface MonthRow {
  month: number;
  pendingMembers: StatusMember[];
  totalExpected: number;
  totalCollected: number;
  totalBalance: number;
  contributionCount: number;
  pendingCount: number;
  memberCount: number;
  saving: boolean;
}

interface MemberMonthRow {
  member: StatusMember;
  contribution: ContributionStatusRow | null;
  pending: PendingContribution | undefined;
}

/** Calendar month of the fund's nth month ("Dec 2025"), or '' when the start date is unknown. */
function calendarMonth(startDate: string | null | undefined, month: number): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  return isValid(start) ? format(addMonths(start, month - 1), 'MMM yyyy') : '';
}

/** "Month 5 · Apr 2026" (or just "Month 5"). */
function monthLabel(startDate: string | null | undefined, month: number): string {
  const name = calendarMonth(startDate, month);
  return name ? `Month ${month} · ${name}` : `Month ${month}`;
}

/** month → memberId → contribution (one pass over the fund's contributions). */
function indexByMonth(all: ContributionStatusRow[]) {
  const index = new Map<number, Map<number, ContributionStatusRow>>();
  for (const c of all) {
    let byMember = index.get(c.month);
    if (!byMember) index.set(c.month, (byMember = new Map()));
    // allContributions is newest first; keep the first row seen per member and month (as .find did).
    if (!byMember.has(c.memberId)) byMember.set(c.memberId, c);
  }
  return index;
}

/**
 * The month list, with the page's own formulas (unchanged): expected = monthly × members;
 * collected = Σ amounts of the month; outstanding = Σ month balances + pending members × monthly.
 */
function buildMonthRows(fund: { duration: number; monthlyContribution: number; membersCount: number }, data: ContributionsResponse, index: Map<number, Map<number, ContributionStatusRow>>, pending: PendingContribution[]): MonthRow[] {
  const members = data.members ?? [];
  const all = data.allContributions ?? [];
  const sums = new Map<number, { count: number; collected: number; balance: number }>();
  for (const c of all) {
    const s = sums.get(c.month) ?? { count: 0, collected: 0, balance: 0 };
    s.count += 1;
    s.collected += c.amount;
    s.balance += c.balance || 0;
    sums.set(c.month, s);
  }
  const memberCount = members ? members.length : fund.membersCount || 0;
  const out: MonthRow[] = [];
  for (let month = 1; month <= (fund.duration || 0); month++) {
    const paid = index.get(month);
    const pendingMembers = members.length ? members.filter((m) => !paid?.has(m.id)) : [];
    const s = sums.get(month) ?? { count: 0, collected: 0, balance: 0 };
    const pendingCount = pendingMembers.length;
    out.push({
      month,
      pendingMembers,
      totalExpected: fund.monthlyContribution * memberCount,
      totalCollected: s.collected,
      totalBalance: s.balance + (pendingCount > 0 ? pendingCount * (fund.monthlyContribution || 0) : 0),
      contributionCount: s.count,
      pendingCount,
      memberCount,
      saving: pending.some((p) => p.month === month),
    });
  }
  return out;
}

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function ChitFundContributionsPage() {
  return (
    <PageContainer fallback={<PageSkeleton />}>
      <ContributionsView />
    </PageContainer>
  );
}

function ContributionsView() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const fundQuery = useChitFund(id || null);
  const fund = fundQuery.data;
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);
  const statusQuery = useChitFundContributionStatus(id || null);
  const data = statusQuery.data;
  const list = useListParams<Filter>({ id: 'chit-fund-contributions', filters: FILTERS });
  const writes = useContributionWrites(id);

  const monthParam = list.params.month ? parseInt(list.params.month, 10) : NaN;
  const selectedMonth = fund && monthParam >= 1 && monthParam <= fund.duration ? monthParam : null;

  // Form: values are kept between openings and reset after a save (as the page always did).
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMounted, setFormMounted] = React.useState(false);
  const [formValues, setFormValues] = React.useState<ContributionFormValues>(() => emptyContributionForm());
  const [formError, setFormError] = React.useState<string | null>(null);
  const [detailsId, setDetailsId] = React.useState<number | null>(null);
  const [payId, setPayId] = React.useState<number | null>(null);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [mounted, setMounted] = React.useState({ details: false, pay: false });
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);

  const index = React.useMemo(() => indexByMonth(data?.allContributions ?? []), [data]);
  const names = React.useMemo(() => new Map((data?.members ?? []).map((m) => [m.id, m])), [data]);
  const monthRows = React.useMemo(
    () => (fund && data ? buildMonthRows(fund, data, index, writes.pending) : []),
    [fund, data, index, writes.pending]
  );
  const memberRows = React.useMemo<MemberMonthRow[]>(() => {
    if (!data || selectedMonth === null) return [];
    const byMember = index.get(selectedMonth);
    return (data.members ?? []).map((member) => ({ member, contribution: byMember?.get(member.id) ?? null, pending: pendingFor(writes.pending, member.id, selectedMonth) }));
  }, [data, index, selectedMonth, writes.pending]);
  const visibleMemberRows = React.useMemo(() => {
    const q = list.params.q.trim().toLowerCase();
    return memberRows.filter((r) => {
      if (q && !(r.member.globalMember?.name ?? '').toLowerCase().includes(q) && !(r.member.globalMember?.contact ?? '').toLowerCase().includes(q)) return false;
      const paid = !!r.contribution || !!r.pending;
      if (list.params.status === 'paid' && !paid) return false;
      if (list.params.status === 'pending' && paid) return false;
      return true;
    });
  }, [memberRows, list.params.q, list.params.status]);

  const allContributions = data?.allContributions;
  const byId = React.useMemo(() => new Map((allContributions ?? []).map((c) => [c.id, c])), [allContributions]);
  const memberName = (memberId: number) => names.get(memberId)?.globalMember?.name || `Member ID: ${memberId}`;

  if (!fund) {
    if (fundQuery.error) {
      const status = fundQuery.error instanceof ApiError ? fundQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Chit fund not found"
            description={status === 404 ? `Chit fund with ID ${params.id} not found. It may have been deleted or you don't have permission to view it.` : 'The chit fund you are looking for does not exist or has been removed.'}
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

  const openForm = (preset?: Partial<ContributionFormValues>) => {
    if (preset) setFormValues((prev) => ({ ...prev, ...preset }));
    setFormError(null);
    setFormMounted(true);
    setFormOpen(true);
  };

  const submitContribution = (values: ContributionFormValues) => {
    setFormOpen(false);
    const body = contributionBody(values, fund);
    const member = names.get(Number(values.memberId));
    void writes
      .record(body, member?.globalMemberId)
      .then(() => {
        toast.success('Contribution recorded', { description: `${member?.globalMember?.name ?? 'Member'} · Month ${values.month} · ${formatMoney(Number(values.amount))}` });
        setFormValues(emptyContributionForm(fund.monthlyContribution?.toString() || ''));
      })
      .catch((error) => {
        const message = error instanceof ContributionBusyError ? error.message : errorMessage(error) ?? 'Failed to add contribution. Please try again.';
        toast.error('Contribution not recorded', { description: message });
        setFormValues(values);
        setFormError(message);
        setFormOpen(true);
      });
  };

  const detailsRow = detailsId !== null ? byId.get(detailsId) ?? null : null;
  const payRow = payId !== null ? byId.get(payId) ?? null : null;
  const deleteRow = deleteId !== null ? byId.get(deleteId) ?? null : null;
  const openPay = (c: ShownContribution) => {
    setDetailsOpen(false);
    setMounted((m) => ({ ...m, pay: true }));
    setPayId(c.id);
    setPayOpen(true);
  };

  const loadingGrid = !data && !statusQuery.error;
  const refreshing = !!data && statusQuery.isValidating && !writes.saving;

  // ── Month list ────────────────────────────────────────────────────────────
  const monthColumns: DataTableColumn<MonthRow>[] = [
    {
      id: 'month',
      header: 'Month',
      cell: (r) => (
        <span className="block whitespace-nowrap">
          <span className="font-medium text-primary-text">Month {r.month}</span>
          {calendarMonth(fund.startDate, r.month) ? <span className="block text-xs text-muted-foreground">{calendarMonth(fund.startDate, r.month)}</span> : null}
        </span>
      ),
    },
    {
      id: 'contributions',
      header: 'Contributions',
      cell: (r) => (
        <Updating active={r.saving}>
          <div className="min-w-[12rem]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                {r.contributionCount} of {r.memberCount} members
              </span>
              {r.pendingCount > 0 ? <StatusBadge status="Overdue" label={`${r.pendingCount} pending`} /> : null}
            </div>
            {r.pendingCount > 0 ? (
              <details className="mt-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <summary className="cursor-pointer text-primary-text hover:underline">Show pending members</summary>
                <ul className="mt-1 list-disc pl-4">
                  {r.pendingMembers.map((m) => (
                    <li key={m.id} className="text-destructive-text">
                      {m.globalMember.name}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Updating>
      ),
    },
    { id: 'expected', header: 'Expected amount', numeric: true, cell: (r) => <Money value={r.totalExpected} tone="plain" /> },
    { id: 'collected', header: 'Collected amount', numeric: true, cell: (r) => <Updating active={r.saving}><Money value={r.totalCollected} tone="plain" /></Updating> },
    {
      id: 'outstanding',
      header: 'Outstanding balance',
      numeric: true,
      cell: (r) => (
        <Updating active={r.saving}>
          {r.totalBalance > 0 ? (
            <div className="text-right">
              <Money value={r.totalBalance} tone="overdue" className="font-semibold" />
              {r.pendingCount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Includes {r.pendingCount} pending member{r.pendingCount > 1 ? 's' : ''}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="font-semibold text-success-text">Fully collected</span>
          )}
        </Updating>
      ),
    },
  ];

  // ── One month's members ───────────────────────────────────────────────────
  const memberColumns: DataTableColumn<MemberMonthRow>[] = [
    { id: 'member', header: 'Member', cell: (r) => <span className="font-medium text-foreground">{r.member.globalMember.name}</span> },
    { id: 'month', header: 'Month', hideBelow: 'lg', cell: () => <span className="whitespace-nowrap">{monthLabel(fund.startDate, selectedMonth as number)}</span> },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (r) =>
        r.contribution ? <Money value={r.contribution.amount} tone="plain" /> : r.pending ? <Money value={r.pending.amount} tone="plain" /> : <Money value={fund.monthlyContribution} tone="plain" className="text-muted-foreground" />,
    },
    {
      id: 'paidDate',
      header: 'Paid date',
      cell: (r) =>
        r.contribution ? (
          <DateText value={r.contribution.paidDate} />
        ) : r.pending ? (
          <span className="flex flex-col items-start gap-1">
            <DateText value={r.pending.paidDate} />
            <StatusBadge status="saving" />
          </span>
        ) : (
          <span className="font-semibold text-destructive-text">Pending</span>
        ),
    },
    {
      id: 'balance',
      header: 'Balance',
      cell: (r) =>
        r.contribution ? (
          <BalanceCell c={r.contribution} updating={writes.updatingIds.has(r.contribution.id)} />
        ) : r.pending ? (
          <Updating active>
            <span className="text-muted-foreground">—</span>
          </Updating>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {r.contribution ? (
            <>
              {hasPendingBalance(r.contribution) ? (
                <Button size="sm" variant="outline" disabled={writes.busy} onClick={() => openPay(r.contribution!)}>
                  <Wallet aria-hidden="true" />
                  Pay balance
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="text-destructive-text hover:bg-destructive-subtle hover:text-destructive-text" aria-label="Delete contribution" disabled={writes.busy} onClick={() => setDeleteId(r.contribution!.id)}>
                <Trash2 aria-hidden="true" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          ) : r.pending ? null : (
            <Button size="sm" variant="outline" disabled={writes.busy} onClick={() => openForm({ memberId: r.member.id.toString(), month: String(selectedMonth) })}>
              <Plus aria-hidden="true" />
              Add payment
            </Button>
          )}
        </div>
      ),
    },
  ];

  const chips = [
    ...(list.params.q ? [{ key: 'q', label: `Search: ${list.params.q}`, onRemove: () => list.setParams({ q: null }) }] : []),
    ...(list.params.status ? [{ key: 'status', label: list.params.status === 'paid' ? 'Paid' : 'Not paid', onRemove: () => list.setParams({ status: null }) }] : []),
  ];
  const memberFilterActive = chips.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow={`Chit fund #${fund.id} · ${fund.name}`}
        title={selectedMonth ? `Contributions · Month ${selectedMonth}` : 'Contributions'}
        description={
          selectedMonth ? (
            <>
              {calendarMonth(fund.startDate, selectedMonth) ? <>{calendarMonth(fund.startDate, selectedMonth)} · </> : null}
              Monthly contribution <Money value={fund.monthlyContribution} tone="plain" />
            </>
          ) : (
            <>
              Month {fund.currentMonth} of {fund.duration}
              {calendarMonth(fund.startDate, fund.currentMonth) ? <> ({calendarMonth(fund.startDate, fund.currentMonth)})</> : null} · Monthly contribution{' '}
              <Money value={fund.monthlyContribution} tone="plain" />
            </>
          )
        }
        actions={
          // Phones: the two actions share one row at half width each.
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href={`/chit-funds/${fund.id}/members`}>
                <Users aria-hidden="true" />
                <span className="sm:hidden">Members</span>
                <span className="hidden sm:inline">View members</span>
              </Link>
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => openForm()} disabled={!data}>
              <Plus aria-hidden="true" />
              <span className="sm:hidden">Record</span>
              <span className="hidden sm:inline">Record contribution</span>
            </Button>
          </div>
        }
      />

      <ListToolbar
        search={
          selectedMonth ? (
            <SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search members" label="Search members of this month" />
          ) : undefined
        }
        primaryFilter={
          // Phones: the month and payment selects share one row; the month select's "All months"
          // option replaces the back button there.
          <div className={selectedMonth ? 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center' : 'flex flex-wrap items-center gap-2'}>
            {selectedMonth ? (
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => list.setParams({ month: null, q: null, status: null })}>
                <ArrowLeft aria-hidden="true" />
                All months
              </Button>
            ) : null}
            <NativeSelect
              aria-label="Month"
              className="w-full sm:w-48"
              value={selectedMonth ? String(selectedMonth) : ''}
              onValueChange={(value) => list.setParams(value ? { month: value } : { month: null, q: null, status: null })}
              options={[{ value: '', label: 'All months' }, ...Array.from({ length: fund.duration }, (_, i) => ({ value: String(i + 1), label: monthLabel(fund.startDate, i + 1) }))]}
            />
            {selectedMonth ? (
              <NativeSelect aria-label="Payment" className="w-full sm:w-40" value={list.params.status ?? ''} onValueChange={(value) => list.setParams({ status: value || null })} options={STATUS_OPTIONS} />
            ) : null}
          </div>
        }
        chips={selectedMonth && chips.length ? <FilterChips chips={chips} onClearAll={() => list.setParams({ q: null, status: null })} /> : undefined}
        resultSummary={selectedMonth && data ? `${visibleMemberRows.length} of ${memberRows.length} members` : null}
      />

      {selectedMonth ? (
        <DataTable<MemberMonthRow>
          label={`Contributions for month ${selectedMonth}`}
          mode="client"
          columns={memberColumns}
          rows={visibleMemberRows}
          getRowId={(r) => r.member.id}
          isInitialLoading={loadingGrid}
          isRefreshing={refreshing}
          error={statusQuery.error}
          onRetry={() => void statusQuery.mutate()}
          skeletonRows={8}
          onRowClick={(r) => {
            if (!r.contribution) return;
            setMounted((m) => ({ ...m, details: true }));
            setDetailsId(r.contribution.id);
            setDetailsOpen(true);
          }}
          rowClassName={(r) => (r.pending ? 'bg-info-subtle/60' : undefined)}
          renderCard={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.member.globalMember.name}</p>
                  <p className="text-xs text-muted-foreground">{monthLabel(fund.startDate, selectedMonth)}</p>
                </div>
                <div className="shrink-0 text-right">
                  {r.contribution ? (
                    <Money value={r.contribution.amount} tone="plain" className="font-medium" />
                  ) : r.pending ? (
                    <Money value={r.pending.amount} tone="plain" className="font-medium" />
                  ) : (
                    <Money value={fund.monthlyContribution} tone="plain" className="font-medium text-muted-foreground" />
                  )}
                  <div className="mt-1 text-xs">
                    {r.contribution ? (
                      <span className="text-muted-foreground">
                        Paid <DateText value={r.contribution.paidDate} />
                      </span>
                    ) : r.pending ? (
                      <StatusBadge status="saving" />
                    ) : (
                      <span className="font-semibold text-destructive-text">Pending</span>
                    )}
                  </div>
                </div>
              </div>
              {r.contribution && hasPendingBalance(r.contribution) ? (
                <div className="text-sm">
                  <BalanceCell c={r.contribution} updating={writes.updatingIds.has(r.contribution.id)} />
                </div>
              ) : null}
              <div onClick={(event) => event.stopPropagation()}>{memberColumns[memberColumns.length - 1].cell(r, 0)}</div>
            </div>
          )}
          emptyState={
            memberFilterActive ? (
              <EmptyState variant="no-results" description="No members of this month match these filters." onClearFilters={() => list.setParams({ q: null, status: null })} />
            ) : (
              <EmptyState
                title="No members yet"
                description="No contributions found. Add members to this chit fund, then record their contributions."
                action={
                  <Button size="sm" asChild>
                    <Link href={`/chit-funds/${fund.id}/members`}>Add members</Link>
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <DataTable<MonthRow>
          label="Contributions by month"
          mode="client"
          columns={monthColumns}
          rows={monthRows}
          getRowId={(r) => r.month}
          isInitialLoading={loadingGrid}
          isRefreshing={refreshing}
          error={statusQuery.error}
          onRetry={() => void statusQuery.mutate()}
          skeletonRows={8}
          onRowClick={(r) => list.setParams({ month: String(r.month) })}
          rowClassName={(r) => (r.saving ? 'bg-info-subtle/60' : undefined)}
          renderCard={(r) => (
            <Updating active={r.saving}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-primary-text">Month {r.month}</p>
                    {calendarMonth(fund.startDate, r.month) ? <p className="text-xs text-muted-foreground">{calendarMonth(fund.startDate, r.month)}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums text-foreground">
                      {r.contributionCount} of {r.memberCount} paid
                    </p>
                    {r.pendingCount > 0 ? <StatusBadge status="Overdue" label={`${r.pendingCount} pending`} className="mt-1" /> : <span className="text-xs font-medium text-success-text">Fully collected</span>}
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Expected</dt>
                    <dd className="font-medium text-foreground"><Money value={r.totalExpected} tone="plain" /></dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Collected</dt>
                    <dd className="font-medium text-foreground"><Money value={r.totalCollected} tone="plain" /></dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Outstanding</dt>
                    <dd className="font-medium">{r.totalBalance > 0 ? <Money value={r.totalBalance} tone="overdue" /> : <span className="text-success-text">None</span>}</dd>
                  </div>
                </dl>
              </div>
            </Updating>
          )}
          emptyState={<EmptyState title="No contributions found" description="Record contributions for this chit fund." />}
        />
      )}

      {formMounted ? (
        <ContributionFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          fund={fund}
          members={(data?.members ?? []).map((m) => ({ id: m.id, name: m.globalMember.name }))}
          values={formValues}
          onValuesChange={setFormValues}
          submitError={formError}
          onSubmit={submitContribution}
          busy={writes.busy}
        />
      ) : null}

      {mounted.details ? (
        <ContributionDetailsDialog
          open={detailsOpen && detailsRow !== null}
          onOpenChange={setDetailsOpen}
          contribution={detailsRow}
          memberName={detailsRow ? memberName(detailsRow.memberId) : ''}
          onPayBalance={openPay}
          updating={detailsRow ? writes.updatingIds.has(detailsRow.id) : false}
        />
      ) : null}

      {mounted.pay ? (
        <PayBalanceDialog
          open={payOpen && payRow !== null}
          onOpenChange={setPayOpen}
          contribution={payRow}
          memberName={payRow ? memberName(payRow.memberId) : ''}
          onSubmit={async (body) => {
            const member = payRow ? names.get(payRow.memberId) : undefined;
            await writes.payBalance(body, member?.globalMemberId);
            toast.success('Balance payment recorded', { description: `${member?.globalMember?.name ?? 'Member'} · Month ${payRow?.month} · ${formatMoney(body.amount)}` });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteRow !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this contribution?"
        description="Are you sure you want to delete this contribution? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteRow) return;
          await writes.remove(deleteRow.id, names.get(deleteRow.memberId)?.globalMemberId);
          toast.success('Contribution deleted', { description: `${memberName(deleteRow.memberId)} · Month ${deleteRow.month}` });
        }}
      >
        {deleteRow ? (
          <p className="text-sm text-muted-foreground">
            {memberName(deleteRow.memberId)} · Month {deleteRow.month} · <Money value={deleteRow.amount} tone="plain" />
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
