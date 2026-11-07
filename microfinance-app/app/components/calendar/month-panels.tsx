'use client';

/**
 * Calendar month figures and the pending-members list, kept free of the kit's `@/` imports:
 * tests/test-calendar-pending.js loads this file in a VM with a fake React (useState and
 * useEffect only) and an import allow-list (react, next/link, date-fns, lib/format).
 * Keep it that way: no other imports, no other hooks.
 */
import * as React from 'react';
import Link from 'next/link';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { formatMoney } from '../../../lib/format';

export interface MonthStats {
  expectedLoanRepayment: number;
  actualLoanRepayment: number;
  expectedChitContribution: number;
  actualChitContribution: number;
  totalLoanDisbursement: number;
  totalDocumentCharges: number;
  auctionCommission: number;
  auctionCount: number;
  totalAuctionPayouts: number;
  totalTransactions: number;
  totalAmount: number;
}

export type ModalKind = 'loan_repayment' | 'chit_contribution' | 'loan_disbursement' | 'auction_payout' | 'all';
export type PendingKind = 'loan_repayment' | 'chit_contribution';

export const MODAL_CONFIG: Record<ModalKind, { title: string; type: string | null; emptyText: string }> = {
  loan_repayment: { title: 'Loan Repayments', type: 'LOAN_REPAYMENT', emptyText: 'No loan repayments recorded this month.' },
  chit_contribution: { title: 'Chit Contributions', type: 'CHIT_CONTRIBUTION', emptyText: 'No chit contributions recorded this month.' },
  loan_disbursement: { title: 'Loans Given', type: 'LOAN_DISBURSEMENT', emptyText: 'No loans disbursed this month.' },
  auction_payout: { title: 'Auction Payouts', type: 'AUCTION_PAYOUT', emptyText: 'No auction payouts recorded this month.' },
  all: { title: 'All Transactions', type: null, emptyText: 'No transactions recorded this month.' },
};

/** Types listed by the "All transactions" view (as before: the four money movements). */
export const ALL_MONTH_TYPES = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];

export const collectionRate = (actual: number, expected: number) =>
  expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 0;

export function extractMemberName(note?: string | null): string {
  if (!note) return '-';
  let m = note.match(/Repayment from ([^-]+?)(?: -|$)/i);
  if (m) return m[1].trim();
  m = note.match(/Loan disbursed to ([^-]+?)(?: -|$)/i);
  if (m) return m[1].trim();
  m = note.match(/Auction payout to ([^-]+?)(?: -|$)/i);
  if (m) return m[1].trim();
  m = note.match(/from ([^-]+?)(?: -|$)/i);
  if (m) return m[1].trim();
  m = note.match(/to ([^-]+?)(?: -|$)/i);
  if (m) return m[1].trim();
  return '-';
}

const MONTH_INDEX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/** Event dates arrive as "7 November 2026"; anything else falls back to today (as before). */
export function parseEventDate(date: string): Date {
  const parts = (date ?? '').split(' ');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthIndex = MONTH_INDEX[parts[1]];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && monthIndex !== undefined && !isNaN(year)) return new Date(year, monthIndex, day);
  }
  return new Date();
}

/** Month stats from the calendar-month response (same fallbacks as the old separate requests). */
export function toMonthStats(data: {
  aggregations?: Record<string, number | undefined> | null;
  summary?: Record<string, number | undefined> | null;
  chitCommission?: { commission?: number; auctionCount?: number } | null;
  auctionPayoutTotal?: number;
}): MonthStats {
  const a = data.aggregations ?? {};
  const s = data.summary ?? {};
  return {
    expectedLoanRepayment: a.expectedLoanRepayment ?? 0,
    actualLoanRepayment: a.actualLoanRepayment ?? 0,
    expectedChitContribution: a.expectedChitContribution ?? 0,
    actualChitContribution: a.actualChitContribution ?? 0,
    totalLoanDisbursement: s.totalLoanDisbursement ?? 0,
    totalDocumentCharges: s.totalDocumentCharges ?? 0,
    auctionCommission: data.chitCommission?.commission ?? 0,
    auctionCount: data.chitCommission?.auctionCount ?? 0,
    totalAuctionPayouts: data.auctionPayoutTotal ?? 0,
    totalTransactions: s.totalTransactions ?? 0,
    totalAmount: s.totalAmount ?? 0,
  };
}

