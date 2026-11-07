'use client';

/**
 * The auctions page's dialogs: "Record new auction" and the auction details.
 *
 * The form's fields, checks, messages and body are the ones the page always had. Body (key
 * order): { winnerId, month, amount, date, lowestBid?, highestBid?, numberOfBidders?, notes,
 * chitFundId } with empty bid fields left out (sent as undefined) and notes as typed ("").
 * Fixed funds: choosing a month fills the amount from the fund's fixed amounts, and the
 * amount is read-only once filled; the bid fields exist only for Auction-type funds.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList, type DescriptionItem } from '@/components/kit/description-list';
import { errorMessage } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import type { ChitFundAuction, ChitFundDetail } from '@/lib/query/chit-funds';
import { todayIso } from './contribution-writes';

export interface AuctionFormValues {
  winnerId: string;
  month: string;
  amount: string;
  date: string;
  lowestBid: string;
  highestBid: string;
  numberOfBidders: string;
  notes: string;
}

type Errors = Partial<Record<'winnerId' | 'month' | 'amount' | 'date' | 'submit', string>>;

export const emptyAuctionForm = (): AuctionFormValues => ({
  winnerId: '',
  month: '',
  amount: '',
  date: todayIso(),
  lowestBid: '',
  highestBid: '',
  numberOfBidders: '',
  notes: '',
});

/** The add-auction body, built exactly as the page always built it. */
export function auctionBody(v: AuctionFormValues, fundId: number): Record<string, unknown> {
  return {
    ...v,
    chitFundId: Number(fundId),
    winnerId: Number(v.winnerId),
    month: Number(v.month),
    amount: Number(v.amount),
    lowestBid: v.lowestBid ? Number(v.lowestBid) : undefined,
    highestBid: v.highestBid ? Number(v.highestBid) : undefined,
    numberOfBidders: v.numberOfBidders ? Number(v.numberOfBidders) : undefined,
  };
}

