'use client';

/**
 * Pay part or all of a contribution's pending balance (contributions page and a member's
 * contribution history). Replaces components/chit-funds/PayContributionBalanceModal.tsx with
 * the same fields, checks, messages and body: `{ contributionId, amount, paidDate }`.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { errorMessage } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { Money } from '@/components/kit/money';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { todayIso } from './contribution-writes';

export interface PayBalanceTarget {
  id: number;
  month: number;
  amount: number;
  balance: number;
  paidDate: string;
}

export interface PayBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: PayBalanceTarget | null;
  memberName: string;
  /** Sends the payment; throw to keep the dialog open with the error. */
  onSubmit: (body: { contributionId: number; amount: number; paidDate: string }) => Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function PayBalanceDialog({ open, onOpenChange, contribution: current, memberName, onSubmit, returnFocusRef }: PayBalanceDialogProps) {
  // Keep showing the last contribution while the dialog animates closed (and returns focus).
  const last = React.useRef(current);
  if (current) last.current = current;
  const contribution = current ?? last.current;
  const formId = React.useId();
  const [amount, setAmount] = React.useState('');
  const [paidDate, setPaidDate] = React.useState(todayIso());
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !contribution) return;
    setAmount(String(contribution.balance));
    setPaidDate(todayIso());
    setError(null);
    setSubmitting(false);
    // Reset per opening and per contribution, not when a refetch brings a new object for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contribution?.id]);

  if (!contribution) return null;
  const originalPaidDay = new Date(contribution.paidDate).toISOString().split('T')[0];
  const enteredAmount = Number(amount);
  const remaining = Math.round((contribution.balance - enteredAmount) * 100) / 100;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!amount || isNaN(enteredAmount) || enteredAmount <= 0) return setError('Amount must be a positive number');
    if (enteredAmount > contribution.balance) return setError(`Amount cannot be more than the pending balance of ${formatMoney(contribution.balance)}`);
    if (!paidDate) return setError('Paid date is required');
    if (paidDate < originalPaidDay) return setError('Paid date cannot be before the original payment date');
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ contributionId: contribution.id, amount: enteredAmount, paidDate });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err) ?? 'Failed to record balance payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      returnFocusRef={returnFocusRef}
      title="Pay balance"
      description={`${memberName} · Month ${contribution.month}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitting ? 'Recording…' : 'Record payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border bg-elevated p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Member', value: memberName },
              { label: 'Month', value: `Month ${contribution.month}` },
              {
                label: 'Already paid',
                value: (
                  <span className="flex flex-col">
                    <Money value={contribution.amount} tone="plain" />
                    <span className="text-xs font-normal text-muted-foreground">
                      on <DateText value={contribution.paidDate} />
                    </span>
                  </span>
                ),
              },
              { label: 'Pending balance', value: <Money value={contribution.balance} tone="overdue" /> },
            ]}
          />
        </div>
        {/* noValidate: the checks below show their own messages */}
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <div className="flex items-start gap-2">
              <FormField label="Amount received" required nativeRequired={false} id="balanceAmount" className="min-w-0 flex-1">
                <Input
                  name="balanceAmount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={contribution.balance}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>
              <Button type="button" variant="outline" className="mt-[1.625rem] shrink-0" onClick={() => setAmount(String(contribution.balance))}>
                Full balance
              </Button>
            </div>
            {enteredAmount > 0 && remaining > 0 ? (
              <p className="mt-1.5 text-sm text-warning-text">This is a part payment. {formatMoney(remaining)} will stay pending.</p>
            ) : null}
          </div>
          <FormField label="Paid date" required nativeRequired={false} id="balancePaidDate">
            <Input name="balancePaidDate" type="date" min={originalPaidDay} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
          </FormField>
          {error ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </ResponsiveDialog>
  );
}

export default PayBalanceDialog;