export const cashFlowOf = (stats: MonthStats) => {
  const inflow = stats.actualLoanRepayment + stats.actualChitContribution + stats.totalDocumentCharges;
  const outflow = stats.totalLoanDisbursement + stats.totalAuctionPayouts;
  return { inflow, outflow, net: inflow - outflow };
};

const money = (n: number) => formatMoney(n ?? 0);
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : formatMoney(n));

// ─────────────────────────────────────────────────────────────── pending members

interface PendingRow {
  key: string;
  member: string;
  description: string;
  amount: number;
  periods: number;
  href: string;
}

/**
 * The month's pending loan repayments or chit contributions (body of the calendar's
 * "View pending members" dialog; the page supplies the dialog and its title).
 */
export function PendingMembersModal({ kind, month }: { kind: PendingKind; month: Date; onClose?: () => void }) {
  const [rows, setRows] = React.useState<PendingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  React.useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = kind === 'loan_repayment' ? 'pending-loans' : 'pending-chits';
        const response = await fetch(`/api/transactions/${endpoint}?startDate=${start}&endDate=${end}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load pending members. Please try again.');
        const data = await response.json();
        if (controller.signal.aborted) return;
        setRows(kind === 'loan_repayment'
          ? (data.pendingLoans ?? []).map((loan: any) => ({
              key: `loan-${loan.id}`,
              member: loan.borrowerName,
              description: `${loan.loanType} · Loan #${loan.id}`,
              amount: loan.pendingAmount,
              periods: loan.pendingPeriods,
              href: `/loans/${loan.id}/repayments`,
            }))
          : (data.pendingChitFunds ?? []).flatMap((fund: any) => fund.pendingMembers.map((member: any) => ({
              key: `chit-${fund.id}-${member.memberId}`,
              member: member.memberName,
              description: `${fund.name} · Month ${(member.pendingMonths ?? []).join(', ')}`,
              amount: member.pendingAmount,
              periods: member.pendingPeriods,
              href: `/chit-funds/${fund.id}/contributions?month=${member.pendingMonths[0]}`,
            }))));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load pending members.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [kind, start, end, retry]);

  const monthText = format(month, 'MMMM yyyy');
  if (loading) {
    return <p className="py-4 text-sm text-muted-foreground" role="status">Loading pending members…</p>;
  }
  if (error) {
    return (
      <div className="py-2">
        <p className="text-sm text-destructive-text" role="alert">{error}</p>
        <button
          type="button"
          className="mt-3 inline-flex h-10 items-center rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry
        </button>
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No pending payments for this month.</p>;
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm font-semibold text-foreground">
        <span>{rows.length} pending {rows.length === 1 ? 'entry' : 'entries'}</span>
        <span className="tabular-nums">{money(rows.reduce((sum, row) => sum + row.amount, 0))} outstanding</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Payments scheduled in {monthText} with an unpaid balance, including partial payments.</p>
      <ul className="max-h-[50vh] divide-y overflow-y-auto">
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href} className="flex items-start justify-between gap-3 rounded px-1 py-3 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="min-w-0">
                <div className="break-words font-medium text-primary-text">{row.member}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.description}</div>
                <div className="text-xs text-muted-foreground">{row.periods} {row.periods === 1 ? 'payment' : 'payments'} pending</div>
              </div>
              <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">{money(row.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── monthly summary cards