export interface AuctionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: Pick<ChitFundDetail, 'id' | 'duration' | 'totalAmount' | 'chitFundType' | 'fixedAmounts'>;
  eligibleMembers: { id: number; name: string }[];
  auctions: ChitFundAuction[];
  /** Saves; throw to keep the dialog open with the message. */
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function AuctionFormDialog({ open, onOpenChange, fund, eligibleMembers, auctions, onSubmit, returnFocusRef }: AuctionFormDialogProps) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [values, setValues] = React.useState<AuctionFormValues>(emptyAuctionForm);
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const isFixed = fund.chitFundType === 'Fixed';
  const set = (name: keyof AuctionFormValues, value: string) => {
    if (name === 'month' && isFixed && fund.fixedAmounts && value) {
      const fixed = fund.fixedAmounts.find((fa) => fa.month === parseInt(value));
      setValues((prev) => ({ ...prev, month: value, amount: fixed ? fixed.amount.toString() : '' }));
    } else {
      setValues((prev) => ({ ...prev, [name]: value }));
    }
  };
  const amountLocked = isFixed && !!values.month && !!values.amount;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found: Errors = {};
    if (!values.winnerId) found.winnerId = 'Winner is required';
    if (!values.month) found.month = 'Month is required';
    else if (isNaN(Number(values.month)) || Number(values.month) < 1 || Number(values.month) > (fund.duration || 0)) found.month = `Month must be between 1 and ${fund.duration || 0}`;
    if (!values.amount) found.amount = 'Amount is required';
    else if (isNaN(Number(values.amount)) || Number(values.amount) <= 0) found.amount = 'Amount must be a positive number';
    if (!values.date) found.date = 'Auction date is required';
    setErrors(found);
    const first = (['winnerId', 'month', 'amount', 'date'] as const).find((n) => found[n]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(auctionBody(values, fund.id));
      setValues(emptyAuctionForm());
      onOpenChange(false);
    } catch (error) {
      const reason = errorMessage(error);
      setErrors({ submit: `Failed to add auction. Please try again.${reason ? ` (${reason})` : ''}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      returnFocusRef={returnFocusRef}
      title="Record new auction"
      description={isFixed ? 'Fixed amounts per month: the amount comes from the fund.' : 'Record the winner and the amount paid out.'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitting ? 'Recording…' : 'Record auction'}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField label="Winner" required nativeRequired={false} id="winnerId" error={errors.winnerId}>
          <NativeSelect
            name="winnerId"
            value={values.winnerId}
            onValueChange={(v) => set('winnerId', v)}
            placeholder={eligibleMembers.length > 0 ? 'Select a member' : 'No eligible members (all have won)'}
            options={eligibleMembers.map((m) => ({ value: String(m.id), label: m.name }))}
          />
        </FormField>
        <FormField label="Month" required nativeRequired={false} id="month" error={errors.month}>
          <NativeSelect name="month" value={values.month} onValueChange={(v) => set('month', v)} placeholder="Select a month">
            {Array.from({ length: fund.duration }, (_, i) => i + 1).map((month) => {
              const existing = auctions.filter((a) => a.month === month).length;
              return (
                <option key={month} value={month}>
                  Month {month} {existing > 0 ? `(${existing} existing)` : ''}
                </option>
              );
            })}
          </NativeSelect>
        </FormField>
        <FormField
          label={
            <>
              Auction amount
              {isFixed && values.month ? <span className="ml-2 text-xs font-normal text-primary-text">(Auto-populated from fixed amount)</span> : null}
            </>
          }
          required
          nativeRequired={false}
          id="amount"
          error={errors.amount}
          description={amountLocked ? `This amount is predefined for Month ${values.month} in this Fixed type chit fund.` : undefined}
        >
          <Input
            name="amount"
            type="number"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder={fund.totalAmount.toString()}
            readOnly={amountLocked}
            className={amountLocked ? 'cursor-not-allowed bg-muted' : undefined}
          />
        </FormField>
        <FormField label="Auction date" required nativeRequired={false} id="date" error={errors.date}>
          <Input name="date" type="date" value={values.date} onChange={(e) => set('date', e.target.value)} />
        </FormField>
        {fund.chitFundType === 'Auction' ? (
          <fieldset className="space-y-4 border-t pt-4">
            <legend className="pt-2 text-sm font-semibold text-foreground">Auction details</legend>
            <FormField label="Lowest bid amount" id="lowestBid">
              <Input name="lowestBid" type="number" inputMode="decimal" value={values.lowestBid} onChange={(e) => set('lowestBid', e.target.value)} placeholder="Lowest bid in the auction" />
            </FormField>
            <FormField label="Highest bid amount" id="highestBid">
              <Input name="highestBid" type="number" inputMode="decimal" value={values.highestBid} onChange={(e) => set('highestBid', e.target.value)} placeholder="Highest bid in the auction" />
            </FormField>
            <FormField label="Number of bidders" id="numberOfBidders">
              <Input name="numberOfBidders" type="number" inputMode="numeric" value={values.numberOfBidders} onChange={(e) => set('numberOfBidders', e.target.value)} placeholder="How many members participated in bidding" />
            </FormField>
          </fieldset>
        ) : null}
        <FormField label="Auction notes" id="notes">
          <Textarea name="notes" rows={3} value={values.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional notes about the auction process" />
        </FormField>
        {errors.submit ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {errors.submit}
          </p>
        ) : null}
      </form>
    </ResponsiveDialog>
  );
}

/** Discount = total − auction amount, with its share of the total (as the page showed it). */
export function Discount({ total, amount }: { total: number; amount: number }) {
  return (
    <span className="whitespace-nowrap text-success-text">
      <Money value={total - amount} tone="plain" className="text-success-text" /> ({Math.round((1 - amount / total) * 100)}%)
    </span>
  );
}

export function AuctionDetailsDialog({ open, auction, totalAmount, onOpenChange }: { open: boolean; auction: ChitFundAuction | null; totalAmount: number; onOpenChange: (open: boolean) => void }) {
  if (!auction) return null;
  const extra: DescriptionItem[] = [
    ...(auction.numberOfBidders ? [{ label: 'Number of bidders', value: String(auction.numberOfBidders) }] : []),
    ...(auction.lowestBid ? [{ label: 'Lowest bid', value: <Money value={auction.lowestBid} tone="plain" /> }] : []),
    ...(auction.highestBid ? [{ label: 'Highest bid', value: <Money value={auction.highestBid} tone="plain" /> }] : []),
    ...(auction.notes ? [{ label: 'Notes', value: <span className="whitespace-pre-line">{auction.notes}</span>, full: true }] : []),
  ];
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Auction details"
      description={`Month ${auction.month}`}
      hideDescription
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border bg-elevated p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Month', value: <span className="font-semibold">Month {auction.month}</span> },
              { label: 'Winner', value: <span className="font-semibold">{auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`}</span> },
            ]}
          />
        </div>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Auction information</h3>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Amount', value: <Money value={auction.amount} tone="plain" className="font-semibold" /> },
              { label: 'Date', value: <DateText value={auction.date} /> },
              { label: 'Discount', value: <Discount total={totalAmount} amount={auction.amount} /> },
            ]}
          />
        </section>
        {extra.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Additional details</h3>
            <DescriptionList columns={2} items={extra} />
          </section>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

export default AuctionFormDialog;
