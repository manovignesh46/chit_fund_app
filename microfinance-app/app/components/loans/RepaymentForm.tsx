'use client';

/**
 * Record a loan repayment. Used on the loan detail page (Record Payment tab) and on
 * /loans/[id]/repayments/new. The parent sends the write (`onSubmit`): the detail page
 * shows the payment optimistically, the standalone page navigates afterwards.
 *
 * Kept from before Phase 4: the request body, the prefill rules (first unpaid period by
 * due date; interest amount for Reducing Balance or Interest Only), the Interest Only
 * toggle (Monthly and Reducing Balance loans) and the validation messages.
 * Submitting is disabled while a request is pending and is never retried automatically
 * (POST add-repayment is not idempotent).
 */
import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { usePartner } from '@/app/contexts/PartnerContext';
import { formatDate, formatMoney } from '@/lib/format';
import { useLoan, useLoanSchedules, type AddRepaymentBody, type LoanRecord, type LoanSchedule } from '@/lib/query/loans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/kit/date-input';
import { errorMessage } from '@/components/kit/error-state';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { SectionCard } from '@/components/kit/section-card';

type PaymentType = 'REGULAR' | 'INTEREST_ONLY';

interface FormState {
  amount: string;
  paidDate: string;
  paymentType: PaymentType;
  scheduleId: string;
  notes: string;
}

interface FormErrors {
  amount?: string;
  paidDate?: string;
  scheduleId?: string;
  general?: string;
}

export interface RepaymentFormProps {
  loanId: number;
  /** The loan when the parent already has it (detail page); otherwise it is loaded. */
  initialLoan?: LoanRecord | null;
  /**
   * Send the repayment. Resolve on success (the form then resets); throw to keep the
   * entered values (the error is shown in the form).
   */
  onSubmit: (body: AddRepaymentBody, schedule: LoanSchedule | undefined) => Promise<void>;
  onCancel?: () => void;
  /** Disable submitting (e.g. while another payment for this loan is being saved). */
  busy?: boolean;
  /** Render without the card (when the parent provides the frame). */
  bare?: boolean;
}

const isUnpaid = (s: LoanSchedule) => s.status !== 'PAID' && s.status !== 'COMPLETED' && s.status !== 'Interest Only' && s.status !== 'Paid';
const today = () => new Date().toISOString().split('T')[0];

