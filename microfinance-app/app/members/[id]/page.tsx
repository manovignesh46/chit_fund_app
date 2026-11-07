'use client';

/**
 * Member detail (Detail template): header, key-figure strip, tabs in ?tab=, panels.
 *
 * Requests on view: the member and their dues (overdue + next 30 days) in parallel, both
 * often already preloaded from the list row. Payment history loads when its tab is first
 * opened; its page and filters live in the URL (page, pageSize, kind, account).
 * Edit opens the shared member form in a dialog.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CalendarClock, FileDown, HandCoins, Pencil, Plus, RefreshCw, Trash2, UserPlus, Wallet, AlertTriangle } from 'lucide-react';

import { toast } from '@/lib/toast';
import DueAccountCard from '@/app/components/dues/DueAccountCard';
import SwipeableTabs from '@/app/components/SwipeableTabs';
import { useListParams } from '@/lib/list/useListParams';
import { normaliseListResponse, useListQuery } from '@/lib/list/useListQuery';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import { ApiError } from '@/lib/query/fetcher';
import {
  invalidateDeletedMember,
  MEMBERS,
  memberWrites,
  useMember,
  useMemberDues,
  type MemberChitMembership,
  type MemberDetail,
  type MemberDues,
  type MemberLoan,
  type PaymentHistoryItem,
} from '@/lib/query/members';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { formatRange } from '@/components/kit/list-pagination';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { RowActions, type RowAction } from '@/components/kit/row-actions';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { STATUS_CLASSES } from '@/components/kit/status';
import { StatusBadge } from '@/components/kit/status-badge';
import { UrlTabs, useUrlTabs } from '@/components/kit/url-tabs';

const MemberFormDialog = dynamic(() => import('@/app/components/members/MemberForm'), { ssr: false });

const TABS = ['details', 'dues', 'chit-funds', 'loans', 'payments'] as const;
type Tab = (typeof TABS)[number];
const NON_RECOVERABLE = 'Non-Recoverable';

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full max-w-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function MemberDetailPage() {
  return (
    <PageContainer fallback={<DetailSkeleton />}>
      <MemberDetailView />
    </PageContainer>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function MemberDetailView() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const memberQuery = useMember(id || null);
  const duesQuery = useMemberDues(id || null);
  const member = memberQuery.data;
  const dues = duesQuery.data;
  useBreadcrumbLabel(id ? `/members/${id}` : null, member?.name);

  const tabs = useUrlTabs<Tab>({ values: TABS, defaultValue: 'details' });
  const [visited, setVisited] = React.useState<ReadonlySet<Tab>>(() => new Set<Tab>(['details']));
  React.useEffect(() => {
    setVisited((prev) => (prev.has(tabs.value) ? prev : new Set([...prev, tabs.value])));
  }, [tabs.value]);

  const [editOpen, setEditOpen] = React.useState<boolean | null>(null);
  const [exporting, setExporting] = React.useState(false);

  if (!member) {
    if (memberQuery.error) {
      const status = memberQuery.error instanceof ApiError ? memberQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Member not found"
            description="The member you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/members">Back to members</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Couldn't load this member" error={memberQuery.error} onRetry={() => void memberQuery.mutate()} />;
    }
    return <DetailSkeleton />;
  }

  const exportMember = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await memberWrites.exportMembers([member.id]);
    } catch (error) {
      toast.error('Export failed', { description: errorMessage(error) ?? 'Failed to export member' });
    } finally {
      setExporting(false);
    }
  };

  const deleteMember = async () => {
    try {
      await memberWrites.remove(member.id);
    } catch (error) {
      toast.error(`Couldn't delete ${member.name}`, { description: errorMessage(error) ?? 'Failed to delete member.' });
      return;
    }
    toast.success('Member deleted', { description: member.name });
    const { forget } = invalidateDeletedMember(member.id);
    router.push('/members');
    whenIdle(forget);
  };

  const menu: RowAction[] = [
    { label: 'Export to Excel', icon: FileDown, onSelect: () => void exportMember(), disabled: exporting },
    { label: 'Assign to chit fund', icon: UserPlus, href: `/members/${member.id}/assign-chit-fund` },
    { label: 'New loan', icon: HandCoins, href: `/loans/new?borrowerId=${member.id}` },
    {
      label: 'Delete member',
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      confirm: {
        title: `Delete ${member.name}?`,
        description:
          'This action cannot be undone. Members associated with chit funds or loans cannot be deleted: remove them from all chit funds and loans first.',
        confirmLabel: 'Delete member',
        onConfirm: deleteMember,
      },
    },
  ];

  const summary = dues?.summary;
  const duesLoading = !dues && !duesQuery.error;
  const panel = (tab: Tab, children: React.ReactNode) => {
    const active = tabs.value === tab;
    return (
      <div
        role="tabpanel"
        id={tabs.panelId(tab)}
        aria-labelledby={tabs.tabId(tab)}
        className={cn(!active && 'lg:h-0 lg:overflow-hidden')}
        {...({ inert: active ? undefined : true } as Record<string, unknown>)}
      >
        {children}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Member #${member.id}`}
        title={member.name}
        description={
          <>
            <span className="tabular-nums">{member.contact}</span>
            {' · '}
            {plural(member._count.chitFundMembers, 'chit fund')} · {plural(member._count.loans, 'loan')}
          </>
        }
        actions={
          <>
            <Button className={iconOnPhone} variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" />
              <span className="max-sm:sr-only">Edit</span>
            </Button>
            <RowActions label="More member actions" actions={menu} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          icon={AlertTriangle}
          loading={duesLoading}
          tone={(summary?.overdueAmount ?? 0) > 0 ? 'destructive' : 'neutral'}
          value={summary ? <Money value={summary.overdueAmount} tone="plain" /> : '—'}
          hint={summary ? plural(summary.overdueAccounts, 'account') : undefined}
          onClick={() => tabs.setValue('dues')}
        />
        <StatCard
          label="Due in next 7 days"
          icon={CalendarClock}
          loading={duesLoading}
          tone={(summary?.dueSoonAmount ?? 0) > 0 ? 'warning' : 'neutral'}
          value={summary ? <Money value={summary.dueSoonAmount} tone="plain" /> : '—'}
          hint="Includes today"
          onClick={() => tabs.setValue('dues')}
        />
        <StatCard
          label="Total outstanding"
          icon={Wallet}
          loading={duesLoading}
          value={summary ? <Money value={summary.totalOutstanding} tone="plain" /> : '—'}
          hint="Overdue + next 30 days"
          onClick={() => tabs.setValue('dues')}
        />
        <StatCard
          label="Last payment"
          icon={HandCoins}
          loading={duesLoading}
          value={dues?.lastPayment ? <Money value={dues.lastPayment.amount} tone="plain" /> : dues ? 'None' : '—'}
          hint={dues?.lastPayment ? <DateText value={dues.lastPayment.date} /> : undefined}
          onClick={() => tabs.setValue('payments')}
        />
      </div>

      <UrlTabs
        tabs={tabs}
        aria-label="Member sections"
        items={[
          { value: 'details', label: 'Member details' },
          { value: 'dues', label: 'Dues', count: dues ? dues.accounts.length : undefined },
          { value: 'chit-funds', label: 'Chit funds', count: member._count.chitFundMembers },
          { value: 'loans', label: 'Loans', count: member._count.loans },
          { value: 'payments', label: 'Payments' },
        ]}
      />

      <SwipeableTabs tabs={TABS} activeTab={tabs.value} onTabChange={tabs.setValue}>
        {panel(
          'details',
          <SectionCard>
            <DescriptionList
              columns={2}
              items={[
                { label: 'Name', value: member.name },
                { label: 'Contact', value: <span className="tabular-nums">{member.contact}</span> },
                { label: 'Email', value: member.email || '—' },
                { label: 'Address', value: member.address || '—' },
                { label: 'Member since', value: <DateText value={member.createdAt} /> },
                ...(member.notes ? [{ label: 'Notes', value: <span className="whitespace-pre-line">{member.notes}</span>, full: true }] : []),
              ]}
            />
          </SectionCard>
        )}
        {panel('dues', <DuesPanel dues={dues} error={duesQuery.error} validating={duesQuery.isValidating} onRefresh={() => void duesQuery.mutate()} />)}
        {panel('chit-funds', <ChitFundsPanel member={member} />)}
        {panel('loans', <LoansPanel member={member} dues={dues} onShowDues={() => tabs.setValue('dues')} />)}
        {panel('payments', visited.has('payments') ? <PaymentsPanel member={member} /> : <SectionCard title="Payment history"><Skeleton className="h-40 w-full" /></SectionCard>)}
      </SwipeableTabs>

      {editOpen !== null ? <MemberFormDialog open={editOpen} onOpenChange={setEditOpen} member={member} /> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── dues

function DuesPanel({ dues, error, validating, onRefresh }: { dues: MemberDues | undefined; error: unknown; validating: boolean; onRefresh: () => void }) {
  return (
    <SectionCard
      title="Pending dues"
      description="Unpaid loan installments and chit contributions — overdue and due in the next 30 days."
      actions={
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={validating}>
          <RefreshCw aria-hidden="true" className={cn(validating && 'motion-safe:animate-spin')} />
          {validating ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
      contentClassName="p-3 sm:p-4"
    >
      {error && !dues ? (
        <ErrorState compact title="Couldn't load pending dues" error={error} onRetry={onRefresh} />
      ) : !dues ? (
        <div className="space-y-2" aria-hidden="true">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : dues.accounts.length === 0 ? (
        <EmptyState compact title="All caught up" description="Nothing overdue or due in the next 30 days." />
      ) : (
        <ul className={cn('space-y-2 transition-opacity', validating && 'opacity-60')} aria-busy={validating || undefined}>
          {dues.accounts.map((a) => (
            <DueAccountCard key={a.key} account={a} showMember={false} defaultOpen={dues.accounts.length === 1} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────── chit funds

function ChitFundsPanel({ member }: { member: MemberDetail }) {
  const columns: DataTableColumn<MemberChitMembership>[] = [
    {
      id: 'name',
      header: 'Chit fund',
      cell: (m) => (
        <Link href={`/chit-funds/${m.chitFund.id}`} className="font-medium text-foreground hover:text-primary-text hover:underline">
          {m.chitFund.name}
        </Link>
      ),
    },
    { id: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.chitFund.status} /> },
    {
      id: 'progress',
      header: 'Progress',
      cell: (m) => (
        <span className="whitespace-nowrap tabular-nums">
          Month {m.chitFund.currentMonth} <span className="text-muted-foreground">of {m.chitFund.duration}</span>
        </span>
      ),
    },
    { id: 'contribution', header: 'Contribution', numeric: true, cell: (m) => <Money value={m.contribution} tone="plain" /> },
    { id: 'missed', header: 'Missed', numeric: true, cell: (m) => <MissedCell m={m} /> },
    { id: 'pending', header: 'Pending amount', numeric: true, cell: (m) => <PendingCell m={m} /> },
    { id: 'joinDate', header: 'Join date', hideBelow: 'xl', cell: (m) => <DateText value={m.joinDate} /> },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (m) => (
        <Link href={`/chit-funds/${m.chitFund.id}/members/${m.id}/contributions`} className="whitespace-nowrap text-sm font-medium text-primary-text hover:underline">
          View contributions
        </Link>
      ),
    },
  ];
  return (
    <SectionCard
      title={`Chit funds (${member._count.chitFundMembers})`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/members/${member.id}/assign-chit-fund`}>
            <Plus aria-hidden="true" />
            Assign to chit fund
          </Link>
        </Button>
      }
      flush
      contentClassName="p-3 sm:p-4"
    >
      <DataTable<MemberChitMembership>
        label="Chit fund memberships"
        mode="client"
        columns={columns}
        rows={member.chitFundMembers}
        getRowId={(m) => m.id}
        emptyState={<EmptyState compact title="Not in any chit fund" description="This member is not part of any chit funds yet." />}
        renderCard={(m) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/chit-funds/${m.chitFund.id}`} className="font-medium text-foreground hover:underline">
                  {m.chitFund.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Month {m.chitFund.currentMonth} of {m.chitFund.duration} · joined <DateText value={m.joinDate} />
                </div>
              </div>
              <StatusBadge status={m.chitFund.status} />
            </div>
            <dl className="grid grid-cols-3 gap-x-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Contribution</dt>
                <dd><Money value={m.contribution} tone="plain" /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Missed</dt>
                <dd><MissedCell m={m} /></dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">Pending</dt>
                <dd><PendingCell m={m} /></dd>
              </div>
            </dl>
            <Link href={`/chit-funds/${m.chitFund.id}/members/${m.id}/contributions`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text hover:underline">
              View contributions
            </Link>
          </div>
        )}
      />
    </SectionCard>
  );
}

function MissedCell({ m }: { m: MemberChitMembership }) {
  const missed = m.missedContributions ?? 0;
  return (
    <div>
      <span className={cn('tabular-nums', missed > 0 && 'font-semibold text-destructive-text')}>{missed}</span>
      {(m.pendingMonths?.length ?? 0) > 0 ? <div className="text-xs text-muted-foreground">Months: {m.pendingMonths!.join(', ')}</div> : null}
    </div>
  );
}

function PendingCell({ m }: { m: MemberChitMembership }) {
  const partial = m.partialMonths ?? [];
  return (
    <div>
      <Money value={m.pendingAmount ?? 0} tone="overdue" className="font-semibold" />
      {partial.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          Incl. <Money value={partial.reduce((sum, p) => sum + p.balance, 0)} tone="plain" /> balance ({partial.map((p) => `Month ${p.month}`).join(', ')})
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── loans

function LoansPanel({ member, dues, onShowDues }: { member: MemberDetail; dues: MemberDues | undefined; onShowDues: () => void }) {
  const nonRecoverable = member.loans.filter((l) => l.status === NON_RECOVERABLE);
  const routine = member.loans.filter((l) => l.status !== NON_RECOVERABLE);

  const pendingCell = (loan: MemberLoan) => {
    if (!dues) return <span className="text-muted-foreground">…</span>;
    const acct = dues.accounts.find((a) => a.kind === 'loan' && a.entityId === loan.id);
    if (!acct) return <span className="text-muted-foreground">—</span>;
    return (
      <button type="button" onClick={onShowDues} className="rounded-sm text-right hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Money value={acct.totalOutstanding} tone={acct.overdueAmount > 0 ? 'overdue' : 'plain'} className="font-semibold" />
        <span className="block text-xs text-muted-foreground">
          {plural(acct.periods.length, 'payment')}
          {acct.maxDaysOverdue > 0 ? ` · ${acct.maxDaysOverdue}d late` : ''}
        </span>
      </button>
    );
  };
  const nextDue = (loan: MemberLoan) =>
    loan.nextPaymentDate ? (
      <DateText
        value={loan.nextPaymentDate}
        className={cn(loan.status === 'Active' && new Date(loan.nextPaymentDate) < new Date() && 'font-semibold text-destructive-text')}
      />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  const installment = (loan: MemberLoan) => (loan.loanType === 'Reducing Balance' ? 'Dynamic' : <Money value={loan.installmentAmount || 0} tone="plain" />);

  const columns: DataTableColumn<MemberLoan>[] = [
    {
      id: 'loanType',
      header: 'Loan',
      cell: (loan) => (
        <Link href={`/loans/${loan.id}`} className="font-medium text-foreground hover:text-primary-text hover:underline">
          {loan.loanType}
          <span className="block text-xs font-normal text-muted-foreground">#{loan.id}</span>
        </Link>
      ),
    },
    { id: 'amount', header: 'Amount', numeric: true, cell: (loan) => <Money value={loan.amount} tone="plain" /> },
    { id: 'remaining', header: 'Remaining', numeric: true, cell: (loan) => <Money value={loan.remainingAmount} tone="plain" /> },
    { id: 'pending', header: 'Pending', numeric: true, cell: pendingCell },
    { id: 'overdue', header: 'Overdue', numeric: true, cell: (loan) => <Money value={loan.overdueAmount || 0} tone="overdue" className="font-semibold" /> },
    {
      id: 'missed',
      header: 'Missed',
      numeric: true,
      cell: (loan) => <span className={cn('tabular-nums', loan.missedPayments > 0 && 'font-semibold text-destructive-text')}>{loan.missedPayments || 0}</span>,
    },
    { id: 'nextDue', header: 'Next due', cell: nextDue },
    { id: 'installment', header: 'Installment', numeric: true, hideBelow: 'xl', cell: installment },
    { id: 'status', header: 'Status', cell: (loan) => <StatusBadge status={loan.status} /> },
    { id: 'disbursed', header: 'Disbursed', hideBelow: '2xl', cell: (loan) => <DateText value={loan.disbursementDate} /> },
  ];

  return (
    <SectionCard
      title={`Loans (${member._count.loans})`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/loans/new?borrowerId=${member.id}`}>
            <Plus aria-hidden="true" />
            Create new loan
          </Link>
        </Button>
      }
      flush
      contentClassName="p-3 sm:p-4"
    >
      {nonRecoverable.length > 0 ? (
        <section aria-labelledby="nr-loans" className="mb-4 rounded-lg border border-destructive-border bg-destructive-subtle/40 p-3 sm:p-4">
          <h3 id="nr-loans" className="text-sm font-semibold text-foreground">Non-Recoverable · Offline Recovery</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Excluded from this member’s routine pending dues.</p>
          <ul className="mt-3 space-y-3">
            {nonRecoverable.map((l) => (
              <li key={l.id} className="text-sm">
                <Link className="font-medium text-primary-text underline" href={`/loans/${l.id}#loan-recovery`}>
                  Loan #{l.id} · {l.loanType}
                </Link>
                <p className="text-foreground">
                  Principal <Money value={l.remainingAmount} tone="plain" /> · Unpaid interest <Money value={l.recoveryInterestOutstanding || 0} tone="plain" /> · Recovered{' '}
                  <Money value={l.recoveryAmount || 0} tone="plain" /> · {l.recoveryOutcome === 'Recovered' ? 'Fully Recovered' : l.recoveryOutcome}
                </p>
                <p className="text-xs text-muted-foreground">
                  Marked <DateText value={l.nonRecoverableAt} /> · {l.nonRecoverableReason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <DataTable<MemberLoan>
        label="Loans"
        mode="client"
        columns={columns}
        rows={routine}
        getRowId={(loan) => loan.id}
        emptyState={<EmptyState compact title="No loans in routine collection." />}
        renderCard={(loan) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/loans/${loan.id}`} className="font-medium text-foreground hover:underline">
                  {loan.loanType} · <Money value={loan.amount} tone="plain" />
                </Link>
                <div className="text-xs text-muted-foreground">
                  #{loan.id} · disbursed <DateText value={loan.disbursementDate} />
                </div>
              </div>
              <StatusBadge status={loan.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd><Money value={loan.remainingAmount} tone="plain" /></dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">Pending</dt>
                <dd>{pendingCell(loan)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Overdue</dt>
                <dd>
                  <Money value={loan.overdueAmount || 0} tone="overdue" />
                  {loan.missedPayments > 0 ? <span className="ml-1 text-xs text-destructive-text">({loan.missedPayments} missed)</span> : null}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">Next due</dt>
                <dd>{nextDue(loan)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Installment</dt>
                <dd>{installment(loan)}</dd>
              </div>
            </dl>
          </div>
        )}
      />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────── payments

const HISTORY_FILTERS = ['kind', 'account'] as const;
const KIND_OPTIONS = [
  { value: '', label: 'All payments' },
  { value: 'contribution', label: 'Chit contributions' },
  { value: 'repayment', label: 'Loan repayments' },
];

function PaymentsPanel({ member }: { member: MemberDetail }) {
  const list = useListParams<(typeof HISTORY_FILTERS)[number]>({ id: 'member-history', filters: HISTORY_FILTERS, defaults: { pageSize: 25 } });
  const query = useListQuery<PaymentHistoryItem, { totalAmount: number }>(MEMBERS, list, {
    action: 'history',
    id: member.id,
    itemsKey: 'items',
    select: (raw, request) => ({
      ...normaliseListResponse<PaymentHistoryItem>(raw, request, 'items'),
      summary: { totalAmount: Number((raw as { totalAmount?: number } | null)?.totalAmount ?? 0) },
    }),
  });
  const meta = query.meta;
  const kind = list.params.kind ?? '';

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.action(MEMBERS, 'history', member.id, { ...list.apiParams, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, list.apiParams, meta, query.isRefreshing, member.id]);

  const accountOptions = [
    { value: '', label: 'All accounts' },
    ...(kind !== 'repayment' ? member.chitFundMembers.map((m) => ({ value: `chit-${m.chitFund.id}`, label: m.chitFund.name })) : []),
    ...(kind !== 'contribution' ? member.loans.map((l) => ({ value: `loan-${l.id}`, label: `Loan #${l.id} · ${l.loanType}` })) : []),
  ];
  const accountLabel = (value: string) => accountOptions.find((o) => o.value === value)?.label ?? value;
  const chips = list.activeFilters.map((f) => ({
    key: f.name,
    label: f.name === 'kind' ? (KIND_OPTIONS.find((o) => o.value === f.value)?.label ?? f.value) : accountLabel(f.value),
    onRemove: () => list.setParams({ [f.name]: null } as Parameters<typeof list.setParams>[0]),
  }));

  const typeBadge = (item: PaymentHistoryItem) => (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-semibold uppercase tracking-wide',
        item.kind === 'repayment' ? STATUS_CLASSES.info.soft : STATUS_CLASSES.neutral.soft
      )}
    >
      {item.kind === 'repayment' ? 'Repayment' : 'Contribution'}
    </span>
  );
  const period = (item: PaymentHistoryItem) => (
    <div>
      <span className="whitespace-nowrap">{item.periodLabel}</span>
      {item.detail ? (
        <span className="block max-w-[200px] truncate text-xs text-muted-foreground" title={item.detail}>
          {item.detail}
        </span>
      ) : null}
    </div>
  );
  const columns: DataTableColumn<PaymentHistoryItem>[] = [
    { id: 'date', header: 'Date', cell: (item) => <DateText value={item.date} /> },
    { id: 'type', header: 'Type', cell: typeBadge },
    { id: 'account', header: 'Account', cell: (item) => <span className="whitespace-nowrap">{item.accountName}</span> },
    { id: 'period', header: 'Period', cell: period },
    { id: 'amount', header: 'Amount', numeric: true, cell: (item) => <Money value={item.amount} tone="inflow" className="font-semibold" /> },
    { id: 'balance', header: 'Balance', numeric: true, cell: (item) => <Money value={item.balance} tone="overdue" /> },
    { id: 'collectedBy', header: 'Collected by', hideBelow: 'lg', cell: (item) => item.collectedBy || <span className="text-muted-foreground">—</span> },
    {
      id: 'open',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      cell: (item) => (
        <Link href={item.href} className="text-sm font-medium text-primary-text hover:underline" aria-label={`Open ${item.accountName}`}>
          Open
        </Link>
      ),
    },
  ];

  return (
    <SectionCard
      title="Payment history"
      description={meta ? `${plural(meta.totalCount, 'payment')} · ${formatMoney(query.summary?.totalAmount ?? 0)} received` : undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            aria-label="Payment type"
            size="sm"
            value={kind}
            onValueChange={(value) => list.setParams({ kind: value || null, account: null })}
            options={KIND_OPTIONS}
          />
          <NativeSelect
            aria-label="Account"
            size="sm"
            value={list.params.account ?? ''}
            onValueChange={(value) => list.setParams({ account: value || null })}
            options={accountOptions}
          />
        </div>
      }
      flush
      contentClassName="p-3 sm:p-4"
    >
      {chips.length > 0 || meta ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <FilterChips chips={chips} onClearAll={list.clearFilters} />
          {meta ? <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{formatRange(meta.page, meta.pageSize, meta.totalCount)}</p> : null}
        </div>
      ) : null}
      <DataTable<PaymentHistoryItem>
        label="Payment history"
        columns={columns}
        rows={query.items}
        getRowId={(item) => item.key}
        isInitialLoading={query.isInitialLoading}
        isRefreshing={query.isRefreshing}
        error={query.error}
        onRetry={() => void query.mutate()}
        skeletonRows={5}
        emptyState={
          list.isFiltered ? (
            <EmptyState compact variant="no-results" title="No payments recorded for this filter." description="Try another account or payment type." onClearFilters={list.clearFilters} />
          ) : (
            <EmptyState compact title="No payments recorded yet." description="Chit contributions and loan repayments appear here." />
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
        renderCard={(item) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.accountName}</p>
                <p className="text-xs text-muted-foreground">
                  <DateText value={item.date} /> · {item.periodLabel}
                </p>
              </div>
              <Money value={item.amount} tone="inflow" className="font-semibold" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                {typeBadge(item)}
                {item.balance > 0 ? (
                  <span className="text-destructive-text">
                    Balance <Money value={item.balance} tone="overdue" />
                  </span>
                ) : null}
                {item.detail ? <span className="text-muted-foreground">{item.detail}</span> : null}
              </span>
              <Link href={item.href} className="inline-flex min-h-11 items-center font-medium text-primary-text hover:underline">
                Open
              </Link>
            </div>
            {item.collectedBy ? <p className="text-xs text-muted-foreground">Collected by {item.collectedBy}</p> : null}
          </div>
        )}
      />
    </SectionCard>
  );
}
