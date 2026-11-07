'use client';

/**
 * Loans list (List template). List state lives in the URL (page, pageSize, q, sort,
 * order, status, type, overdue); search, filters and sort run on the server over the
 * whole dataset. Rows preload the loan on hover/touch; the next page preloads when idle.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { AlertTriangle, CalendarClock, Download, Eye, FileDown, Landmark, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';

import { loanAPI } from '@/lib/api';
import { useListParams } from '@/lib/list/useListParams';
import { normaliseListResponse, useListQuery } from '@/lib/list/useListQuery';
import { ALL } from '@/lib/list/types';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { invalidateLoans, LOANS, loanWrites, prefetchLoan, useLoansSummary, type LoanRecord, type LoansListSummary } from '@/lib/query/loans';
import { errorMessage } from '@/components/kit/error-state';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn, type RowId } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { FormField } from '@/components/kit/form-field';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { formatDate } from '@/lib/format';

const NON_RECOVERABLE = 'Non-Recoverable';
const SORTS = ['borrower', 'amount', 'disbursementDate', 'remainingAmount', 'overdueAmount', 'nextPaymentDate', 'status', 'createdAt'] as const;
const FILTERS = ['status', 'type', 'overdue'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Defaulted', label: 'Defaulted' },
  { value: NON_RECOVERABLE, label: 'Non-Recoverable' },
];
const TYPE_OPTIONS = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Reducing Balance', label: 'Reducing Balance' },
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'borrower:asc', label: 'Borrower, A to Z' },
  { value: 'borrower:desc', label: 'Borrower, Z to A' },
  { value: 'amount:desc', label: 'Amount, high to low' },
  { value: 'amount:asc', label: 'Amount, low to high' },
  { value: 'remainingAmount:desc', label: 'Remaining, high to low' },
  { value: 'remainingAmount:asc', label: 'Remaining, low to high' },
  { value: 'overdueAmount:desc', label: 'Overdue, high to low' },
  { value: 'nextPaymentDate:asc', label: 'Next payment, soonest' },
  { value: 'nextPaymentDate:desc', label: 'Next payment, latest' },
  { value: 'disbursementDate:desc', label: 'Disbursed, newest' },
  { value: 'disbursementDate:asc', label: 'Disbursed, oldest' },
  { value: 'status:asc', label: 'Status, A to Z' },
];

const borrowerName = (loan: LoanRecord) => loan.borrower?.name || 'Unknown';
const recoveryOutcome = (loan: LoanRecord) =>
  loan.recoveryOutcome === 'Recovered' ? 'Fully Recovered' : loan.recoveryOutcome || 'Open';

function RecoveryDetails({ loan }: { loan: LoanRecord }) {
  return (
    <div className="max-w-xs space-y-0.5 whitespace-normal text-xs text-muted-foreground">
      <p>
        {recoveryOutcome(loan)} · <DateText value={loan.nonRecoverableAt} />
      </p>
      {loan.nonRecoverableReason ? <p className="text-foreground">{loan.nonRecoverableReason}</p> : null}
      <p>
        At marking: <Money value={loan.recoveryPrincipalAtMark} tone="plain" /> principal ·{' '}
        <Money value={loan.recoveryDuesAtMark} tone="plain" /> installment dues
      </p>
      <p>
        Recovered: <Money value={loan.recoveryAmount || 0} tone="plain" /> · Interest remaining:{' '}
        <Money value={loan.recoveryInterestOutstanding || 0} tone="plain" />
      </p>
    </div>
  );
}

function InstallmentHint({ loan }: { loan: LoanRecord }) {
  if (loan.loanType === 'Reducing Balance') return <span>Dynamic installment</span>;
  return (
    <span>
      <Money value={loan.installmentAmount} tone="plain" /> / installment
    </span>
  );
}

export default function LoansPage() {
  return (
    <PageContainer>
      <LoansList />
    </PageContainer>
  );
}

function LoansList() {
  const router = useRouter();
  const list = useListParams<Filter>({ id: 'loans', filters: FILTERS, defaults: { status: 'Active' }, sortable: SORTS });
  const summary = useLoansSummary();
  const query = useListQuery<LoanRecord, LoansListSummary | null>(LOANS, list, {
    itemsKey: 'loans',
    select: (raw, request) => ({
      ...normaliseListResponse<LoanRecord>(raw, request, 'loans'),
      summary: ((raw ?? {}) as { recoverySummary?: LoansListSummary | null }).recoverySummary ?? null,
    }),
  });
  const [selected, setSelected] = React.useState<Set<RowId>>(() => new Set());
  // Ids being bulk-deleted, captured when the dialog opens (null = closed).
  const [bulkIds, setBulkIds] = React.useState<number[] | null>(null);

  const status = list.params.status ?? 'Active';
  const isNonRecoverable = status === NON_RECOVERABLE;
  const meta = query.meta;

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(LOANS, { ...list.apiParams, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, list.apiParams, meta, query.isRefreshing]);

  const selectedIds = React.useMemo(() => Array.from(selected).map(Number), [selected]);

  const deleteLoan = async (loan: LoanRecord) => {
    await loanWrites.remove(loan.id);
    toast.success('Loan deleted', { description: borrowerName(loan) });
    void invalidateLoans(loan.borrowerId);
  };

  const exportLoans = (ids: number[]) => {
    void loanAPI.exportSelectedLoans(ids);
    toast(ids.length === 1 ? 'Downloading the loan export' : `Downloading ${ids.length} loans`);
  };

  const bulkDelete = async () => {
    const ids = bulkIds ?? [];
    const results = await Promise.allSettled(ids.map((id) => loanWrites.remove(id)));
    const failures = results
      .map((result, i) => ({ result, id: ids[i] }))
      .filter((r): r is { result: PromiseRejectedResult; id: number } => r.result.status === 'rejected');
    const deleted = ids.length - failures.length;
    const reasons = Array.from(new Set(failures.map((f) => errorMessage(f.result.reason) ?? 'Unknown error')));
    if (deleted > 0) {
      setSelected(new Set());
      void invalidateLoans();
    }
    if (failures.length === ids.length) {
      throw new Error(`None of the ${ids.length} loans were deleted. ${reasons.join(' ')}`);
    }
    if (failures.length > 0) {
      toast.error(`${deleted} of ${ids.length} loans deleted, ${failures.length} failed`, { description: reasons.join(' ') });
    } else {
      toast.success(`${deleted} ${deleted === 1 ? 'loan' : 'loans'} deleted`);
    }
  };

  const actionsFor = (loan: LoanRecord) => (
    <RowActions
      label={`Actions for ${borrowerName(loan)}`}
      actions={[
        { label: 'View', icon: Eye, href: `/loans/${loan.id}` },
        { label: 'Edit', icon: Pencil, href: `/loans/${loan.id}/edit`, disabled: !!loan.nonRecoverableAt },
        { label: 'Export', icon: FileDown, onSelect: () => exportLoans([loan.id]) },
        {
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          disabled: !!loan.nonRecoverableAt,
          confirm: {
            title: 'Delete this loan?',
            description: `${borrowerName(loan)} · ${formatDate(loan.disbursementDate)}. This action cannot be undone.`,
            onConfirm: () => deleteLoan(loan),
          },
        },
      ]}
    />
  );

  const borrowerColumn: DataTableColumn<LoanRecord> = {
    id: 'borrower',
    header: 'Borrower',
    sortable: true,
    cell: (loan) => (
      <div className="min-w-0">
        <Link
          href={`/loans/${loan.id}`}
          className="font-medium text-foreground hover:text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {borrowerName(loan)}
        </Link>
        <div className="whitespace-nowrap text-xs text-muted-foreground">
          {loan.loanType}
          {loan.borrower?.contact ? ` · ${loan.borrower.contact}` : ''}
        </div>
      </div>
    ),
  };
  const amountColumn: DataTableColumn<LoanRecord> = {
    id: 'amount',
    header: 'Amount',
    numeric: true,
    sortable: true,
    cell: (loan) => (
      <div>
        <Money value={loan.amount} tone="plain" />
        <div className="text-xs text-muted-foreground">
          <InstallmentHint loan={loan} />
        </div>
      </div>
    ),
  };
  const statusColumn: DataTableColumn<LoanRecord> = {
    id: 'status',
    header: 'Status',
    sortable: true,
    cell: (loan) => (
      <div className="space-y-1">
        <StatusBadge status={loan.status} />
        {loan.status === NON_RECOVERABLE && !isNonRecoverable ? (
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {recoveryOutcome(loan)} · <DateText value={loan.nonRecoverableAt} />
          </p>
        ) : null}
      </div>
    ),
  };
  const actionsColumn: DataTableColumn<LoanRecord> = {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    width: '3.5rem',
    align: 'right',
    cell: actionsFor,
  };

  const columns: DataTableColumn<LoanRecord>[] = isNonRecoverable
    ? [
        borrowerColumn,
        amountColumn,
        { id: 'remainingAmount', header: 'Principal outstanding', numeric: true, sortable: true, cell: (loan) => <Money value={loan.remainingAmount} /> },
        { id: 'recovery', header: 'Recovery', cell: (loan) => <RecoveryDetails loan={loan} /> },
        statusColumn,
        actionsColumn,
      ]
    : [
        borrowerColumn,
        amountColumn,
        {
          id: 'progress',
          header: <span title="Repayments recorded / duration">Paid</span>,
          numeric: true,
          cell: (loan) => (
            <span className="whitespace-nowrap">
              {loan._count?.repayments || 0}
              <span className="text-muted-foreground"> / {loan.duration}</span>
            </span>
          ),
        },
        { id: 'remainingAmount', header: 'Remaining', numeric: true, sortable: true, cell: (loan) => <Money value={loan.remainingAmount} /> },
        {
          id: 'overdueAmount',
          header: 'Overdue',
          numeric: true,
          sortable: true,
          cell: (loan) => (
            <div>
              <Money value={loan.overdueAmount} tone="overdue" />
              {loan.missedPayments > 0 ? (
                <div className="whitespace-nowrap text-xs font-medium text-destructive-text">
                  {loan.missedPayments} missed
                </div>
              ) : null}
            </div>
          ),
        },
        { id: 'disbursementDate', header: 'Disbursed', sortable: true, hideBelow: '2xl', cell: (loan) => <DateText value={loan.disbursementDate} /> },
        { id: 'nextPaymentDate', header: 'Next payment', sortable: true, hideBelow: 'lg', cell: (loan) => <DateText value={loan.nextPaymentDate} /> },
        statusColumn,
        actionsColumn,
      ];

  const chipLabel = (name: string, value: string) => {
    if (name === 'q') return `Search: ${value}`;
    if (name === 'status') return `Status: ${value === ALL ? 'All' : value}`;
    if (name === 'type') return `Type: ${value}`;
    if (name === 'overdue') return 'Overdue only';
    return `${name}: ${value}`;
  };
  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: chipLabel(f.name, f.value),
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));
  const filterCount = (list.params.type ? 1 : 0) + (list.params.overdue ? 1 : 0);

  const toggleSelected = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Search or a secondary filter: "no results". Only a status chosen: no loans in that status.
  // All statuses and nothing else: the account has no loans yet.
  const narrowed = !!list.params.q || !!list.params.type || !!list.params.overdue;
  const emptyState = narrowed ? (
    <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
  ) : status !== ALL ? (
    <EmptyState
      title={`No ${status === NON_RECOVERABLE ? 'Non-Recoverable' : status.toLowerCase()} loans`}
      description={`There are no loans with status "${status}".`}
      action={
        <Button size="sm" variant="outline" onClick={() => list.setParams({ status: ALL })}>
          Show all statuses
        </Button>
      }
    />
  ) : (
    <EmptyState
      title="No loans yet"
      description="Loans you create appear here."
      action={
        <Button size="sm" asChild>
          <Link href="/loans/new">
            <Plus aria-hidden="true" />
            Create your first loan
          </Link>
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Loans"
        count={meta?.totalCount}
        actions={
          <>
            <Button variant="outline" onClick={() => { void loanAPI.exportAllLoans(); toast('Downloading all loans'); }}>
              <Download aria-hidden="true" />
              Export all
            </Button>
            <Button asChild>
              <Link href="/loans/new">
                <Plus aria-hidden="true" />
                New loan
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active loans"
          icon={Landmark}
          loading={!summary.data && !summary.error}
          value={summary.data ? summary.data.active.toLocaleString('en-IN') : '—'}
          hint={summary.data ? <>Disbursed <Money value={summary.data.activeAmount} tone="plain" compact /></> : undefined}
          onClick={() => list.setParams({ status: 'Active', type: null, overdue: null, q: null })}
        />
        <StatCard
          label="Outstanding principal"
          icon={Wallet}
          loading={!summary.data && !summary.error}
          value={<Money value={summary.data?.outstanding ?? null} tone="plain" compact />}
          hint="Active loans"
        />
        <StatCard
          label="Overdue"
          icon={AlertTriangle}
          tone={summary.data && summary.data.overdueAmount > 0 ? 'destructive' : 'neutral'}
          loading={!summary.data && !summary.error}
          value={<Money value={summary.data?.overdueAmount ?? null} tone={summary.data && summary.data.overdueAmount > 0 ? 'overdue' : 'plain'} compact />}
          hint={summary.data ? `${summary.data.overdueCount.toLocaleString('en-IN')} loan${summary.data.overdueCount === 1 ? '' : 's'} overdue` : undefined}
          onClick={() => list.setParams({ status: 'Active', overdue: '1', q: null })}
        />
        <StatCard
          label="Due this week"
          icon={CalendarClock}
          loading={!summary.data && !summary.error}
          value={summary.data ? summary.data.dueThisWeek.toLocaleString('en-IN') : '—'}
          hint="Next payment in the next 7 days"
        />
      </div>

      {isNonRecoverable ? (
        <section aria-labelledby="nr-heading" className="mb-4 space-y-3">
          <div>
            <h2 id="nr-heading" className="text-base font-semibold text-foreground">
              Non-Recoverable loans
            </h2>
            <p className="text-sm text-muted-foreground">
              These loans are excluded from routine collections. Open a loan to record offline recovery or view its audit history.
            </p>
          </div>
          {query.summary ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Principal outstanding" value={<Money value={query.summary.principal} tone="plain" />} />
              <StatCard label="Unpaid interest tracked" value={<Money value={query.summary.interest} tone="plain" />} />
              <StatCard label="Recovered" value={<Money value={query.summary.recovered} tone="plain" />} />
            </div>
          ) : null}
        </section>
      ) : null}

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search borrower or phone" label="Search loans" />}
        primaryFilter={
          <NativeSelect
            aria-label="Status"
            className="w-44"
            value={status}
            onValueChange={(value) => list.setParams({ status: value })}
            options={STATUS_OPTIONS}
          />
        }
        filters={
          <>
            <FormField label="Loan type">
              <NativeSelect
                value={list.params.type ?? ''}
                onValueChange={(value) => list.setParams({ type: value || null })}
                placeholder="Any type"
                options={TYPE_OPTIONS}
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Checkbox
                id="loans-overdue-only"
                checked={list.params.overdue === '1'}
                onCheckedChange={(checked) => list.setParams({ overdue: checked === true ? '1' : null })}
              />
              <Label htmlFor="loans-overdue-only" className="text-sm font-normal">
                Only loans with an overdue balance
              </Label>
            </div>
          </>
        }
        filterCount={filterCount}
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

      <DataTable<LoanRecord>
        label="Loans"
        columns={columns}
        rows={query.items}
        getRowId={(loan) => loan.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        selection={{ selected, onChange: setSelected, rowLabel: (loan) => `Select ${borrowerName(loan)}` }}
        onRowClick={(loan) => router.push(`/loans/${loan.id}`)}
        onRowIntent={(loan) => prefetchLoan(loan.id)}
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
        renderCard={(loan) => (
          <div className="flex gap-3">
            <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                aria-label={`Select ${borrowerName(loan)}`}
                checked={selected.has(loan.id)}
                onCheckedChange={(checked) => toggleSelected(loan.id, checked === true)}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/loans/${loan.id}`} className="font-medium text-foreground hover:underline" onClick={(event) => event.stopPropagation()}>
                    {borrowerName(loan)}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {loan.loanType} · <Money value={loan.amount} tone="plain" />
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <StatusBadge status={loan.status} />
                  <div className="-mr-2 -mt-2" onClick={(event) => event.stopPropagation()}>
                    {actionsFor(loan)}
                  </div>
                </div>
              </div>
              {loan.status === NON_RECOVERABLE ? (
                <RecoveryDetails loan={loan} />
              ) : (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining</dt>
                    <dd><Money value={loan.remainingAmount} /></dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted-foreground">Next payment</dt>
                    <dd><DateText value={loan.nextPaymentDate} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Overdue</dt>
                    <dd>
                      <Money value={loan.overdueAmount} tone="overdue" />
                      {loan.missedPayments > 0 ? <span className="ml-1 text-xs text-destructive-text">({loan.missedPayments} missed)</span> : null}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted-foreground">Paid</dt>
                    <dd className="tabular-nums">
                      {loan._count?.repayments || 0} / {loan.duration}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        )}
      />

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selected loans"
          className="sticky bottom-[calc(var(--bottom-nav-height,0px)+0.75rem)] z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-lg"
        >
          <p className="mr-auto text-sm font-medium tabular-nums text-foreground" aria-live="polite">
            {selected.size} selected
          </p>
          <Button variant="outline" size="sm" onClick={() => exportLoans(selectedIds)}>
            <FileDown aria-hidden="true" />
            Export selected
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
        title={`Delete ${bulkIds?.length ?? 0} ${bulkIds?.length === 1 ? 'loan' : 'loans'}?`}
        description="This action cannot be undone. Loans that have repayments or recovery history cannot be deleted and are reported as failures."
        confirmLabel="Delete selected"
        onConfirm={bulkDelete}
      />
    </div>
  );
}
