'use client';

/**
 * Transactions (List template). List state is in the URL: q, type, partner, from, to, the
 * advanced filters (advType, advMember, advEntity, advSubType), sort, order, page,
 * pageSize, and `txn` (ids from a notification). Search, filters and sort run on the
 * server over the whole dataset; the partner summary, the period's collections and the
 * exports follow the same filters. "Record transaction" opens the entry form in a dialog.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import { Calculator, Database, Download, Mail, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import { useListParams, type ListPatch } from '@/lib/list/useListParams';
import { useListQuery } from '@/lib/list/useListQuery';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { usePartnerBalances } from '@/lib/query/dashboard';
import { invalidateTransactions, TRANSACTIONS, transactionWrites, type TransactionRecord } from '@/lib/query/transactions';
import { buildTransactionFilterParams, type TransactionFilters } from '../../lib/transactionFilterUtils';
import { TRANSACTION_TYPES_CONFIG } from '../../config/config';
import { usePartner } from '../contexts/PartnerContext';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { formatRange } from '@/components/kit/list-pagination';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { describePeriod } from '@/components/kit/period-picker';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { RowActions } from '@/components/kit/row-actions';
import { SearchInput } from '@/components/kit/search-input';
import { StatusBadge } from '@/components/kit/status-badge';

import TransactionSummary from '../components/TransactionSummary';
import { TRANSACTION_FILTERS, type TransactionFilter } from '../components/transactions/transaction-filters';
import MonthlyAggregationsCard from '../components/MonthlyAggregationsCard';

const TransactionForm = dynamic(() => import('../components/TransactionForm'), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> });
const TransactionFilterFields = dynamic(() => import('../components/transactions/transaction-filters'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
const EmailExportModal = dynamic(() => import('../../components/EmailExportModal'), { ssr: false });

const FILTERS = TRANSACTION_FILTERS;
type Filter = TransactionFilter;
const SORTS = ['date', 'type', 'amount', 'partnerBalance', 'totalBalance', 'createdAt'] as const;

const typeLabel = (type: string) => type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const TYPE_OPTIONS = [{ value: '', label: 'All types' }, ...Object.values(TRANSACTION_TYPES_CONFIG).map((value) => ({ value, label: typeLabel(value) }))];
const SORT_OPTIONS = [
  { value: 'default', label: 'Newest recorded first' },
  { value: 'date:desc', label: 'Date, newest first' },
  { value: 'date:asc', label: 'Date, oldest first' },
  { value: 'amount:desc', label: 'Amount, high to low' },
  { value: 'amount:asc', label: 'Amount, low to high' },
  { value: 'type:asc', label: 'Type, A to Z' },
];

// ─────────────────────────────────────────────────────────────── row helpers (as the list always showed them)

const isManualEntry = (t: TransactionRecord) => t.type === 'PARTNER_TO_PARTNER' || t.type === 'RECORD_AMOUNT';

/** Strip the system "Transfer to/from X - " prefix to show only the reason. */
const manualReason = (note?: string | null) =>
  note ? note.replace(/^Transfer (?:to|from) .+? - /, '').replace(/^Transfer (?:to|from) [^-]+$/, '').trim() : '';