export default function RepaymentForm({ loanId, initialLoan, onSubmit, onCancel, busy = false, bare = false }: RepaymentFormProps) {
  const { selectedPartner } = usePartner();
  const loanQuery = useLoan(initialLoan ? null : loanId);
  const loan = initialLoan ?? loanQuery.data ?? null;
  const schedulesQuery = useLoanSchedules(loanId, true);

  const pending = React.useMemo(() => [...schedulesQuery.schedules].sort((a, b) => a.period - b.period), [schedulesQuery.schedules]);
  const unpaid = React.useMemo(() => pending.filter(isUnpaid), [pending]);

  const [form, setForm] = React.useState<FormState>(() => ({ amount: '', paidDate: today(), paymentType: 'REGULAR', scheduleId: '', notes: '' }));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const submittingRef = React.useRef(false);

  // Preselect the first unpaid period (by due date) whenever nothing valid is selected.
  React.useEffect(() => {
    if (unpaid.length === 0) return;
    if (form.scheduleId && unpaid.some((s) => s.id.toString() === form.scheduleId)) return;
    const next = [...unpaid].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    setForm((prev) => ({ ...prev, scheduleId: next.id.toString() }));
  }, [unpaid, form.scheduleId]);

  // Prefill the amount from the selected period, the Interest Only toggle and the loan type.
  const prefillKey = `${form.scheduleId}|${form.paymentType}|${loan?.loanType ?? ''}|${pending.length > 0}`;
  React.useEffect(() => {
    if (!form.scheduleId || pending.length === 0) return;
    const schedule = pending.find((s) => s.id.toString() === form.scheduleId);
    if (!schedule) return;
    const useInterestOnly = loan?.loanType === 'Reducing Balance' || form.paymentType === 'INTEREST_ONLY';
    const amount = useInterestOnly ? schedule.interestAmount : schedule.amount;
    setForm((prev) => ({ ...prev, amount: amount != null ? amount.toString() : prev.amount }));
    // Only when the selection changes, not on every background refresh of the schedule list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const set = (name: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [name]: value }));

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.amount) next.amount = 'Payment amount is required';
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) next.amount = 'Please enter a valid amount';
    if (!form.paidDate) next.paidDate = 'Payment date is required';
    if (!form.scheduleId) next.scheduleId = 'Please select a payment schedule';
    if (!selectedPartner || !selectedPartner.id) next.general = 'Please select a partner from the top dropdown first';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    if (!validate() || !selectedPartner) return;
    submittingRef.current = true;
    setSubmitting(true);
    const body: AddRepaymentBody = {
      amount: parseFloat(form.amount),
      paidDate: form.paidDate,
      paymentType: form.paymentType,
      scheduleId: parseInt(form.scheduleId),
      collected_by_id: parseInt(String(selectedPartner.id)),
      collected_by: selectedPartner.id.toString(),
      entered_by_id: selectedPartner.id,
      notes: form.notes?.trim() || undefined,
    };
    try {
      await onSubmit(body, pending.find((s) => s.id === body.scheduleId));
      setForm((prev) => ({ ...prev, amount: '', notes: '', scheduleId: '' }));
      setErrors({});
    } catch (error) {
      setErrors({ general: errorMessage(error) ?? 'Failed to record payment' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const frame = (children: React.ReactNode) => (bare ? <>{children}</> : <SectionCard title="Record payment">{children}</SectionCard>);

  if (!loan) {
    return frame(
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Loading form…</span>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (loan.status === 'Non-Recoverable') {
    return frame(
      <p className="text-sm text-foreground">
        This loan is Non-Recoverable.{' '}
        <Link className="font-medium text-primary-text underline" href={`/loans/${loanId}#loan-recovery`}>
          Record an offline recovery on Loan Details.
        </Link>
      </p>
    );
  }

  const showInterestToggle = loan.loanType === 'Monthly' || loan.loanType === 'Reducing Balance';
  const scheduleOptions = unpaid.map((s) => ({
    value: s.id.toString(),
    label: `${loan.repaymentType === 'Weekly' ? `Week ${s.period}` : `Month ${s.period}`} - Due: ${formatDate(s.dueDate)}${
      loan.loanType === 'Reducing Balance' ? ` (Interest: ${formatMoney(s.interestAmount)})` : ` - ${formatMoney(s.amount)}`
    }`,
  }));
  const disabled = submitting || busy;

  return frame(
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting || undefined}>
      {errors.general ? (
        <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
          {errors.general}
        </p>
      ) : null}

      {showInterestToggle ? (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-elevated p-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">Interest only payment</span>
            <span className="block text-xs text-muted-foreground">No principal reduction</span>
          </span>
          <Switch
            checked={form.paymentType === 'INTEREST_ONLY'}
            onCheckedChange={(checked) => set('paymentType', checked ? 'INTEREST_ONLY' : 'REGULAR')}
            aria-label="Interest only payment"
            disabled={disabled}
          />
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
        <FormField label="Amount (₹)" required nativeRequired={false} id="repayment-amount" error={errors.amount}>
          <Input type="number" inputMode="decimal" name="amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </FormField>
        <FormField label="Date" required nativeRequired={false} id="repayment-date" error={errors.paidDate}>
          <DateInput name="paidDate" value={form.paidDate} onValueChange={(v) => set('paidDate', v)} />
        </FormField>
        <FormField label="Payment schedule" required nativeRequired={false} id="repayment-schedule" error={errors.scheduleId} className="md:col-span-2">
          <NativeSelect
            name="scheduleId"
            value={form.scheduleId}
            onValueChange={(v) => set('scheduleId', v)}
            placeholder={schedulesQuery.isLoading ? 'Loading schedules…' : '-- Select Schedule --'}
            options={scheduleOptions}
          />
        </FormField>
        <FormField label="Notes" id="repayment-notes" className="md:col-span-2">
          <Textarea name="notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Add any additional notes..." />
        </FormField>
      </div>

      <FormActions>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
          {submitting ? 'Recording…' : 'Record payment'}
        </Button>
      </FormActions>
    </form>
  );
}
