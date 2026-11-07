'use client';

/**
 * How a recorded chit contribution is shown (contributions page and a member's history):
 * the balance cell, the details dialog and the "has a pending balance" rule. Every figure
 * here comes from the server (amount, balance, balance status and dates).
 */
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList, type DescriptionItem } from '@/components/kit/description-list';
import { Money } from '@/components/kit/money';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { StatusBadge } from '@/components/kit/status-badge';
import { Updating } from '@/components/kit/updating';

export interface ShownContribution {
  id: number;
  month: number;
  amount: number;
  paidDate: string;
  balance: number;
  balancePaymentStatus: string | null;
  balancePaymentDate: string | null;
  actualBalancePaymentDate: string | null;
}

/** A part-paid contribution whose balance has not been settled yet. */
export const hasPendingBalance = (c: Pick<ShownContribution, 'balance' | 'balancePaymentStatus'> | null | undefined) =>
  !!c && c.balance > 0 && c.balancePaymentStatus !== 'Paid';

/** Balance pill: Paid (green), Overdue (red), anything else amber with its own text ("Pending"). */
export function BalanceStatusBadge({ status }: { status: string | null }) {
  if (status === 'Paid') return <StatusBadge status="Paid" />;
  if (status === 'Overdue') return <StatusBadge status="Overdue" />;
  return <StatusBadge status="Partial" label={status || 'Pending'} />;
}

/** The Balance column of the contributions page (unchanged rules). */
export function BalanceCell({ c, updating = false }: { c: ShownContribution; updating?: boolean }) {
  const body =
    c.balance > 0 || c.balancePaymentStatus === 'Paid' ? (
      <div className="space-y-1">
        {c.balancePaymentStatus === 'Paid' ? (
          <p className="text-sm font-semibold text-success-text">Paid in full</p>
        ) : (
          <Money value={c.balance} tone="overdue" className="font-semibold" />
        )}
        <div>
          <BalanceStatusBadge status={c.balancePaymentStatus} />
        </div>
        {c.balancePaymentDate ? (
          <p className="text-xs text-muted-foreground">
            Expected payment: <DateText value={c.balancePaymentDate} />
          </p>
        ) : null}
        {c.actualBalancePaymentDate ? (
          <p className="text-xs text-success-text">
            Paid on: <DateText value={c.actualBalancePaymentDate} />
          </p>
        ) : null}
      </div>
    ) : (
      <p className="text-sm font-semibold text-success-text">Paid in full</p>
    );
  return updating ? <Updating active>{body}</Updating> : body;
}

export interface ContributionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: ShownContribution | null;
  memberName: string;
  /**
   * The status text: 'plain' = the stored status or "Pending" (contributions page);
   * 'member' = "Partial Payment" while pending with a balance, else the status or "Paid in full"
   * (a member's history page). Both as before.
   */
  statusText?: 'plain' | 'member';
  /** Offered when the balance is still pending. */
  onPayBalance?: (c: ShownContribution) => void;
  updating?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ContributionDetailsDialog({ open, onOpenChange, contribution, memberName, statusText = 'plain', onPayBalance, updating = false, returnFocusRef }: ContributionDetailsDialogProps) {
  // Keep showing the last contribution while the dialog animates closed (and returns focus).
  const last = React.useRef(contribution);
  if (contribution) last.current = contribution;
  const c = contribution ?? last.current;
  if (!c) return null;
  const showBalance = c.balance > 0 || c.balancePaymentStatus === 'Paid';
  const status =
    statusText === 'member'
      ? c.balancePaymentStatus === 'Pending' && c.balance > 0
        ? 'Partial Payment'
        : c.balancePaymentStatus || 'Paid in full'
      : c.balancePaymentStatus || 'Pending';
  const statusTone = c.balancePaymentStatus === 'Paid' ? 'text-success-text' : c.balancePaymentStatus === 'Overdue' ? 'text-destructive-text' : 'text-warning-text';
  const balanceItems: DescriptionItem[] = [
    {
      label: 'Balance amount',
      value: c.balancePaymentStatus === 'Paid' ? <span className="font-semibold text-success-text">Paid in full</span> : <Money value={c.balance} tone="overdue" className="font-semibold" />,
    },
    { label: 'Status', value: <span className={`font-semibold ${statusTone}`}>{status}</span> },
    ...(c.balancePaymentDate ? [{ label: 'Expected payment date', value: <DateText value={c.balancePaymentDate} />, full: true }] : []),
    ...(c.actualBalancePaymentDate ? [{ label: 'Actual payment date', value: <DateText value={c.actualBalancePaymentDate} className="text-success-text" />, full: true }] : []),
  ];
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title="Contribution details"
      description={`${memberName} · Month ${c.month}`}
      hideDescription
      footer={
        <>
          {hasPendingBalance(c) && onPayBalance ? (
            <Button type="button" onClick={() => onPayBalance(c)} disabled={updating}>
              Pay balance
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </>
      }
    >
      <div className={updating ? 'space-y-5 opacity-60' : 'space-y-5'} aria-busy={updating || undefined}>
        <div className="rounded-lg border bg-elevated p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Member', value: <span className="font-semibold">{memberName}</span> },
              { label: 'Month', value: <span className="font-semibold">Month {c.month}</span> },
            ]}
          />
        </div>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Payment information</h3>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Amount paid', value: <Money value={c.amount} tone="plain" className="font-semibold" /> },
              { label: 'Payment date', value: <DateText value={c.paidDate} /> },
            ]}
          />
        </section>
        {showBalance ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Balance information</h3>
            <DescriptionList columns={2} items={balanceItems} />
          </section>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
