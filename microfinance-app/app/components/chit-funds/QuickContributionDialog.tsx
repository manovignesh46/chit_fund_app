'use client';

/**
 * The short "record contribution" form for one member and a known month (members page:
 * "Record contribution" for the first missed month; a member's history: "Record payment").
 * Amount, payment date and notes, with the messages each page always showed. Body:
 * `{ memberId, month, amount: parseFloat(amount), paidDate, notes: notes || null }`.
 * The page closes the dialog on submit and saves optimistically; on failure it reopens the
 * dialog with the same values and the server's message.
 */
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DescriptionList, type DescriptionItem } from '@/components/kit/description-list';
import { FormField } from '@/components/kit/form-field';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { todayIso, type ContributionBody } from './contribution-writes';

export interface QuickContributionValues {
  amount: string;
  paidDate: string;
  notes: string;
}

export const quickContributionValues = (amount: string): QuickContributionValues => ({ amount, paidDate: todayIso(), notes: '' });

export const quickContributionBody = (memberId: number, month: number, v: QuickContributionValues): ContributionBody => ({
  memberId,
  month,
  amount: parseFloat(v.amount),
  paidDate: v.paidDate,
  notes: v.notes || null,
});

export interface QuickContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Summary shown above the fields (member, month, expected amount). */
  info?: DescriptionItem[];
  values: QuickContributionValues;
  onValuesChange: (values: QuickContributionValues) => void;
  /** The message for a missing payment date (the two pages worded it differently). */
  dateMessage: string;
  submitError?: string | null;
  busy?: boolean;
  onSubmit: (values: QuickContributionValues) => void;
}

export function QuickContributionDialog({ open, onOpenChange, title, description, info, values, onValuesChange, dateMessage, submitError, busy = false, onSubmit }: QuickContributionDialogProps) {
  const formId = React.useId();
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const shownError = error ?? submitError ?? null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!values.amount || parseFloat(values.amount) <= 0) return setError('Please enter a valid amount');
    if (!values.paidDate) return setError(dateMessage);
    setError(null);
    onSubmit(values);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      hideDescription={!description}
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
      <div className="space-y-4">
        {info?.length ? (
          <div className="rounded-lg border bg-elevated p-4">
            <DescriptionList columns={2} items={info} />
          </div>
        ) : null}
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Amount" required nativeRequired={false} id="amount">
            <Input name="amount" type="number" inputMode="decimal" placeholder="Enter amount" value={values.amount} onChange={(e) => onValuesChange({ ...values, amount: e.target.value })} />
          </FormField>
          <FormField label="Payment date" required nativeRequired={false} id="paidDate">
            <Input name="paidDate" type="date" value={values.paidDate} onChange={(e) => onValuesChange({ ...values, paidDate: e.target.value })} />
          </FormField>
          <FormField label="Notes" id="notes">
            <Textarea name="notes" rows={3} placeholder="Optional notes about this contribution" value={values.notes} onChange={(e) => onValuesChange({ ...values, notes: e.target.value })} />
          </FormField>
          {shownError ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
              {shownError}
            </p>
          ) : null}
        </form>
      </div>
    </ResponsiveDialog>
  );
}

export default QuickContributionDialog;
