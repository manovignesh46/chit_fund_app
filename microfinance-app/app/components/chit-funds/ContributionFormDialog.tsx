'use client';

/**
 * "Record new contribution" form of a fund's contributions page, in a dialog.
 *
 * Fields, messages and the request body are the ones the page always had. The values live in
 * the page (they are kept between openings and reset after a save, as before); this dialog
 * only validates them. Body key order and values (see `contributionBody`):
 *   { memberId, month, amount, paidDate, balancePaymentDate, balancePaymentStatus,
 *     actualBalancePaymentDate, chitFundId, notes: null }
 * where balancePaymentStatus is "Pending" for a partial amount (below the monthly
 * contribution) and null otherwise: the status select is shown but has never been sent.
 */
import * as React from 'react';

import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { todayIso, type ContributionBody } from './contribution-writes';

export interface ContributionFormValues {
  memberId: string;
  month: string;
  amount: string;
  paidDate: string;
  balancePaymentDate: string;
  balancePaymentStatus: string;
  actualBalancePaymentDate: string;
}

export type ContributionFormErrors = Partial<Record<'memberId' | 'month' | 'amount' | 'paidDate', string>>;

export const emptyContributionForm = (amount = ''): ContributionFormValues => ({
  memberId: '',
  month: '',
  amount,
  paidDate: todayIso(),
  balancePaymentDate: '',
  balancePaymentStatus: 'Pending',
  actualBalancePaymentDate: '',
});

interface FundFigures {
  id: number;
  duration: number;
  monthlyContribution: number;
  firstMonthContribution: number | null;
}

export function validateContributionForm(v: ContributionFormValues, duration: number): ContributionFormErrors {
  const e: ContributionFormErrors = {};
  if (!v.memberId) e.memberId = 'Member is required';
  if (!v.month) e.month = 'Month is required';
  else if (isNaN(Number(v.month)) || Number(v.month) < 1 || Number(v.month) > (duration || 0)) e.month = `Month must be between 1 and ${duration || 0}`;
  if (!v.amount) e.amount = 'Amount is required';
  else if (isNaN(Number(v.amount)) || Number(v.amount) <= 0) e.amount = 'Amount must be a positive number';
  if (!v.paidDate) e.paidDate = 'Paid date is required';
  return e;
}

/** The request body, built exactly as the page always built it (same keys, order and values). */
export function contributionBody(v: ContributionFormValues, fund: FundFigures): ContributionBody {
  return {
    ...v,
    chitFundId: Number(fund.id),
    memberId: Number(v.memberId),
    month: Number(v.month),
    amount: Number(v.amount),
    balancePaymentDate: v.balancePaymentDate || null,
    balancePaymentStatus: fund && Number(v.amount) < fund.monthlyContribution ? 'Pending' : null,
    actualBalancePaymentDate: v.actualBalancePaymentDate || null,
    notes: null,
  } as unknown as ContributionBody;
}

const FIELD_ORDER: (keyof ContributionFormErrors)[] = ['memberId', 'month', 'amount', 'paidDate'];

export interface ContributionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: FundFigures;
  members: { id: number; name: string }[];
  values: ContributionFormValues;
  onValuesChange: (update: (prev: ContributionFormValues) => ContributionFormValues) => void;
  /** Shown above the buttons (the server's message after a failed save). */
  submitError?: string | null;
  /** Called with valid values; the page closes the dialog and saves optimistically. */
  onSubmit: (values: ContributionFormValues) => void;
  busy?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ContributionFormDialog({ open, onOpenChange, fund, members, values, onValuesChange, submitError, onSubmit, busy = false, returnFocusRef }: ContributionFormDialogProps) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [errors, setErrors] = React.useState<ContributionFormErrors>({});
  React.useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const set = (name: keyof ContributionFormValues, value: string) => {
    if (name === 'month') {
      // Choosing a month pre-fills its expected amount (month 1: the first-month figure).
      let amount = '';
      if (value === '1') amount = fund.firstMonthContribution?.toString() || '';
      else if (value) amount = fund.monthlyContribution?.toString() || '';
      onValuesChange((prev) => ({ ...prev, month: value, amount }));
    } else {
      onValuesChange((prev) => ({ ...prev, [name]: value }));
    }
  };

  const amount = Number(values.amount);
  const partial = amount > 0 && amount < fund.monthlyContribution;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateContributionForm(values, fund.duration);
    setErrors(found);
    const first = FIELD_ORDER.find((name) => found[name]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    onSubmit(values);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title="Record new contribution"
      description="Record a member's payment for a month of this chit fund."
      hideDescription
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={busy}>
            Record contribution
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField label="Member" required nativeRequired={false} id="memberId" error={errors.memberId}>
          <NativeSelect name="memberId" value={values.memberId} onValueChange={(v) => set('memberId', v)} placeholder="Select a member" options={members.map((m) => ({ value: String(m.id), label: m.name }))} />
        </FormField>
        <FormField label="Month" required nativeRequired={false} id="month" error={errors.month}>
          <NativeSelect
            name="month"
            value={values.month}
            onValueChange={(v) => set('month', v)}
            placeholder="Select a month"
            options={Array.from({ length: fund.duration }, (_, i) => ({ value: String(i + 1), label: `Month ${i + 1}` }))}
          />
        </FormField>
        <div>
          <div className="flex items-start gap-2">
            <FormField label="Amount" required nativeRequired={false} id="amount" error={errors.amount} className="min-w-0 flex-1">
              <Input name="amount" type="number" inputMode="decimal" value={values.amount} placeholder={fund.monthlyContribution.toString()} onChange={(e) => set('amount', e.target.value)} />
            </FormField>
            <Button type="button" variant="outline" className="mt-[1.625rem] shrink-0" onClick={() => set('amount', fund.monthlyContribution.toString())}>
              Full amount
            </Button>
          </div>
          {partial ? (
            <p data-partial-hint="" className="mt-1.5 text-sm text-warning-text">
              This is a partial payment. Balance of {formatMoney(fund.monthlyContribution - amount)} will be recorded.
            </p>
          ) : null}
        </div>
        <FormField label="Paid date" required nativeRequired={false} id="paidDate" error={errors.paidDate}>
          <Input name="paidDate" type="date" value={values.paidDate} onChange={(e) => set('paidDate', e.target.value)} />
        </FormField>
        {partial ? (
          <>
            <FormField label="Balance payment status" id="balancePaymentStatus">
              <NativeSelect
                name="balancePaymentStatus"
                value={values.balancePaymentStatus}
                onValueChange={(v) => set('balancePaymentStatus', v)}
                options={[
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Paid', label: 'Paid' },
                  { value: 'Overdue', label: 'Overdue' },
                ]}
              />
            </FormField>
            <FormField label="Expected payment date" id="balancePaymentDate" description="Date when the remaining balance is expected to be paid">
              <Input name="balancePaymentDate" type="date" value={values.balancePaymentDate} onChange={(e) => set('balancePaymentDate', e.target.value)} />
            </FormField>
            {values.balancePaymentStatus === 'Paid' ? (
              <FormField label="Actual payment date" id="actualBalancePaymentDate" description="Date when the balance was actually paid">
                <Input name="actualBalancePaymentDate" type="date" value={values.actualBalancePaymentDate} onChange={(e) => set('actualBalancePaymentDate', e.target.value)} />
              </FormField>
            ) : null}
          </>
        ) : null}
        {submitError ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {submitError}
          </p>
        ) : null}
      </form>
    </ResponsiveDialog>
  );
}

export default ContributionFormDialog;