function extractMemberName(note?: string | null): string {
  if (!note) return '-';
  let match = note.match(/Repayment from ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  match = note.match(/Loan disbursed to ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  match = note.match(/Auction payout to ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  match = note.match(/Chit contribution from ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  match = note.match(/from ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  match = note.match(/to ([^-]+?)(?: -|$)/i);
  if (match) return match[1].trim();
  return '-';
}

function getCrDr(t: TransactionRecord, partner: string | null): 'Credit' | 'Debit' | '-' {
  if (t.type === 'PARTNER_TO_PARTNER') {
    if (t.from_partner && !t.to_partner) return 'Debit';
    if (t.to_partner && !t.from_partner) return 'Credit';
    if (t.from_partner && t.to_partner) {
      if (partner) {
        if (t.to_partner === partner) return 'Credit';
        if (t.from_partner === partner) return 'Debit';
      }
      return '-';
    }
  }
  if (t.type === 'RECORD_AMOUNT') {
    if (t.to_partner) return 'Credit';
    if (t.from_partner) return 'Debit';
  }
  if (partner) {
    if (t.to_partner && t.to_partner === partner) return 'Credit';
    if (t.from_partner && t.from_partner === partner) return 'Debit';
    if (t.type === 'LOAN_REPAYMENT' || t.type === 'DOCUMENT_CHARGE') return 'Credit';
    if (t.type === 'LOAN_DISBURSEMENT' || t.type === 'AUCTION_PAYOUT') return 'Debit';
  }
  if (['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'].includes(t.type)) return 'Debit';
  if (['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'].includes(t.type)) return 'Credit';
  if (typeof t.amount === 'number') {
    if (t.amount > 0) return 'Credit';
    if (t.amount < 0) return 'Debit';
  }
  return 'Credit';
}

function getPartnerName(t: TransactionRecord, partner: string | null): string {
  if (t.type === 'PARTNER_TO_PARTNER') {
    if (t.from_partner && !t.to_partner) return t.from_partner;
    if (t.to_partner && !t.from_partner) return t.to_partner;
    if (t.from_partner && t.to_partner) return t.from_partner === partner ? t.from_partner : t.to_partner;
  }
  return t.action_performer || '-';
}

function AmountCell({ t, partner }: { t: TransactionRecord; partner: string | null }) {
  const side = getCrDr(t, partner);
  return (
    <div className="text-right">
      <Money value={t.amount} tone={side === 'Credit' ? 'inflow' : 'plain'} className="font-semibold" />
      <div className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground">{side}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── page

export default function TransactionsPage() {
  return (
    <PageContainer>
      <Transactions />
    </PageContainer>
  );
}

function Transactions() {
  const { partners } = usePartner();
  const list = useListParams<Filter>({ id: 'transactions', filters: FILTERS, sortable: SORTS });
  const p = list.params;
  const focusIds = p.txn && /^\d+(,\d+){0,19}$/.test(p.txn) ? p.txn : '';
  const partner = p.partner || null;
  const advancedOn = !!(p.advType || p.advMember);

  // The API's names for the URL's filters (from/to are startDate/endDate on the server).
  const filterParams = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (p.partner) out.partner = p.partner;
    if (p.type) out.type = p.type;
    if (p.from) out.startDate = p.from;
    if (p.to) out.endDate = p.to;
    if (p.q) out.q = p.q;
    for (const name of ['advType', 'advMember', 'advEntity', 'advSubType'] as const) if (p[name]) out[name] = p[name] as string;
    return out;
  }, [p]);

  const request = React.useMemo(() => {
    if (focusIds) return { page: 1, pageSize: 20, ids: focusIds };
    const out: Record<string, string | number> = { page: p.page, pageSize: p.pageSize, ...filterParams };
    if (p.sort) {
      out.sort = p.sort;
      if (p.order) out.order = p.order;
    }
    return out;
  }, [focusIds, p.page, p.pageSize, p.sort, p.order, filterParams]);

  const query = useListQuery<TransactionRecord>(TRANSACTIONS, { apiParams: request, ready: list.ready, setParams: list.setParams }, { itemsKey: 'transactions' });
  const meta = query.meta;

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing || focusIds) return;
    const next = queryKeys.list(TRANSACTIONS, { ...request, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, request, meta, query.isRefreshing, focusIds]);

  const balances = usePartnerBalances();
  const [recordOpen, setRecordOpen] = React.useState<boolean | null>(null);
  const [emailOpen, setEmailOpen] = React.useState<boolean | null>(null);
  const [recalcOpen, setRecalcOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<TransactionRecord | null>(null);
  const [exportingDb, setExportingDb] = React.useState(false);

  const exportFilters: TransactionFilters = {
    selectedPartnerId: partner ?? 'ALL',
    filterType: p.type ?? '',
    filterMember: '',
    startDate: p.from ?? '',
    endDate: p.to ?? '',
    q: p.q || undefined,
    showAdvanced: advancedOn || !!p.advEntity || !!p.advSubType,
    advType: p.advType ?? '',
    advMember: p.advMember ?? '',
    advEntity: p.advEntity ?? '',
    advSubType: p.advSubType ?? '',
  };

  const exportExcel = () => {
    const params = buildTransactionFilterParams(exportFilters);
    window.open(`/api/transactions/export?${params.toString()}`, '_blank');
  };

  const exportDatabase = async () => {
    setExportingDb(true);
    try {
      const response = await fetch('/api/db-backup');
      if (!response.ok) throw new Error('Database export failed');
      const disposition = response.headers.get('content-disposition');
      const filename = disposition ? disposition.split('filename=')[1]?.replace(/"/g, '') : 'database-backup.zip';
      const blob = await response.blob();
      const href = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = href;
      a.download = filename || 'database-backup.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(href);
      document.body.removeChild(a);
      toast.success('Database backup downloaded');
    } catch (error) {
      console.error('Database export failed:', error);
      toast.error('Database export failed', { description: 'Please try again.' });
    } finally {
      setExportingDb(false);
    }
  };

  const recalculate = async () => {
    const data = await transactionWrites.recalculateBalances();
    toast.success('Balance recalculation completed', {
      description: `Transactions processed: ${data?.transactionsProcessed ?? 0} · Final total balance: ₹${data?.finalTotalBalance?.toLocaleString('en-IN') || '0'}`,
    });
    void invalidateTransactions();
  };

  const setFilter = (patch: ListPatch<Filter>) => list.setParams({ ...patch, txn: null });

  const columns: DataTableColumn<TransactionRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      cell: (t) => (
        <div>
          <DateText value={t.date} />
          {formatDate(t.createdAt) !== formatDate(t.date) ? <div className="text-[11px] text-muted-foreground">Recorded {formatDate(t.createdAt)}</div> : null}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      cell: (t) => (
        <div className="min-w-0">
          <div className="whitespace-nowrap font-medium text-foreground">{typeLabel(t.type)}</div>
          {isManualEntry(t) ? (
            <div className="max-w-[16rem] truncate text-xs text-muted-foreground" title={t.note || ''}>
              {manualReason(t.note) || <span className="italic text-warning-text">No reason recorded</span>}
            </div>
          ) : null}
        </div>
      ),
    },
    { id: 'member', header: 'Member', cell: (t) => <span className="whitespace-nowrap">{isManualEntry(t) ? '-' : extractMemberName(t.note)}</span> },
    { id: 'partner', header: 'Partner', hideBelow: 'lg', cell: (t) => <span className="whitespace-nowrap">{getPartnerName(t, partner)}</span> },
    { id: 'amount', header: 'Amount', numeric: true, sortable: true, cell: (t) => <AmountCell t={t} partner={partner} /> },
    { id: 'partnerBalance', header: 'Partner balance', numeric: true, sortable: true, hideBelow: 'xl', cell: (t) => (t.partnerBalance == null ? <span className="text-muted-foreground">-</span> : <Money value={t.partnerBalance} tone="plain" />) },
    { id: 'totalBalance', header: 'Total balance', numeric: true, sortable: true, cell: (t) => (t.totalBalance == null ? <span className="text-muted-foreground">-</span> : <Money value={t.totalBalance} tone="plain" className="font-medium" />) },
  ];

  const chipLabel = (name: string, value: string): string | null => {
    if (name === 'q') return `Search: ${value}`;
    if (name === 'type') return `Type: ${typeLabel(value)}`;
    if (name === 'partner') return `Partner: ${value}`;
    if (name === 'from') return `From ${formatDate(value)}`;
    if (name === 'to') return `To ${formatDate(value)}`;
    if (name === 'advType') return value === 'loan' ? 'Loans only' : 'Chit funds only';
    if (name === 'advMember') return `Member: ${p.advMemberName || `#${value}`}`;
    if (name === 'advEntity') return `${p.advType === 'loan' ? 'Loan' : 'Chit fund'} #${value}`;
    if (name === 'advSubType') return `Subtype: ${value}`;
    return null;
  };
  const chips = list.activeFilters
    .filter((f) => f.name !== 'txn' && f.name !== 'advMemberName')
    .map((f) => ({
      key: f.name,
      label: chipLabel(f.name, f.value) ?? f.value,
      onRemove: () => {
        if (f.name === 'advType') return setFilter({ advType: null, advEntity: null, advSubType: null });
        if (f.name === 'advMember') return setFilter({ advMember: null, advMemberName: null, advEntity: null, advSubType: null });
        if (f.name === 'advEntity') return setFilter({ advEntity: null, advSubType: null });
        return setFilter({ [f.name]: null } as ListPatch<Filter>);
      },
    }));
  const filterCount = ['partner', 'from', 'to', 'advType', 'advMember', 'advEntity', 'advSubType'].filter((n) => !!p[n as Filter]).length;
  const narrowed = list.activeFilters.some((f) => f.name !== 'txn');

  const totalBalance = (balances.data?.partners ?? []).reduce((sum, x) => sum + (x.balance || 0), 0);

  return (
    <div>
      <PageHeader
        title="Transactions"
        count={meta?.totalCount}
        actions={
          <>
            <Button className={iconOnPhone} onClick={() => setRecordOpen(true)}>
              <Plus aria-hidden="true" />
              <span className="max-sm:sr-only">Record transaction</span>
            </Button>
            <Button className={iconOnPhone} variant="outline" onClick={exportExcel} aria-label="Export to Excel">
              <Download aria-hidden="true" />
              <span className="max-sm:sr-only">Export</span>
            </Button>
            <RowActions
              label="More transaction actions"
              actions={[
                { label: 'Email transactions', icon: Mail, opensDialog: true, onSelect: () => setEmailOpen(true) },
                { label: exportingDb ? 'Exporting database…' : 'Download database backup', icon: Database, disabled: exportingDb, onSelect: () => void exportDatabase() },
                { label: 'Recalculate all balances', icon: Calculator, separatorBefore: true, opensDialog: true, onSelect: () => setRecalcOpen(true) },
              ]}
            />
          </>
        }
      />

      <section aria-labelledby="partner-balances" className="mb-6">
        <h2 id="partner-balances" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Partner balances
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BalanceTile name="Total" badge="All" amount={balances.data ? totalBalance : null} loading={!balances.data && !balances.error} />
          {(balances.data?.partners ?? []).map((x) => (
            <BalanceTile key={x.id} name={x.name} badge={x.isActive ? 'Active' : 'Inactive'} amount={x.balance || 0} />
          ))}
        </div>
      </section>

      <div className="mb-6 space-y-4">
        <MonthlyAggregationsCard startDate={p.from} endDate={p.to} />
        <TransactionSummary params={list.ready ? filterParams : null} partnerLabel={partner} />
      </div>

      {focusIds ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info-border bg-info-subtle px-4 py-3">
          <p className="text-sm text-info-text">
            Showing the transaction{focusIds.includes(',') ? 's' : ''} from a notification (#{focusIds.split(',').join(', #')}). Filters are ignored.
          </p>
          <Button variant="outline" size="sm" onClick={() => list.setParams({ txn: null })}>
            Show all transactions
          </Button>
        </div>
      ) : null}

      <ListToolbar
        search={<SearchInput value={p.q} onChange={(q) => setFilter({ q })} placeholder="Search notes, members, partners" label="Search transactions" />}
        primaryFilter={
          <NativeSelect
            aria-label="Transaction type"
            className="w-48"
            value={p.type ?? ''}
            disabled={advancedOn}
            title={advancedOn ? 'The advanced filter decides the types' : undefined}
            onValueChange={(value) => setFilter({ type: value || null })}
            options={TYPE_OPTIONS}
          />
        }
        filters={<TransactionFilterFields list={list} partners={partners} setFilter={setFilter} />}
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

      <DataTable<TransactionRecord>
        label="Transactions"
        columns={columns}
        rows={query.items}
        getRowId={(t) => t.id}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        sort={{ sort: p.sort, order: p.order }}
        onSortChange={(next) => list.setParams({ sort: next.sort, order: next.order })}
        onRowClick={(t) => setDetail(t)}
        rowClassName={() => (focusIds ? 'bg-info-subtle' : undefined)}
        emptyState={
          narrowed ? (
            <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState
              title="No transactions yet"
              description="Loan, chit fund and manual entries appear here as they are recorded."
              action={
                <Button size="sm" onClick={() => setRecordOpen(true)}>
                  <Plus aria-hidden="true" />
                  Record a transaction
                </Button>
              }
            />
          )
        }
        pagination={
          meta && !focusIds
            ? {
                page: meta.page,
                pageSize: p.pageSize,
                totalCount: meta.totalCount,
                onPageChange: (page) => list.setParams({ page }),
                onPageSizeChange: (pageSize) => list.setParams({ pageSize }),
              }
            : undefined
        }
        renderCard={(t) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{typeLabel(t.type)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isManualEntry(t) ? manualReason(t.note) || 'No reason recorded' : extractMemberName(t.note)} · {getPartnerName(t, partner)}
                </p>
              </div>
              <AmountCell t={t} partner={partner} />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <DateText value={t.date} />
              <span>
                Total balance {t.totalBalance == null ? '-' : <Money value={t.totalBalance} tone="plain" className="text-foreground" />}
              </span>
            </div>
          </div>
        )}
      />

      {recordOpen !== null ? (
        <ResponsiveDialog open={recordOpen} onOpenChange={setRecordOpen} title="Record manual transaction" description="Every manual entry needs a reason and is reviewed before it is saved." size="lg">
          <div className="max-h-[70vh] overflow-y-auto px-0.5 pb-1">
            <TransactionForm onClose={() => setRecordOpen(false)} />
          </div>
        </ResponsiveDialog>
      ) : null}

      {emailOpen !== null ? (
        <EmailExportModal isOpen={emailOpen} onClose={() => setEmailOpen(false)} exportType="Transactions" startDate={p.from ?? ''} endDate={p.to ?? ''} transactionFilters={exportFilters} />
      ) : null}

      <ConfirmDialog
        open={recalcOpen}
        onOpenChange={setRecalcOpen}
        tone="default"
        title="Recalculate all balances?"
        description="Only use this if a transaction was deleted. Every transaction is processed in date order, partner balances and each row's total balance are recalculated, and inconsistencies are fixed."
        confirmLabel="Yes, recalculate"
        onConfirm={recalculate}
      />

      <ResponsiveDialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title={detail ? typeLabel(detail.type) : ''} description={detail ? `Transaction #${detail.id}` : undefined}>
        {detail ? (
          <DescriptionList
            items={[
              { label: 'Amount', value: <AmountCell t={detail} partner={partner} /> },
              { label: 'Date', value: <DateText value={detail.date} /> },
              { label: 'Recorded', value: <DateText value={detail.createdAt} withTime /> },
              { label: 'Partner', value: getPartnerName(detail, partner) },
              { label: 'Entered by', value: detail.entered_by || '-' },
              { label: 'Partner balance', value: detail.partnerBalance == null ? '-' : <Money value={detail.partnerBalance} tone="plain" /> },
              { label: 'Total balance', value: detail.totalBalance == null ? '-' : <Money value={detail.totalBalance} tone="plain" /> },
              { label: 'Note', value: <span className="whitespace-pre-line break-words">{detail.note || '—'}</span>, full: true },
            ]}
          />
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}

function BalanceTile({ name, badge, amount, loading = false }: { name: string; badge: string; amount: number | null; loading?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-card-foreground shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-foreground">{name}</h3>
        {badge === 'Active' || badge === 'Inactive' ? <StatusBadge status={badge === 'Active' ? 'Active' : 'Cancelled'} label={badge} /> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Balance</p>
      <div className="text-lg font-semibold">{loading || amount === null ? <Skeleton className="h-6 w-24" /> : <Money value={amount} decimals={2} tone="plain" className={cn(amount < 0 && 'text-destructive-text')} />}</div>
    </div>
  );
}