const linkButton =
  'inline-flex items-center gap-1 rounded-sm text-left text-xs font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function StatTile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function RateBar({ rate, label }: { rate: number; label: string }) {
  return (
    <div className="mt-1">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>Collection rate</span>
        <span className="font-medium tabular-nums text-foreground">{rate}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

const figure = 'text-xl font-semibold tabular-nums text-foreground';

/** The month's figures; links open that month's transactions, pending members or the cash-flow breakdown. */
export function MonthlyStatsCards({
  stats,
  monthLabel,
  onOpenModal,
  onOpenSummary,
  onOpenPending,
}: {
  stats: MonthStats;
  monthLabel: string;
  onOpenModal: (kind: ModalKind) => void;
  onOpenSummary: () => void;
  onOpenPending: (kind: PendingKind) => void;
}) {
  const loanRate = collectionRate(stats.actualLoanRepayment, stats.expectedLoanRepayment);
  const chitRate = collectionRate(stats.actualChitContribution, stats.expectedChitContribution);
  const flow = cashFlowOf(stats);
  return (
    <section aria-labelledby="calendar-month-summary" className="mt-6">
      <h2 id="calendar-month-summary" className="mb-3 text-base font-semibold text-foreground">
        {monthLabel} — Monthly Summary
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile title="Loan Repayments">
          <div className={figure}>{money(stats.actualLoanRepayment)}</div>
          <div className="text-xs text-muted-foreground">of {money(stats.expectedLoanRepayment)} expected</div>
          <RateBar rate={loanRate} label="Loan collection rate" />
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={linkButton} onClick={() => onOpenModal('loan_repayment')}>View repayments →</button>
            <button type="button" className={linkButton} aria-label="View pending loan members"
              onClick={(event) => { event.stopPropagation(); onOpenPending('loan_repayment'); }}>
              View pending members →
            </button>
          </div>
        </StatTile>

        <StatTile title="Chit Contributions">
          <div className={figure}>{money(stats.actualChitContribution)}</div>
          <div className="text-xs text-muted-foreground">of {money(stats.expectedChitContribution)} expected</div>
          <RateBar rate={chitRate} label="Chit collection rate" />
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={linkButton} onClick={() => onOpenModal('chit_contribution')}>View contributions →</button>
            <button type="button" className={linkButton} aria-label="View pending chit members"
              onClick={(event) => { event.stopPropagation(); onOpenPending('chit_contribution'); }}>
              View pending members →
            </button>
          </div>
        </StatTile>

        <StatTile title="Loans Given">
          <div className={figure}>{money(stats.totalLoanDisbursement)}</div>
          {stats.totalDocumentCharges > 0 ? (
            <div className="text-xs text-muted-foreground">+ {money(stats.totalDocumentCharges)} doc charges</div>
          ) : null}
          <button type="button" className={`${linkButton} mt-auto`} onClick={() => onOpenModal('loan_disbursement')}>View loans given →</button>
        </StatTile>

        <StatTile title="Net Cash Flow">
          <div className={`text-xl font-semibold tabular-nums ${flow.net < 0 ? 'text-destructive-text' : 'text-foreground'}`}>{signed(flow.net)}</div>
          <div className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
            <span>In {money(flow.inflow)}</span>
            <span>Out {money(flow.outflow)}</span>
          </div>
          <button type="button" className={`${linkButton} mt-auto`} onClick={onOpenSummary}>View breakdown →</button>
        </StatTile>

        <StatTile title="Auction Commission">
          <div className={figure}>{money(stats.auctionCommission)}</div>
          <div className="text-xs text-muted-foreground">
            {stats.auctionCount} auction{stats.auctionCount !== 1 ? 's' : ''} this month
          </div>
        </StatTile>

        <StatTile title="Auction Payout">
          <div className={figure}>{money(stats.totalAuctionPayouts)}</div>
          <div className="text-xs text-muted-foreground">paid to winners</div>
          <button type="button" className={`${linkButton} mt-auto`} onClick={() => onOpenModal('auction_payout')}>View payouts →</button>
        </StatTile>

        <StatTile title="Transactions">
          <div className={figure}>{stats.totalTransactions}</div>
          <div className="text-xs text-muted-foreground">{money(stats.totalAmount)} total recorded</div>
          <button type="button" className={`${linkButton} mt-auto`} onClick={() => onOpenModal('all')}>View all →</button>
        </StatTile>
      </div>
    </section>
  );
}
