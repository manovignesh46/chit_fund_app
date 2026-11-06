'use client';

/**
 * Recording loan repayments, shared by the loan detail page and the payment schedules page:
 * the optimistic "Saving" row, the quick "Mark Paid" / "Interest Only" actions and the
 * schedule table.
 *
 * Money figures computed by the server (remaining, overdue, interest split, profit) are
 * never computed here: while a payment is saving they show an updating state and are
 * replaced by the server's values once the loan has been refetched.
 */
import * as React from 'react';
import Link from 'next/link';
import { toast } from '@/lib/toast';
import { Check, Eye, Loader2, Percent } from 'lucide-react';

import { usePartner } from '@/app/contexts/PartnerContext';
import { formatMoney } from '@/lib/format';
import { invalidateLoan, loanWrites, type AddRepaymentBody, type LoanRecord, type LoanSchedule } from '@/lib/query/loans';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { errorMessage } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { StatusBadge } from '@/components/kit/status-badge';
import { cn } from '@/lib/utils';

export interface PendingPayment {
  period: number;
  amount: number;
  paidDate: string;
  paymentType: string;
  dueDate?: string;
}

export interface ScheduleRow extends LoanSchedule {
  saving?: boolean;
}

/**
 * Send one repayment for a loan with an optimistic pending row.
 * - One payment at a time; never retried automatically (add-repayment is not idempotent).
 * - On success: refetch the loan's queries (server totals), then drop the pending row.
 * - On failure: drop the pending row, toast, and rethrow so the caller can reopen its form.
 */
export function useRecordPayment(loan: LoanRecord | undefined) {
  const [pending, setPending] = React.useState<PendingPayment | null>(null);
  const inFlight = React.useRef(false);
  const loanRef = React.useRef(loan);
  loanRef.current = loan;

  const record = React.useCallback(async (body: AddRepaymentBody, dueDate?: string) => {
    const current = loanRef.current;
    if (!current) throw new Error('The loan is still loading.');
    if (inFlight.current) throw new Error('A payment for this loan is already being saved.');
    inFlight.current = true;
    setPending({ period: body.scheduleId, amount: body.amount, paidDate: body.paidDate, paymentType: body.paymentType, dueDate });
    let response: { loan?: unknown };
    try {
      response = await loanWrites.addRepayment(current.id, body);
    } catch (error) {
      setPending(null);
      inFlight.current = false;
      toast.error('Payment not recorded', { description: errorMessage(error) ?? 'Failed to record payment' });
      throw error;
    }
    try {
      await invalidateLoan(current.id, current.borrowerId);
    } finally {
      setPending(null);
      inFlight.current = false;
    }
    if (response && response.loan) {
      toast.success('Payment recorded', { description: `${formatMoney(body.amount)} · ${current.repaymentType === 'Weekly' ? 'Week' : 'Month'} ${body.scheduleId}` });
    } else {
      // A 2xx without the usual body: the repayment was most likely saved. Do not invite a retry.
      toast.warning('Payment sent, but the server reply was unexpected', { description: 'Check the schedule before recording it again.' });
    }
  }, []);

  return { pending, record, saving: pending !== null };
}

/** The schedule rows with the pending payment applied (or inserted in due-date order). */
export function withPending(rows: LoanSchedule[], pending: PendingPayment | null): ScheduleRow[] {
  if (!pending) return rows;
  const optimistic = { status: 'Saving', paidAmount: pending.amount, paidDate: pending.paidDate, saving: true };
  const index = rows.findIndex((r) => r.period === pending.period);
  if (index >= 0) return rows.map((r, i) => (i === index ? { ...r, ...optimistic } : r));
  const inserted: ScheduleRow = { id: -pending.period, period: pending.period, dueDate: pending.dueDate ?? '', amount: pending.amount, ...optimistic };
  return [...rows, inserted].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
}

const startOfDay = (value: string | Date) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Display rules for a schedule row (unchanged from the detail page before Phase 4). */
export function scheduleState(schedule: ScheduleRow, loan: LoanRecord) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const due = startOfDay(schedule.dueDate);
  const grace = new Date(due);
  grace.setDate(grace.getDate() + 3);
  const isDueTomorrow = due.getTime() === tomorrow.getTime();
  const isOverdue = due < today && today >= grace && (schedule.status === 'Pending' || schedule.status === 'Overdue') && loan.status !== 'Completed';
  const isSettled = loan.status === 'Completed' && !['Paid', 'Interest Only', 'InterestOnly'].includes(schedule.status) && !schedule.saving;
  const label = schedule.saving ? 'Saving' : isSettled ? 'Settled' : isOverdue ? 'Overdue' : schedule.status;
  const canQuickPay =
    !schedule.saving && (schedule.status === 'Pending' || schedule.status === 'Missed') && !isSettled && loan.status !== 'Non-Recoverable' && loan.loanType !== 'Reducing Balance';
  return { label, isOverdue, isDueTomorrow, isSettled, canQuickPay, canInterestOnly: canQuickPay && loan.repaymentType === 'Monthly' };
}

