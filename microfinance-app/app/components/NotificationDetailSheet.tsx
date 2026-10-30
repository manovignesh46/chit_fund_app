'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';

export interface NotificationDetails {
  kind?: string;
  direction?: 'transfer' | 'credit' | 'debit';
  amount?: number;
  reason?: string;
  date?: string;
  fromPartner?: string | null;
  toPartner?: string | null;
  enteredBy?: string;
  transactionIds?: number[];
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor?: { id: number; name: string };
  entityType?: string | null;
  entityId?: number | null;
  details?: NotificationDetails | null;
}

interface TransactionRow {
  id: number;
  type: string;
  amount: number;
  date: string;
  note: string | null;
  from_partner: string | null;
  to_partner: string | null;
  entered_by: string;
  partnerBalance: number | null;
  totalBalance: number | null;
  createdAt: string;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

const TYPE_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  contribution: 'Contribution',
  auction: 'Auction',
  loan_created: 'Loan',
  loan_repayment: 'Repayment',
  chit_fund_created: 'Chit Fund',
  member_created: 'Member',
};

export function notificationTypeLabel(type: string) {
  return TYPE_LABELS[type] || type;
}

/**
 * Split a notification into its headline message and reason, so lists can show the
 * reason on its own line. Older notifications have no structured details.
 */
export function notificationSummary(n: NotificationItem): { message: string; reason: string | null } {
  const reason = n.details?.reason?.trim() || null;
  if (!reason) return { message: n.message, reason: null };
  const suffix = `: ${reason}`;
  const message = n.message.endsWith(suffix) ? n.message.slice(0, -suffix.length) : n.message;
  return { message, reason };
}

function linkLabel(link: string) {
  if (link.startsWith('/transactions')) return 'Open in Transactions';
  if (link.startsWith('/loans')) return 'Open loan';
  if (link.startsWith('/chit-funds')) return 'Open chit fund';
  if (link.startsWith('/members')) return 'Open member';
  return 'Open';
}

interface Props {
  notification: NotificationItem | null;
  onClose: () => void;
}

/** Opens a notification in place (bottom sheet on mobile, side panel on desktop). */
export default function NotificationDetailSheet({ notification, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null as null | { notification: NotificationItem; transactions: TransactionRow[]; entityMissing: boolean });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!notification) return;
    let cancelled = false;
    setData(null);
    setError('');
    setLoading(true);
    fetch(`/api/notifications/${notification.id}/details`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Failed to load details');
        if (!cancelled) setData(body);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [notification?.id]);

  useEffect(() => {
    if (!notification) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [notification, onClose]);

  if (!mounted || !notification) return null;

  const n = data?.notification || notification;
  const d = n.details || null;
  const { message, reason } = notificationSummary(n);
  const transactions = data?.transactions || [];
  const amountClass =
    d?.direction === 'credit' ? 'text-green-600 dark:text-green-400' : d?.direction === 'debit' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-theme-primary';

  // Balance after each affected partner's row
  const balances = transactions
    .filter((t) => t.partnerBalance !== null)
    .map((t) => ({ id: t.id, partner: t.to_partner || t.from_partner || '—', balance: t.partnerBalance as number }));
  const totalBalance = transactions.length ? transactions[transactions.length - 1].totalBalance : null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="notification-detail-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none bg-white dark:bg-surface-card border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-surface-border shadow-2xl flex flex-col">
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-surface-border" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-3 sm:pt-5 pb-3 border-b border-gray-100 dark:border-surface-border">
          <div className="min-w-0">
            <span className="inline-block text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-surface-elevated dark:text-theme-secondary">
              {notificationTypeLabel(n.type)}
            </span>
            <h2 id="notification-detail-title" className="mt-1.5 text-lg font-semibold text-gray-900 dark:text-theme-primary">{n.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-theme-muted dark:hover:bg-surface-hover" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">
          {d?.amount !== undefined && (
            <div>
              <p className={`text-3xl font-bold tabular-nums ${amountClass}`}>
                {d.direction === 'credit' ? '+' : d.direction === 'debit' ? '−' : ''}
                {inr.format(d.amount)}
              </p>
              {d.direction === 'transfer' ? (
                <p className="mt-1 text-sm text-gray-700 dark:text-theme-secondary">
                  <span className="font-medium">{d.fromPartner}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-medium">{d.toPartner}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-700 dark:text-theme-secondary">
                  {d.direction === 'credit' ? 'Credited to' : 'Debited from'}{' '}
                  <span className="font-medium">{d.toPartner || d.fromPartner}</span>
                </p>
              )}
            </div>
          )}

          {reason ? (
            <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">Reason</p>
              <p className="text-sm text-gray-900 dark:text-theme-primary break-words">{reason}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-theme-secondary break-words">{message}</p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {d?.date && (
              <>
                <dt className="text-gray-500 dark:text-theme-muted">Transaction date</dt>
                <dd className="text-gray-900 dark:text-theme-primary">{format(new Date(d.date), 'dd MMM yyyy')}</dd>
              </>
            )}
            {d?.enteredBy && (
              <>
                <dt className="text-gray-500 dark:text-theme-muted">Entered as</dt>
                <dd className="text-gray-900 dark:text-theme-primary">{d.enteredBy}</dd>
              </>
            )}
            {n.actor?.name && (
              <>
                <dt className="text-gray-500 dark:text-theme-muted">Recorded by</dt>
                <dd className="text-gray-900 dark:text-theme-primary">{n.actor.name}</dd>
              </>
            )}
            <dt className="text-gray-500 dark:text-theme-muted">Recorded</dt>
            <dd className="text-gray-900 dark:text-theme-primary">
              {format(new Date(n.createdAt), 'dd MMM yyyy, h:mm a')}
              <span className="text-gray-500 dark:text-theme-muted"> · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
            </dd>
          </dl>

          {loading && (
            <div className="space-y-2" aria-label="Loading details">
              <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-surface-elevated animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-surface-elevated animate-pulse" />
            </div>
          )}
          {error && (
            <p className="text-sm rounded-md p-3 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
          )}
          {data?.entityMissing && (
            <p className="text-sm rounded-md p-3 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              This transaction no longer exists. It may have been deleted after this notification was sent.
            </p>
          )}

          {balances.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-theme-muted mb-1.5">Balance after this entry</p>
              <div className="rounded-lg border border-gray-200 dark:border-surface-border divide-y divide-gray-100 dark:divide-surface-border">
                {balances.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-700 dark:text-theme-secondary">{b.partner}</span>
                    <span className={`tabular-nums font-medium ${b.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-theme-primary'}`}>{inr.format(b.balance)}</span>
                  </div>
                ))}
                {totalBalance !== null && (
                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-gray-50 dark:bg-surface-elevated">
                    <span className="text-gray-700 dark:text-theme-secondary">Total (all partners)</span>
                    <span className="tabular-nums font-semibold text-gray-900 dark:text-theme-primary">{inr.format(totalBalance)}</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-theme-muted">Running balances as stored when the entry was saved.</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-surface-border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-md text-sm border border-gray-200 dark:border-surface-border text-gray-700 dark:text-theme-secondary hover:bg-gray-50 dark:hover:bg-surface-hover">
            Close
          </button>
          {n.link && !data?.entityMissing && (
            <Link href={n.link} onClick={onClose} className="flex-1 px-4 py-2.5 rounded-md text-sm text-center font-medium bg-blue-600 text-white hover:bg-blue-700">
              {linkLabel(n.link)}
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
