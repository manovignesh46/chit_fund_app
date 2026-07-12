// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '../../lib/api';
import BackTitle from '../components/common/BackTitle';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const collectionRate = (actual: number, expected: number) =>
  expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 0;

function extractMemberName(note?: string): string {
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

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'Loan' | 'Chit Fund';
  isDueTomorrow?: boolean;
  rawDate?: Date;
  entityId?: number;
  entityType?: string;
  period?: number;
  status?: 'Paid' | 'Overdue';
  paymentType?: string;
  dueAmount?: number;
}

interface MonthStats {
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

const navBtnClass = 'btn-neutral p-2 rounded-lg text-sm sm:text-base';

function getEventChipClass(event: Event): string {
  if (event.status === 'Overdue') return 'calendar-event calendar-event-overdue';
  if (event.status === 'Paid') return 'calendar-event calendar-event-paid';
  if (event.isDueTomorrow) return 'calendar-event calendar-event-due';
  if (event.type === 'Loan') return 'calendar-event calendar-event-loan';
  return 'calendar-event calendar-event-chit';
}

function CollectionBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 dark:text-theme-muted mb-1">
        <span>Collection rate</span>
        <span className="font-semibold">{rate}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-surface-elevated overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

type ModalKind = 'loan_repayment' | 'chit_contribution' | 'loan_disbursement' | 'auction_payout' | 'all';

const MODAL_CONFIG: Record<ModalKind, { title: string; type: string | null; emptyText: string }> = {
  loan_repayment:    { title: 'Loan Repayments',    type: 'LOAN_REPAYMENT',                                  emptyText: 'No loan repayments recorded this month.' },
  chit_contribution: { title: 'Chit Contributions', type: 'CHIT_CONTRIBUTION',                               emptyText: 'No chit contributions recorded this month.' },
  loan_disbursement: { title: 'Loans Given',         type: 'LOAN_DISBURSEMENT',                              emptyText: 'No loans disbursed this month.' },
  auction_payout:    { title: 'Auction Payouts',     type: 'AUCTION_PAYOUT',                                 emptyText: 'No auction payouts recorded this month.' },
  all:               { title: 'All Transactions',    type: null,                                              emptyText: 'No transactions recorded this month.' },
};

interface ModalRow {
  member: string;
  amount: number;
  date: string;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="themed-card w-full sm:max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-surface-elevated">
          <h3 className="text-base font-semibold text-gray-900 dark:text-theme-heading">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function TransactionModal({ title, rows, loading, onClose, emptyText }: {
  title: string; rows: ModalRow[]; loading: boolean; onClose: () => void; emptyText: string;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex justify-between">
              <div className="h-4 bg-gray-200 dark:bg-surface-elevated rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-surface-elevated rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-gray-500 dark:text-theme-muted text-center">{emptyText}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-surface-elevated text-xs text-gray-500 dark:text-theme-muted uppercase">
              <th className="text-left px-5 py-2">Member</th>
              <th className="text-right px-5 py-2">Amount</th>
              <th className="text-right px-5 py-2 hidden sm:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-surface-elevated last:border-0 hover:bg-gray-50 dark:hover:bg-surface-elevated">
                <td className="px-5 py-3 text-gray-800 dark:text-theme-primary font-medium">{row.member}</td>
                <td className="px-5 py-3 text-right text-green-600 dark:text-green-400 font-semibold">{formatCurrency(row.amount)}</td>
                <td className="px-5 py-3 text-right text-gray-500 dark:text-theme-muted hidden sm:table-cell">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}

function SummaryBreakdownModal({ title, stats, onClose }: {
  title: string; stats: MonthStats; onClose: () => void;
}) {
  const cashInflow = stats.actualLoanRepayment + stats.actualChitContribution + stats.totalDocumentCharges;
  const cashOutflow = stats.totalLoanDisbursement + stats.totalAuctionPayouts;
  const netFlow = cashInflow - cashOutflow;

  const rows = [
    { label: 'Loan Repayments',    amount: stats.actualLoanRepayment,    color: 'text-green-600 dark:text-green-400',  tag: '↑ Inflow' },
    { label: 'Chit Contributions', amount: stats.actualChitContribution, color: 'text-green-600 dark:text-green-400',  tag: '↑ Inflow' },
    { label: 'Document Charges',   amount: stats.totalDocumentCharges,   color: 'text-green-600 dark:text-green-400',  tag: '↑ Inflow' },
    { label: 'Loans Disbursed',    amount: stats.totalLoanDisbursement,  color: 'text-red-500 dark:text-red-400',      tag: '↓ Outflow' },
    { label: 'Auction Payouts',    amount: stats.totalAuctionPayouts,    color: 'text-red-500 dark:text-red-400',      tag: '↓ Outflow' },
  ].filter(r => r.amount > 0);

  return (
    <ModalShell title={title} onClose={onClose}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-surface-elevated text-xs text-gray-500 dark:text-theme-muted uppercase">
            <th className="text-left px-5 py-2">Category</th>
            <th className="text-left px-5 py-2 hidden sm:table-cell">Flow</th>
            <th className="text-right px-5 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 dark:border-surface-elevated last:border-0">
              <td className="px-5 py-3 text-gray-800 dark:text-theme-primary font-medium">{row.label}</td>
              <td className="px-5 py-3 text-xs text-gray-500 dark:text-theme-muted hidden sm:table-cell">{row.tag}</td>
              <td className={`px-5 py-3 text-right font-semibold ${row.color}`}>{formatCurrency(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 dark:border-surface-elevated">
            <td className="px-5 py-3 font-semibold text-gray-700 dark:text-theme-heading" colSpan={2}>Net Cash Flow</td>
            <td className={`px-5 py-3 text-right font-bold ${netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
            </td>
          </tr>
        </tfoot>
      </table>
      {rows.length === 0 && (
        <p className="p-5 text-sm text-gray-500 dark:text-theme-muted text-center">No transactions recorded this month.</p>
      )}
    </ModalShell>
  );
}

function StatCard({
  title,
  icon,
  onClick,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`themed-card p-4 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 dark:text-theme-muted text-sm font-medium">
          {icon}
          {title}
        </div>
        {onClick && (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      {children}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="themed-card p-4 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-surface-elevated rounded w-2/3 mb-3" />
          <div className="h-7 bg-gray-200 dark:bg-surface-elevated rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-surface-elevated rounded w-full" />
        </div>
      ))}
    </div>
  );
}

function MonthlyStatsCards({
  stats,
  monthLabel,
  onOpenModal,
  onOpenSummary,
}: {
  stats: MonthStats;
  monthLabel: string;
  onOpenModal: (kind: ModalKind) => void;
  onOpenSummary: () => void;
}) {
  const loanRate = collectionRate(stats.actualLoanRepayment, stats.expectedLoanRepayment);
  const chitRate = collectionRate(stats.actualChitContribution, stats.expectedChitContribution);
  const cashInflow = stats.actualLoanRepayment + stats.actualChitContribution + stats.totalDocumentCharges;
  const cashOutflow = stats.totalLoanDisbursement + stats.totalAuctionPayouts;
  const netFlow = cashInflow - cashOutflow;

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-700 dark:text-theme-heading mb-3">
        {monthLabel} — Monthly Summary
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Loan Repayments */}
        <StatCard
          title="Loan Repayments"
          onClick={() => onOpenModal('loan_repayment')}
          icon={
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats.actualLoanRepayment)}
            </div>
            <div className="text-xs text-gray-500 dark:text-theme-muted">
              of {formatCurrency(stats.expectedLoanRepayment)} expected
            </div>
          </div>
          <CollectionBar rate={loanRate} />
        </StatCard>

        {/* Chit Contributions */}
        <StatCard
          title="Chit Contributions"
          onClick={() => onOpenModal('chit_contribution')}
          icon={
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          }
        >
          <div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(stats.actualChitContribution)}
            </div>
            <div className="text-xs text-gray-500 dark:text-theme-muted">
              of {formatCurrency(stats.expectedChitContribution)} expected
            </div>
          </div>
          <CollectionBar rate={chitRate} />
        </StatCard>

        {/* Loan Disbursements */}
        <StatCard
          title="Loans Given"
          onClick={() => onOpenModal('loan_disbursement')}
          icon={
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          }
        >
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(stats.totalLoanDisbursement)}
          </div>
          {stats.totalDocumentCharges > 0 && (
            <div className="text-xs text-gray-500 dark:text-theme-muted">
              + {formatCurrency(stats.totalDocumentCharges)} doc charges
            </div>
          )}
        </StatCard>