/** Quick "Mark Paid" / "Interest Only" from a schedule row: same checks and body as before. */
export function useQuickPay(loan: LoanRecord | undefined, record: (body: AddRepaymentBody, dueDate?: string) => Promise<void>) {
  const { selectedPartner, loading: partnerLoading } = usePartner();
  return React.useCallback(
    async (schedule: LoanSchedule, kind: 'Paid' | 'InterestOnly') => {
      if (partnerLoading) return void toast.error('Please wait while we load partner information...');
      if (!selectedPartner) {
        return void toast.error('Please select a valid partner from the top dropdown menu first. Your payment will be recorded under their name.');
      }
      if (!selectedPartner.id || !selectedPartner.name || !selectedPartner.isActive) {
        return void toast.error('Selected partner appears to be invalid. Please try selecting again or refresh the page.');
      }
      if (!loan || isNaN(schedule.period) || schedule.period <= 0) return void toast.error('Invalid payment period. Please try again.');
      const body: AddRepaymentBody = {
        amount: (kind === 'InterestOnly' ? schedule.interestAmount : schedule.amount) as number,
        paidDate: new Date().toISOString(),
        paymentType: kind === 'InterestOnly' ? 'INTEREST_ONLY' : 'REGULAR',
        scheduleId: schedule.period,
        collected_by_id: selectedPartner.id,
        collected_by: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id,
      };
      try {
        await record(body, schedule.dueDate);
      } catch {
        /* reported by useRecordPayment */
      }
    },
    [loan, partnerLoading, selectedPartner, record]
  );
}

/** "Updating…" marker for a server-computed figure while a write is being confirmed. */
export function Updating({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-flex items-center gap-2', className)} aria-busy={active || undefined}>
      <span className={cn('transition-opacity', active && 'opacity-40')}>{children}</span>
      {active ? (
        <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
          Updating…
        </span>
      ) : null}
    </span>
  );
}

const periodLabel = (loan: LoanRecord, period: number) => (loan.repaymentType === 'Weekly' ? `Week ${period}` : `Month ${period}`);

export interface ScheduleTableProps {
  loan: LoanRecord;
  rows: ScheduleRow[];
  isInitialLoading?: boolean;
  isRefreshing?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Quick actions are disabled while a payment is saving or the rows are being refreshed. */
  actionsDisabled?: boolean;
  onQuickPay: (schedule: LoanSchedule, kind: 'Paid' | 'InterestOnly') => void;
  emptyState?: React.ReactNode;
  label?: string;
}

export function ScheduleTable({ loan, rows, isInitialLoading, isRefreshing, error, onRetry, actionsDisabled, onQuickPay, emptyState, label = 'Payment schedule' }: ScheduleTableProps) {
  const amountOf = (s: ScheduleRow) => (s.paidAmount !== null && s.paidAmount !== undefined ? s.paidAmount : s.amount > 0 ? s.amount : s.interestAmount || 0);
  const statusCell = (s: ScheduleRow) => {
    const state = scheduleState(s, loan);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={state.label} />
        {state.isDueTomorrow && !s.saving ? <StatusBadge status="Due Tomorrow" /> : null}
      </div>
    );
  };
  const actionsCell = (s: ScheduleRow) => {
    const state = scheduleState(s, loan);
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {state.canQuickPay ? (
          <>
            <Button size="sm" variant="outline" disabled={actionsDisabled} onClick={() => onQuickPay(s, 'Paid')}>
              <Check aria-hidden="true" />
              Mark Paid
            </Button>
            {state.canInterestOnly ? (
              <Button size="sm" variant="outline" disabled={actionsDisabled} onClick={() => onQuickPay(s, 'InterestOnly')}>
                <Percent aria-hidden="true" />
                Interest Only
              </Button>
            ) : null}
          </>
        ) : null}
        {s.isPaid && !s.saving && s.status !== 'Recovery Credit' ? (
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/loans/${loan.id}/repayments`}>
              <Eye aria-hidden="true" />
              View payment
            </Link>
          </Button>
        ) : null}
      </div>
    );
  };

  const columns: DataTableColumn<ScheduleRow>[] = [
    { id: 'period', header: 'Period', cell: (s) => <span className="whitespace-nowrap">{periodLabel(loan, s.period)}</span> },
    { id: 'dueDate', header: 'Due date', cell: (s) => <DateText value={s.dueDate} /> },
    { id: 'paidDate', header: 'Payment date', cell: (s) => <DateText value={s.paidDate} fallback="—" /> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (s) => <Money value={amountOf(s)} tone="plain" /> },
    { id: 'status', header: 'Status', cell: statusCell },
    ...(loan.loanType !== 'Reducing Balance'
      ? [{ id: 'actions', header: <span className="sr-only">Actions</span>, align: 'right' as const, cell: actionsCell }]
      : []),
  ];

  return (
    <DataTable<ScheduleRow>
      label={label}
      mode="client"
      columns={columns}
      rows={rows}
      getRowId={(s) => s.id}
      isInitialLoading={isInitialLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      skeletonRows={6}
      rowClassName={(s) => {
        if (s.saving) return 'bg-info-subtle/60';
        const state = scheduleState(s, loan);
        return state.isOverdue ? 'bg-destructive-subtle/50' : state.isDueTomorrow ? 'bg-warning-subtle/60' : undefined;
      }}
      renderCard={(s) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{periodLabel(loan, s.period)}</p>
              <p className="text-xs text-muted-foreground">
                Due <DateText value={s.dueDate} />
                {s.paidDate ? (
                  <>
                    {' '}· Paid <DateText value={s.paidDate} />
                  </>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <Money value={amountOf(s)} tone="plain" className="font-medium" />
              <div className="mt-1">{statusCell(s)}</div>
            </div>
          </div>
          {loan.loanType !== 'Reducing Balance' ? actionsCell(s) : null}
        </div>
      )}
    />
  );
}
