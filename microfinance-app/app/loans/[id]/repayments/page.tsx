'use client';

/**
 * A loan's repayment history (List template). page, pageSize, q (notes), sort and order
 * live in the URL and run on the server.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from '@/lib/toast';
import { CalendarClock, Plus, ShieldAlert, Trash2 } from 'lucide-react';

import { useListParams } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { invalidateLoan, LOANS, loanWrites, useLoan, type RepaymentRecord } from '@/lib/query/loans';
import { ApiError } from '@/lib/query/fetcher';
import { Button } from '@/components/ui/button';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { RowActions, type RowAction } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';

const SORTS = ['period', 'paidDate', 'amount', 'paymentType', 'createdAt'] as const;
const SORT_OPTIONS = [
  { value: '', label: 'Latest period first' },
  { value: 'period:asc', label: 'Period, first to last' },
  { value: 'paidDate:desc', label: 'Payment date, newest' },
  { value: 'paidDate:asc', label: 'Payment date, oldest' },
  { value: 'amount:desc', label: 'Amount, high to low' },
  { value: 'amount:asc', label: 'Amount, low to high' },
];

function TypeBadge({ type }: { type: string }) {
  if (type === 'RECOVERY') return <StatusBadge status="Settled" label="Offline Recovery" />;
  if (type === 'INTEREST_ONLY') return <StatusBadge status="Interest Only" />;
  return <StatusBadge status="Paid" label="Principal + Interest" />;
}

export default function RepaymentsPage() {
  return (
    <PageContainer>
      <Repayments />
    </PageContainer>
  );
}

function Repayments() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const loanQuery = useLoan(id || null);
  const loan = loanQuery.data;
  useBreadcrumbLabel(id ? `/loans/${id}` : null, loan?.borrower?.name);

  const list = useListParams({ id: 'loan-repayments', sortable: SORTS });
  const query = useListQuery<RepaymentRecord>(LOANS, list, { action: 'repayments', id, itemsKey: 'repayments', enabled: !!id });
  const meta = query.meta;
  const rows = query.items;

  if (!loan && loanQuery.error) {
    const status = loanQuery.error instanceof ApiError ? loanQuery.error.status : 0;
    return status === 404 || status === 403 ? (
      <EmptyState
        title="Loan not found"
        description="The loan you are looking for does not exist or has been removed."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/loans">Return to loans</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState error={loanQuery.error} onRetry={() => void loanQuery.mutate()} />
    );
  }

  const interestRate = loan?.interestRate || 0;
  const pageTotal = rows.reduce((sum, r) => sum + r.amount, 0);
  // Unchanged from before: interest rate × rows on this page (labelled as such).
  const pageProfit = rows.reduce((sum) => sum + interestRate, 0);

  const deleteRepayment = async (repayment: RepaymentRecord) => {
    await loanWrites.deleteRepayment(id, repayment.id);
    toast.success('Repayment deleted');
    await invalidateLoan(id, loan?.borrowerId);
  };

  const actionsFor = (repayment: RepaymentRecord) => {
    const actions: RowAction[] = loan?.nonRecoverableAt
      ? [{ label: 'Recovery details', icon: ShieldAlert, href: `/loans/${id}#loan-recovery` }]
      : [
          {
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            confirm: {
              title: 'Delete this repayment?',
              description: 'This action cannot be undone. The loan balance, overdue figures and the cash ledger are recalculated.',
              onConfirm: () => deleteRepayment(repayment),
            },
          },
        ];
    actions.push({ label: 'View schedule', icon: CalendarClock, href: `/loans/${id}/payment-schedules`, separatorBefore: true });
    return <RowActions label={`Actions for repayment ${repayment.period ? `period ${repayment.period}` : repayment.id}`} actions={actions} />;
  };

  const periodText = (r: RepaymentRecord) => (r.paymentType === 'RECOVERY' ? 'Offline recovery' : r.period ? `Period ${r.period}` : '-');
  const amountCell = (r: RepaymentRecord) =>
    r.paymentType === 'INTEREST_ONLY' ? (
      <div>
        <Money value={loan?.interestRate || r.amount} tone="plain" />
        <div className="text-xs text-muted-foreground">
          (Actual: <Money value={r.amount} tone="plain" />)
        </div>
      </div>
    ) : (
      <Money value={r.amount} tone="plain" />
    );

  const columns: DataTableColumn<RepaymentRecord>[] = [
    { id: 'period', header: 'Period', sortable: true, cell: (r) => <span className="whitespace-nowrap">{periodText(r)}</span> },
    { id: 'dueDate', header: 'Due date', cell: (r) => <DateText value={r.dueDate} /> },
    { id: 'paidDate', header: 'Payment date', sortable: true, cell: (r) => <DateText value={r.paidDate} /> },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: amountCell },
    { id: 'paymentType', header: 'Type', sortable: true, cell: (r) => <TypeBadge type={r.paymentType} /> },
    { id: 'source', header: 'Source', hideBelow: 'lg', cell: () => <span className="text-muted-foreground">Manual Entry</span> },
    { id: 'notes', header: 'Notes', hideBelow: 'xl', cell: (r) => <span className="line-clamp-2 max-w-[16rem] text-muted-foreground">{r.notes || '—'}</span> },
    { id: 'actions', header: <span className="sr-only">Actions</span>, width: '3.5rem', align: 'right', cell: actionsFor },
  ];

  return (
    <div>
      <PageHeader
        title="Repayment history"
        count={meta?.totalCount}
        description={loan?.borrower?.name}
        actions={
          loan?.status === 'Active' ? (
            <Button className={iconOnPhone} asChild>
              <Link href={`/loans/${id}/repayments/new`}>
                <Plus aria-hidden="true" />
                <span className="max-sm:sr-only">Record new payment</span>
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Borrower" value={<span className="text-lg">{loan?.borrower?.name || 'Unknown'}</span>} loading={!loan} />
        <StatCard label="Total amount" value={<Money value={loan?.amount} tone="plain" />} loading={!loan} />
        <StatCard label="Remaining balance" value={<Money value={loan?.remainingAmount} tone="plain" />} loading={!loan} />
      </div>

      <ListToolbar
        search={<SearchInput value={list.params.q} onChange={(q) => list.setParams({ q })} placeholder="Search notes" label="Search repayment notes" />}
        sort={
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={list.params.sort ? `${list.params.sort}:${list.params.order ?? 'asc'}` : ''}
            onValueChange={(value) => {
              const [sort, order] = value.split(':');
              list.setParams({ sort: sort || null, order: (order as 'asc' | 'desc') || null });
            }}
            options={SORT_OPTIONS}
          />
        }
        resultSummary={meta ? formatRange(meta.page, meta.pageSize, meta.totalCount) : null}
      />

      <DataTable<RepaymentRecord>
        label="Repayments"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: list.params.sort, order: list.params.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        emptyState={
          list.isFiltered ? (
            <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState
              title="No repayments yet"
              description="Payments recorded for this loan appear here."
              action={
                loan?.status === 'Active' ? (
                  <Button size="sm" asChild>
                    <Link href={`/loans/${id}/repayments/new`}>Record a payment</Link>
                  </Button>
                ) : undefined
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
        renderCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{periodText(r)}</p>
                <p className="text-xs text-muted-foreground">
                  Paid <DateText value={r.paidDate} />
                  {r.dueDate ? (
                    <>
                      {' '}· due <DateText value={r.dueDate} />
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex items-start gap-1">
                <div className="text-right font-medium">{amountCell(r)}</div>
                <div className="-mr-2 -mt-2">{actionsFor(r)}</div>
              </div>
            </div>
            <TypeBadge type={r.paymentType} />
            {r.notes ? <p className="text-xs text-muted-foreground">{r.notes}</p> : null}
          </div>
        )}
      />

      {rows.length > 0 ? (
        <div className="mt-4 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <span className="text-muted-foreground">Total paid on this page: </span>
          <Money value={pageTotal} tone="plain" className="text-base font-semibold" />
          <span className="ml-2 text-xs text-muted-foreground">
            (Profit on this page: <Money value={pageProfit} tone="plain" />)
          </span>
        </div>
      ) : null}
    </div>
  );
}
