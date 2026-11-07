'use client';

/**
 * Calendar dialogs, loaded with next/dynamic on first use: a month's transactions of one
 * kind (paged on the server, 25 per page, instead of the old pageSize=1000 requests), the
 * cash-flow breakdown, and the pending-members dialog around the tested list.
 */
import * as React from 'react';
import useSWR from 'swr';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { Money } from '@/components/kit/money';
import { DateText } from '@/components/kit/date-text';
import { transactionKeys, type TransactionRecord } from '@/lib/query/transactions';
import { normaliseListResponse } from '@/lib/list/useListQuery';
import {
  ALL_MONTH_TYPES,
  cashFlowOf,
  extractMemberName,
  MODAL_CONFIG,
  PendingMembersModal,
  type ModalKind,
  type MonthStats,
  type PendingKind,
} from './month-panels';

const PAGE_SIZE = 25;

export function MonthTransactionsDialog({
  kind,
  onClose,
  range,
  monthLabel,
}: {
  kind: ModalKind | null;
  onClose: () => void;
  range: { startDate: string; endDate: string };
  monthLabel: string;
}) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [kind, range.startDate]);
  const config = kind ? MODAL_CONFIG[kind] : null;
  const params = config
    ? {
        startDate: range.startDate,
        endDate: range.endDate,
        type: config.type ?? ALL_MONTH_TYPES.join(','),
        page,
        pageSize: PAGE_SIZE,
        // "All" was merged newest date first; single kinds keep the list's own order.
        ...(config.type === null ? { sort: 'date', order: 'desc' } : {}),
      }
    : null;
  const query = useSWR<unknown>(params ? transactionKeys.list(params) : null, { keepPreviousData: true });
  const list = query.data && params ? normaliseListResponse<TransactionRecord>(query.data, params, 'transactions') : null;

  const columns: DataTableColumn<TransactionRecord>[] = [
    { id: 'member', header: 'Member', cell: (t) => <span className="font-medium text-foreground">{extractMemberName(t.note)}</span> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (t) => <Money value={Math.abs(t.amount ?? 0)} tone="plain" /> },
    { id: 'date', header: 'Date', align: 'right', cell: (t) => <DateText value={t.date} /> },
  ];

  return (
    <ResponsiveDialog
      open={!!kind}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={config ? `${config.title} — ${monthLabel}` : ''}
      description={list?.meta ? `${list.meta.totalCount} ${list.meta.totalCount === 1 ? 'transaction' : 'transactions'}` : 'Transactions recorded this month'}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        <DataTable<TransactionRecord>
          label={config?.title ?? 'Transactions'}
          columns={columns}
          rows={list?.items ?? []}
          getRowId={(t) => t.id}
          isInitialLoading={!query.data && !query.error}
          isRefreshing={!!query.data && query.isLoading}
          error={query.error}
          onRetry={() => void query.mutate()}
          skeletonRows={5}
          emptyState={<p className="p-6 text-center text-sm text-muted-foreground">{config?.emptyText}</p>}
          pagination={list?.meta && list.meta.totalCount > PAGE_SIZE ? { page, pageSize: PAGE_SIZE, totalCount: list.meta.totalCount, onPageChange: setPage } : undefined}
          renderCard={(t) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{extractMemberName(t.note)}</p>
                <p className="text-xs text-muted-foreground"><DateText value={t.date} /></p>
              </div>
              <Money value={Math.abs(t.amount ?? 0)} tone="plain" className="font-semibold" />
            </div>
          )}
        />
      </div>
    </ResponsiveDialog>
  );
}

export function CashFlowDialog({ open, onClose, stats, monthLabel }: { open: boolean; onClose: () => void; stats: MonthStats; monthLabel: string }) {
  const { net } = cashFlowOf(stats);
  const rows = [
    { label: 'Loan Repayments', amount: stats.actualLoanRepayment, inflow: true },
    { label: 'Chit Contributions', amount: stats.actualChitContribution, inflow: true },
    { label: 'Document Charges', amount: stats.totalDocumentCharges, inflow: true },
    { label: 'Loans Disbursed', amount: stats.totalLoanDisbursement, inflow: false },
    { label: 'Auction Payouts', amount: stats.totalAuctionPayouts, inflow: false },
  ].filter((r) => r.amount > 0);
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()} title={`Cash Flow — ${monthLabel}`} description="Money in and out this month" hideDescription>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No transactions recorded this month.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              <th className="py-2 text-left font-medium">Category</th>
              <th className="py-2 text-left font-medium">Flow</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-0">
                <td className="py-2.5 font-medium text-foreground">{row.label}</td>
                <td className="py-2.5 text-xs text-muted-foreground">{row.inflow ? 'Inflow' : 'Outflow'}</td>
                <td className="py-2.5 text-right">
                  <Money value={row.amount} tone={row.inflow ? 'inflow' : 'outflow'} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td className="py-2.5 font-semibold text-foreground" colSpan={2}>Net Cash Flow</td>
              <td className="py-2.5 text-right font-semibold">
                <Money value={net} tone={net >= 0 ? 'inflow' : 'loss'} />
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </ResponsiveDialog>
  );
}

export function PendingMembersDialog({ kind, month, monthLabel, onClose }: { kind: PendingKind | null; month: Date; monthLabel: string; onClose: () => void }) {
  return (
    <ResponsiveDialog
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={kind ? `Pending ${MODAL_CONFIG[kind].title} — ${monthLabel}` : ''}
      description="Members with an unpaid balance this month"
      hideDescription
    >
      {kind ? <PendingMembersModal key={`${kind}-${monthLabel}`} kind={kind} month={month} onClose={onClose} /> : null}
    </ResponsiveDialog>
  );
}