        {/* Auction Commission */}
        <StatCard
          title="Auction Commission"
          icon={
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        >
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(stats.auctionCommission)}
          </div>
          <div className="text-xs text-gray-500 dark:text-theme-muted">
            {stats.auctionCount} auction{stats.auctionCount !== 1 ? 's' : ''} this month
          </div>
        </StatCard>

        {/* Auction Payout */}
        <StatCard
          title="Auction Payout"
          onClick={() => onOpenModal('auction_payout')}
          icon={
            <svg className="w-4 h-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="text-xl font-bold text-pink-600 dark:text-pink-400">
            {formatCurrency(stats.totalAuctionPayouts)}
          </div>
          <div className="text-xs text-gray-500 dark:text-theme-muted">paid to winners</div>
        </StatCard>

        {/* Transactions */}
        <StatCard
          title="Transactions"
          onClick={() => onOpenModal('all')}
          icon={
            <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
        >
          <div className="text-xl font-bold text-teal-600 dark:text-teal-400">
            {stats.totalTransactions}
          </div>
          <div className="text-xs text-gray-500 dark:text-theme-muted">
            {formatCurrency(stats.totalAmount)} total recorded
          </div>
        </StatCard>

        {/* Cash Flow */}
        <StatCard
          title="Net Cash Flow"
          onClick={onOpenSummary}
          icon={
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        >
          <div className={`text-xl font-bold ${netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
          </div>
          <div className="text-xs text-gray-500 dark:text-theme-muted flex gap-3">
            <span className="text-green-600 dark:text-green-400">↑ {formatCurrency(cashInflow)}</span>
            <span className="text-red-500 dark:text-red-400">↓ {formatCurrency(cashOutflow)}</span>
          </div>
        </StatCard>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Loan' | 'Chit Fund'>('all');
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);
  const [modalRows, setModalRows] = useState<ModalRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    const fetchEventsForMonth = async () => {
      try {
        setLoading(true);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;

        const data = await fetch(
          `/api/dashboard/consolidated?action=events&view=calendar&year=${year}&month=${month}`
        ).then((res) => res.json());

        const eventsWithDates = data.map((event: Event) => {
          let parsedDate: Date;
          const parts = event.date.split(' ');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const monthName = parts[1];
            const yearNum = parseInt(parts[2]);
            const monthMap: Record<string, number> = {
              January: 0, February: 1, March: 2, April: 3,
              May: 4, June: 5, July: 6, August: 7,
              September: 8, October: 9, November: 10, December: 11,
            };
            const monthIndex = monthMap[monthName];
            parsedDate =
              !isNaN(day) && monthIndex !== undefined && !isNaN(yearNum)
                ? new Date(yearNum, monthIndex, day)
                : new Date();
          } else {
            parsedDate = new Date();
          }
          return { ...event, rawDate: parsedDate };
        });

        setEvents(eventsWithDates);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching events:', err);
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEventsForMonth();
  }, [currentMonth]);

  useEffect(() => {
    const fetchMonthStats = async () => {
      try {
        setStatsLoading(true);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const startDate = format(start, 'yyyy-MM-dd');
        const endDate = format(end, 'yyyy-MM-dd');

        const monthKey = format(start, 'yyyy-MM');
        const [aggregations, summary, chitProfit, auctionTxns] = await Promise.all([
          fetch(`/api/transactions/aggregations?startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
          fetch(`/api/transactions/summary?startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
          fetch(`/api/chit-funds/monthly-profit?months=24`).then((r) => r.json()),
          fetch(`/api/transactions?type=AUCTION_PAYOUT&startDate=${startDate}&endDate=${endDate}&pageSize=1000`).then((r) => r.json()),
        ]);

        const monthProfitData = chitProfit?.months?.find((m: { key: string }) => m.key === monthKey);
        const auctionPayoutTotal = (auctionTxns?.transactions ?? []).reduce(
          (sum: number, t: any) => sum + Math.abs(t.amount ?? 0), 0
        );

        setMonthStats({
          expectedLoanRepayment: aggregations.expectedLoanRepayment ?? 0,
          actualLoanRepayment: aggregations.actualLoanRepayment ?? 0,
          expectedChitContribution: aggregations.expectedChitContribution ?? 0,
          actualChitContribution: aggregations.actualChitContribution ?? 0,
          totalLoanDisbursement: summary.totalLoanDisbursement ?? 0,
          totalDocumentCharges: summary.totalDocumentCharges ?? 0,
          auctionCommission: monthProfitData?.commission ?? 0,
          auctionCount: monthProfitData?.auctionCount ?? 0,
          totalAuctionPayouts: auctionPayoutTotal,
          totalTransactions: summary.totalTransactions ?? 0,
          totalAmount: summary.totalAmount ?? 0,
        });
      } catch (err) {
        console.error('Error fetching month stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchMonthStats();
  }, [currentMonth]);

  const openModal = async (kind: ModalKind) => {
    if (!MODAL_CONFIG[kind]) return;
    setActiveModal(kind);
    setModalRows([]);
    setModalLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const base = `startDate=${start}&endDate=${end}&pageSize=1000`;
      const cfg = MODAL_CONFIG[kind];

      let txns: any[];
      if (cfg.type === null) {
        // Fetch all transaction types in parallel and merge, sorted by date desc
        const types = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
        const results = await Promise.all(
          types.map((t) => fetch(`/api/transactions?${base}&type=${t}`).then((r) => r.json()))
        );
        txns = results
          .flatMap((r) => r.transactions ?? [])
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else {
        const res = await fetch(`/api/transactions?${base}&type=${cfg.type}`).then((r) => r.json());
        txns = res.transactions ?? [];
      }

      setModalRows(
        txns.map((t: any) => ({
          member: extractMemberName(t.note),
          amount: Math.abs(t.amount ?? 0),
          date: t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-',
        }))
      );
    } catch {
      setModalRows([]);
    } finally {
      setModalLoading(false);
    }
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((event) => {
      if (!event.rawDate) return false;
      if (filter !== 'all' && event.type !== filter) return false;
      return isSameDay(event.rawDate, day);
    });

  const backLink = <BackTitle title="Calendar" href="/dashboard" ariaLabel="Back to Dashboard" />;

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex justify-between items-center mb-6">{backLink}</div>
        <div className="themed-card p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-surface-elevated rounded w-1/4 mb-6" />
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-surface-elevated rounded" />
              ))}
            </div>
          </div>
        </div>
        <StatsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="flex justify-between items-center mb-6">{backLink}</div>
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        {backLink}
      </div>

      <div className="themed-card p-2 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-6">
          <div className="flex flex-row gap-2">
            <button onClick={prevMonth} className={navBtnClass} aria-label="Previous Month">
              <span className="hidden sm:inline">Prev</span>
              <span className="sm:hidden">‹</span>
            </button>
            <button
              onClick={goToToday}
              className="btn-primary p-2 rounded-lg text-sm sm:text-base sm:px-4 sm:py-2"
              aria-label="Go to Today"
            >
              Today
            </button>
            <button onClick={nextMonth} className={navBtnClass} aria-label="Next Month">
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">›</span>
            </button>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-theme-heading">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex flex-row gap-2">
            <button
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'filter-chip-active-blue' : 'filter-chip'}
            >
              All
            </button>
            <button
              onClick={() => setFilter('Loan')}
              className={filter === 'Loan' ? 'filter-chip-active-green' : 'filter-chip'}
            >
              Loans
            </button>
            <button
              onClick={() => setFilter('Chit Fund')}
              className={filter === 'Chit Fund' ? 'filter-chip-active-blue' : 'filter-chip'}
            >
              Chit Funds
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-theme-muted">
            <p className="text-lg font-semibold mb-2">No events found</p>
            <p>There are no events scheduled for this month.</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {[...Array(monthStart.getDay())].map((_, i) => (
              <div key={`empty-start-${i}`} className="calendar-day-empty" />
            ))}

            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toString()}
                  className={isToday ? 'calendar-day calendar-day-today' : 'calendar-day'}
                >
                  <div className="font-semibold mb-1 text-gray-900 dark:text-theme-primary">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {dayEvents.map((event) => {
                      let eventLink = '#';
                      if (event.entityType === 'loan' && event.entityId) {
                        eventLink = `/loans/${event.entityId}`;
                      } else if (event.entityType === 'chitFund' && event.entityId) {
                        eventLink = `/chit-funds/${event.entityId}`;
                      }

                      return (
                        <Link
                          href={eventLink}
                          key={event.id}
                          className={getEventChipClass(event)}
                        >
                          <div className="font-semibold truncate">
                            {event.title.includes('Loan Payment')
                              ? event.title.split('Loan Payment')[0].trim().replace(/\s+$/, '')
                              : event.title}
                            {event.dueAmount !== undefined && (
                              <span className="font-medium">: {formatCurrency(event.dueAmount)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center">
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                  event.type === 'Loan' ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                              />
                              <span className="text-xs opacity-80">{event.type}</span>
                              {event.isDueTomorrow && (
                                <span className="ml-1 text-xs font-semibold">Due Tomorrow</span>
                              )}
                              {event.status === 'Paid' && (
                                <span className="ml-1 text-xs font-semibold">Paid</span>
                              )}
                              {event.status === 'Overdue' && (
                                <span className="ml-1 text-xs font-semibold">OD</span>
                              )}
                            </div>
                            {event.period && (
                              <span className="text-xs opacity-80">due: {event.period}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {[...Array(6 - monthEnd.getDay())].map((_, i) => (
              <div key={`empty-end-${i}`} className="calendar-day-empty" />
            ))}
          </div>
        )}
      </div>

      {statsLoading ? (
        <StatsSkeleton />
      ) : monthStats ? (
        <MonthlyStatsCards
          stats={monthStats}
          monthLabel={format(currentMonth, 'MMMM yyyy')}
          onOpenModal={openModal}
          onOpenSummary={() => setShowSummaryModal(true)}
        />
      ) : null}

      {showSummaryModal && monthStats && (
        <SummaryBreakdownModal
          title={`Cash Flow — ${format(currentMonth, 'MMMM yyyy')}`}
          stats={monthStats}
          onClose={() => setShowSummaryModal(false)}
        />
      )}

      {activeModal && MODAL_CONFIG[activeModal] && (
        <TransactionModal
          title={`${MODAL_CONFIG[activeModal].title} — ${format(currentMonth, 'MMMM yyyy')}`}
          rows={modalRows}
          loading={modalLoading}
          onClose={() => setActiveModal(null)}
          emptyText={MODAL_CONFIG[activeModal].emptyText}
        />
      )}
    </div>
  );
}
