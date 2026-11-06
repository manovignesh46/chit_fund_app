'use client';

/**
 * Loan detail (Detail template): header, key-figure strip, tabs in ?tab=, panels.
 *
 * Requests on view: the loan (often already preloaded from the list row), plus the
 * non-blocking POST update-overdue as before. update-overdue rewrites the loan row, so
 * the loan is refetched once it returns; otherwise its `updatedAt` is stale and every
 * recovery action fails with "This loan changed" (the Phase 3 behaviour).
 * Schedules load when their tab is first opened; the payment form when its tab is.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { Ban, CalendarClock, Eye, EyeOff, FileDown, ListOrdered, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react';

import LoanRecoveryPanel from '@/app/components/loans/LoanRecoveryPanel';
import RepaymentForm from '@/app/components/loans/RepaymentForm';
import SwipeableTabs from '@/app/components/SwipeableTabs';
import { ScheduleTable, Updating, useQuickPay, useRecordPayment, withPending } from '@/app/components/loans/payments';
import { invalidateLoan, invalidateLoans, loanWrites, useLoan, useLoanSchedules, type LoanRecord } from '@/lib/query/loans';
import { ApiError } from '@/lib/query/fetcher';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { RowActions, type RowAction } from '@/components/kit/row-actions';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { UrlTabs, useUrlTabs } from '@/components/kit/url-tabs';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const TABS = ['details', 'schedule', 'payment'] as const;
type Tab = (typeof TABS)[number];
const NON_RECOVERABLE = 'Non-Recoverable';

/** End date: disbursement + duration weeks (Weekly loan type) or months, as before. */
function endDate(loan: LoanRecord): string | null {
  if (!loan.disbursementDate) return null;
  const start = new Date(loan.disbursementDate);
  const end = new Date(start);
  if (loan.loanType === 'Weekly') end.setDate(start.getDate() + loan.duration * 7);
  else end.setMonth(start.getMonth() + loan.duration);
  return end.toISOString();
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function LoanDetailPage() {
  return (
    <PageContainer fallback={<DetailSkeleton />}>
      <LoanDetail />
    </PageContainer>
  );
}

function LoanDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const loanQuery = useLoan(id || null);
  const loan = loanQuery.data;
  useBreadcrumbLabel(id ? `/loans/${id}` : null, loan?.borrower?.name);

  const tabs = useUrlTabs<Tab>({ values: TABS, defaultValue: 'details' });
  const [visited, setVisited] = React.useState<ReadonlySet<Tab>>(() => new Set<Tab>(['details']));
  React.useEffect(() => {
    setVisited((prev) => (prev.has(tabs.value) ? prev : new Set([...prev, tabs.value])));
  }, [tabs.value]);

  // Recalculate overdue figures on view (non-blocking), then refresh the loan (updatedAt).
  const refreshLoan = loanQuery.mutate;
  React.useEffect(() => {
    if (!id) return;
    let live = true;
    void loanWrites.updateOverdue(id).then(() => {
      if (live) void refreshLoan();
    });
    return () => {
      live = false;
    };
  }, [id, refreshLoan]);

  // /loans/:id#loan-recovery: scroll once the section exists (it renders after the loan loads).
  const scrolledToHash = React.useRef(false);
  React.useEffect(() => {
    if (!loan || scrolledToHash.current || typeof window === 'undefined') return;
    if (window.location.hash !== '#loan-recovery') return;
    scrolledToHash.current = true;
    // Content above and below settles over the first second (fonts, refetches): re-align a few
    // times unless the user starts scrolling.
    const align = () => document.getElementById('loan-recovery')?.scrollIntoView({ block: 'start' });
    const timers = [0, 250, 700, 1500].map((ms) => window.setTimeout(align, ms));
    const stop = () => timers.forEach((t) => window.clearTimeout(t));
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    events.forEach((e) => window.addEventListener(e, stop, { once: true, passive: true }));
    // No cleanup on purpose: the loan refetch after update-overdue must not cancel the alignment.
  }, [loan]);

  const schedulesQuery = useLoanSchedules(id || null, false, visited.has('schedule'));
  const payment = useRecordPayment(loan);
  const quickPay = useQuickPay(loan, payment.record);
  const scheduleRows = React.useMemo(() => withPending(schedulesQuery.schedules, payment.pending), [schedulesQuery.schedules, payment.pending]);

  const [markRequest, setMarkRequest] = React.useState(0);
  // The header menu button (rendered by RowActions), for returning focus after the Mark dialog.
  const menuTrigger = React.useMemo(() => ({ get current() { return document.querySelector<HTMLElement>('button[aria-label="More loan actions"]'); } }), []);
  const [showProfit, setShowProfit] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  if (!loan) {
    if (loanQuery.error) {
      const status = loanQuery.error instanceof ApiError ? loanQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Loan not found"
            description="The loan you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/loans">Return to loans</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Couldn't load this loan" error={loanQuery.error} onRetry={() => void loanQuery.mutate()} />;
    }
    return <DetailSkeleton />;
  }

  const updating = payment.saving;
  const isNR = loan.status === NON_RECOVERABLE;
  const canMark = ['Active', 'Defaulted'].includes(loan.status) && loan.remainingAmount > 0;
  const periodWord = loan.loanType === 'Weekly' ? 'Week' : 'Month';

  const onRecoveryChange = () => invalidateLoan(loan.id, loan.borrowerId);

  const exportLoan = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const borrower = (loan.borrower?.name ?? 'loan').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${borrower}_${Math.round(loan.amount)}_${new Date(loan.disbursementDate).toISOString().split('T')[0]}.xlsx`;
      const response = await fetch(`/api/loans/consolidated?action=export&id=${loan.id}`);
      if (!response.ok) throw new Error('Failed to export loan details');
      const url = window.URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error('Failed to export loan details. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteLoan = async () => {
    await loanWrites.remove(loan.id);
    toast.success('Loan deleted', { description: loan.borrower?.name });
    void invalidateLoans(loan.borrowerId);
    router.push('/loans');
  };

  const menu: RowAction[] = [
    { label: 'Export to Excel', icon: FileDown, onSelect: () => void exportLoan(), disabled: exporting },
    { label: 'All repayments', icon: ListOrdered, href: `/loans/${loan.id}/repayments` },
    { label: 'Payment schedules page', icon: CalendarClock, href: `/loans/${loan.id}/payment-schedules` },
    ...(canMark ? [{ label: 'Mark as Non-Recoverable', icon: Ban, destructive: true, separatorBefore: true, onSelect: () => setMarkRequest((n) => n + 1) }] : []),
    ...(!loan.nonRecoverableAt
      ? [
          {
            label: 'Delete loan',
            icon: Trash2,
            destructive: true,
            separatorBefore: !canMark,
            confirm: {
              title: 'Delete this loan?',
              description: `${loan.borrower?.name ?? 'This loan'} · disbursed ${formatDate(loan.disbursementDate)}. This action cannot be undone. Loans with repayments must have them deleted first.`,
              confirmLabel: 'Delete loan',
              onConfirm: deleteLoan,
            },
          },
        ]
      : []),
  ];

  const currentPeriod =
    loan.currentMonth === 0 ? (
      <span className="text-warning-text">Not started</span>
    ) : (
      <>
        {loan.currentMonth}
        <span className="text-base font-normal text-muted-foreground"> / {loan.duration}</span>
      </>
    );

  const detailItems = [
    { label: 'Loan amount', value: <Money value={loan.amount} tone="plain" />, numeric: true },
    { label: 'Remaining balance', value: <Updating active={updating}><Money value={loan.remainingAmount} tone="plain" /></Updating>, numeric: true },
    {
      label: 'Overdue',
      value: (
        <Updating active={updating}>
          {loan.missedPayments > 0 ? (
            <span className="font-medium text-destructive-text">
              {loan.missedPayments} {loan.missedPayments === 1 ? 'payment' : 'payments'} · <Money value={loan.overdueAmount} tone="overdue" />
            </span>
          ) : (
            <span className="text-success-text">None</span>
          )}
        </Updating>
      ),
    },
    ...(loan.loanType === 'Reducing Balance'
      ? [{ label: 'Interest rate (%)', value: `${loan.interestPercentage}%`, numeric: true }]
      : loan.repaymentType === 'Monthly'
        ? [{ label: 'Interest amount', value: <Money value={loan.interestRate} tone="plain" />, numeric: true }]
        : []),
    ...(loan.repaymentType === 'Monthly' ? [{ label: 'Document charge', value: <Money value={loan.documentCharge || 0} tone="plain" />, numeric: true }] : []),
    {
      label: 'Total profit',
      value: showProfit ? (
        <Updating active={updating}>
          <Money value={loan.totalProfit ?? null} tone="plain" className="text-success-text" />
        </Updating>
      ) : (
        <button type="button" onClick={() => setShowProfit(true)} className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Eye aria-hidden="true" className="h-4 w-4" />
          Show
        </button>
      ),
      hint: showProfit ? (
        <span className="inline-flex items-center gap-2">
          Interest earned from all repayments plus document charges.
          <button type="button" onClick={() => setShowProfit(false)} aria-label="Hide total profit" className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : undefined,
    },
    { label: 'Installment amount', value: loan.loanType === 'Reducing Balance' ? 'Dynamic' : <Money value={loan.installmentAmount || 0} tone="plain" />, numeric: true },
    { label: 'Loan type', value: loan.loanType },
    { label: 'Duration', value: `${loan.duration} ${loan.loanType === 'Weekly' ? 'weeks' : 'months'}`, numeric: true },
    { label: 'Disbursement date', value: <DateText value={loan.disbursementDate} /> },
    { label: 'Next payment date', value: <Updating active={updating}><DateText value={loan.nextPaymentDate} /></Updating> },
    { label: 'End date', value: <DateText value={endDate(loan)} /> },
  ];

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
        eyebrow={`Loan #${loan.id} · ${loan.loanType}`}
        title={loan.borrower?.name || 'Unknown'}
        status={<Updating active={updating}><StatusBadge status={loan.status} size="md" /></Updating>}
        description={loan.borrower?.contact || 'No contact'}
        actions={
          <>
            {!isNR ? (
              <Button onClick={() => tabs.setValue('payment')}>
                <Plus aria-hidden="true" />
                Record payment
              </Button>
            ) : null}
            {!loan.nonRecoverableAt ? (
              <Button variant="outline" asChild>
                <Link href={`/loans/${loan.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            ) : null}
            <RowActions label="More loan actions" actions={menu} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Remaining balance" icon={Wallet} value={<Updating active={updating}><Money value={loan.remainingAmount} tone="plain" /></Updating>} hint={<>of <Money value={loan.amount} tone="plain" /></>} />
        <StatCard
          label="Overdue"
          icon={Receipt}
          tone={loan.overdueAmount > 0 ? 'destructive' : 'neutral'}
          value={<Updating active={updating}><Money value={loan.overdueAmount} tone={loan.overdueAmount > 0 ? 'plain' : 'auto'} /></Updating>}
          hint={loan.missedPayments > 0 ? `${loan.missedPayments} missed ${loan.missedPayments === 1 ? 'payment' : 'payments'}` : 'No missed payments'}
        />
        <StatCard label="Next payment" icon={CalendarClock} value={<Updating active={updating}><DateText value={loan.nextPaymentDate} className="text-xl" /></Updating>} hint={loan.loanType === 'Reducing Balance' ? 'Dynamic installment' : <><Money value={loan.installmentAmount} tone="plain" /> installment</>} />
        <StatCard label={`Current ${periodWord.toLowerCase()}`} icon={ListOrdered} value={<Updating active={updating}>{currentPeriod}</Updating>} hint={`${loan.duration} ${loan.loanType === 'Weekly' ? 'weeks' : 'months'} in total`} />
      </div>

      <LoanRecoveryPanel loan={loan as never} onChange={onRecoveryChange} />
      <LoanRecoveryPanel loan={loan as never} onChange={onRecoveryChange} mode="menu" hideTrigger markRequest={markRequest} returnFocusRef={menuTrigger} />

      <UrlTabs
        tabs={tabs}
        aria-label="Loan sections"
        items={[
          { value: 'details', label: 'Loan details' },
          { value: 'schedule', label: 'Payment schedule' },
          { value: 'payment', label: 'Record payment' },
        ]}
      />

      <SwipeableTabs tabs={TABS} activeTab={tabs.value} onTabChange={tabs.setValue}>
        {panel(
          'details',
          <SectionCard>
            <DescriptionList columns={4} items={detailItems} />
          </SectionCard>
        )}
        {panel(
          'schedule',
          <SectionCard
            title="Payment schedule"
            description="Past due dates (including overdue), paid periods, and the next payment when it is due within 3 days."
            actions={
              <Button variant="link" size="sm" asChild className="px-0">
                <Link href={`/loans/${loan.id}/repayments`}>View all repayments</Link>
              </Button>
            }
            flush
            contentClassName="p-3 sm:p-4"
          >
            {visited.has('schedule') ? (
              <ScheduleTable
                loan={loan}
                rows={scheduleRows}
                isInitialLoading={schedulesQuery.data === undefined && !schedulesQuery.error}
                isRefreshing={schedulesQuery.data !== undefined && schedulesQuery.isLoading}
                error={schedulesQuery.error}
                onRetry={() => void schedulesQuery.mutate()}
                actionsDisabled={payment.saving || schedulesQuery.isValidating}
                onQuickPay={quickPay}
                emptyState={
                  <EmptyState
                    compact
                    title="No payment schedules to display."
                    description="Payment schedules show all past payments (including overdue) and the next upcoming payment if it's due within 3 days."
                  />
                }
              />
            ) : null}
          </SectionCard>
        )}
        {panel(
          'payment',
          visited.has('payment') ? (
            <RepaymentForm
              loanId={loan.id}
              initialLoan={loan}
              busy={payment.saving}
              onSubmit={async (body, schedule) => {
                tabs.setValue('schedule');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                try {
                  await payment.record(body, schedule?.dueDate);
                } catch (error) {
                  tabs.setValue('payment');
                  throw error;
                }
              }}
            />
          ) : (
            <SectionCard title="Record payment">
              <Skeleton className="h-40 w-full" />
            </SectionCard>
          )
        )}
      </SwipeableTabs>

    </div>
  );
}
