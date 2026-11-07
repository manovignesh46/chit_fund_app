'use client';

/**
 * One loan / chit membership with its unpaid periods and follow-up actions (call, WhatsApp
 * reminder, record payment). Used by the Dues Tracker and the member page's Dues tab.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, MessageCircle, Phone } from 'lucide-react';

import { periodLabel, type DueAccount, type DueKind, type DuePeriod, type DuePeriodStatus } from '@/lib/query/dues';
import { Button } from '@/components/ui/button';
import { DateText } from '@/components/kit/date-text';
import { Money } from '@/components/kit/money';
import { STATUS_CLASSES } from '@/components/kit/status';
import { cn } from '@/lib/utils';

export type Kind = DueKind;
export type Status = DuePeriodStatus;
export type { DueAccount, DuePeriod };
export { periodLabel };

/** Amount and date formats used in the WhatsApp reminder text (unchanged wording). */
export const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
export const fmt = (n: number) => inr.format(n);
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const pill = 'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium leading-none';

function OverdueBadge({ account }: { account: DueAccount }) {
  if (account.maxDaysOverdue > 0) {
    const d = account.maxDaysOverdue;
    // Older debt reads stronger: 1–30 amber, 31–60 amber strong, 61–90 red soft, 90+ red solid.
    const cls =
      d > 90
        ? STATUS_CLASSES.destructive.solid
        : d > 60
          ? STATUS_CLASSES.destructive.soft
          : d > 30
            ? STATUS_CLASSES.warning.solid
            : STATUS_CLASSES.warning.soft;
    return (
      <span className={cn(pill, cls)}>
        {d} day{d === 1 ? '' : 's'} overdue
      </span>
    );
  }
  const next = account.periods[0];
  if (next?.status === 'due-today') return <span className={cn(pill, STATUS_CLASSES.warning.soft)}>Due today</span>;
  return (
    <span className={cn(pill, STATUS_CLASSES.neutral.outline)}>
      Due {next ? <DateText value={next.dueDate} /> : null}
    </span>
  );
}

export function whatsappLink(account: DueAccount) {
  const digits = (account.contact || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const lines = account.periods.map(
    (p) => `• ${periodLabel(account.kind, account.frequency, p.period)} (due ${fmtDate(p.dueDate)}): ${fmt(p.outstanding)}`
  );
  const text = [
    `Hello ${account.memberName},`,
    `This is a reminder for your ${account.kind === 'loan' ? 'loan' : 'chit fund'} payment — ${account.entityName}.`,
    ...lines,
    `Total due: ${fmt(account.totalOutstanding)}`,
    'Thank you.',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function periodStatus(p: DuePeriod) {
  if (p.status === 'overdue') return <span className="font-medium text-destructive-text">{p.daysOverdue}d late</span>;
  if (p.status === 'due-today') return <span className="font-medium text-warning-text">Today</span>;
  return <span className="text-muted-foreground">Upcoming</span>;
}

interface Props {
  account: DueAccount;
  /** Show the member name as the heading (Dues Tracker); false on a member's own page. */
  showMember?: boolean;
  defaultOpen?: boolean;
}

export default function DueAccountCard({ account: a, showMember = true, defaultOpen = false }: Props) {
  const [isOpen, setOpen] = useState(defaultOpen);
  const wa = whatsappLink(a);
  const panelId = `due-${a.key}`;
  const iconButton = 'h-11 w-11 md:h-9 md:w-9';
  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border border-l-4 bg-card text-card-foreground shadow-sm',
        a.overdueAmount > 0 ? 'border-l-destructive' : 'border-l-primary/60'
      )}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <button
          type="button"
          className="group min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground group-hover:underline">{showMember ? a.memberName : a.entityName}</span>
            <span className={cn(pill, 'h-5 rounded-md px-1.5 text-[11px] uppercase tracking-wide', STATUS_CLASSES.neutral.soft)}>
              {a.kind === 'loan' ? 'Loan' : 'Chit'}
            </span>
            <OverdueBadge account={a} />
            <ChevronDown aria-hidden="true" className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {showMember ? `${a.entityName} · ` : ''}
            {a.periods.length} {a.periods.length === 1 ? 'payment' : 'payments'} pending
            {a.oldestDueDate ? (
              <>
                {' · since '}
                <DateText value={a.oldestDueDate} />
              </>
            ) : null}
          </p>
        </button>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-right">
            <p className="text-lg font-semibold">
              <Money value={a.totalOutstanding} tone="plain" />
            </p>
            {a.overdueAmount > 0 && a.overdueAmount !== a.totalOutstanding ? (
              <p className="text-xs text-destructive-text">
                <Money value={a.overdueAmount} tone="overdue" /> overdue
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {a.contact ? (
              <Button variant="outline" size="icon" asChild className={iconButton}>
                <a href={`tel:${a.contact}`} title={`Call ${a.contact}`} aria-label={`Call ${a.memberName}`}>
                  <Phone aria-hidden="true" />
                </a>
              </Button>
            ) : null}
            {wa ? (
              <Button variant="outline" size="icon" asChild className={iconButton}>
                <a href={wa} target="_blank" rel="noopener noreferrer" title="Send WhatsApp reminder" aria-label={`Send reminder to ${a.memberName}`}>
                  <MessageCircle aria-hidden="true" />
                </a>
              </Button>
            ) : null}
            <Button size="sm" asChild className="h-11 md:h-9">
              <Link href={a.actionHref}>Record payment</Link>
            </Button>
          </div>
        </div>
      </div>
      {isOpen ? (
        <div id={panelId} className="overflow-x-auto border-t bg-elevated px-3 py-3 sm:px-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="pb-1 text-left font-medium">Period</th>
                <th scope="col" className="pb-1 text-left font-medium">Due date</th>
                <th scope="col" className="pb-1 text-right font-medium">Expected</th>
                <th scope="col" className="pb-1 text-right font-medium">Paid</th>
                <th scope="col" className="pb-1 text-right font-medium">Outstanding</th>
                <th scope="col" className="pb-1 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {a.periods.map((p) => (
                <tr key={p.period} className="border-t">
                  <td className="py-1.5">{periodLabel(a.kind, a.frequency, p.period)}</td>
                  <td className="py-1.5"><DateText value={p.dueDate} /></td>
                  <td className="py-1.5 text-right"><Money value={p.expected} tone="plain" /></td>
                  <td className="py-1.5 text-right"><Money value={p.paid} /></td>
                  <td className="py-1.5 text-right font-semibold"><Money value={p.outstanding} tone="plain" /></td>
                  <td className="py-1.5 text-right text-xs">{periodStatus(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href={a.detailHref} className="font-medium text-primary-text hover:underline">
              Open {a.kind === 'loan' ? 'loan' : 'chit fund'} details →
            </Link>
            {a.contact ? <span className="text-muted-foreground">Contact: {a.contact}</span> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
