/**
 * Notifications data family: the /notifications list, a notification's details, and the
 * two read-state writes (the same requests the page and the bell always sent).
 *
 *   const query = useListQuery<NotificationItem>(NOTIFICATIONS, request, { itemsKey: 'notifications' });
 *   const { data } = useNotificationDetails(12);
 *   await notificationWrites.markRead(12);
 *
 * Keys: ['notifications', 'list', null, params] → `/notifications?…`;
 *       ['notifications', 'details', id]       → `/notifications/:id/details`.
 * The top-bar bell keeps its own state (fed by the SSE stream); after a read-state write
 * the page announces it with NOTIFICATIONS_READ_EVENT so the bell's badge and panel follow
 * without another request.
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { invalidate } from './invalidate';
import { queryKeys, registerEndpoint, type QueryKey } from './keys';

export const NOTIFICATIONS = 'notifications';
/** The server returns at most 50 notifications per page. */
export const NOTIFICATION_PAGE_SIZES = [10, 25, 50] as const;
export const NOTIFICATION_MAX_PAGE_SIZE = 50;

registerEndpoint(NOTIFICATIONS, (action, id, params) => {
  if (action === 'details') return `/notifications/${id}/details`;
  const query = new URLSearchParams(params).toString();
  return `/notifications${query ? `?${query}` : ''}`;
});

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
  actor?: { id: number; name: string } | null;
  entityType?: string | null;
  entityId?: number | null;
  details?: NotificationDetails | null;
}

export interface NotificationTransactionRow {
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

export interface NotificationDetailResponse {
  notification: NotificationItem;
  transactions: NotificationTransactionRow[];
  entityMissing: boolean;
}

// ─────────────────────────────────────────────────────────────── display helpers

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

// ─────────────────────────────────────────────────────────────── reads

export const notificationKeys = {
  details: (id: number): QueryKey => queryKeys.action(NOTIFICATIONS, 'details', id),
};

/** Details of one notification, fetched when it is opened (cached for the next open). */
export function useNotificationDetails(id: number | null, config?: SWRConfiguration<NotificationDetailResponse>) {
  return useSWR<NotificationDetailResponse>(id ? notificationKeys.details(id) : null, config);
}

// ─────────────────────────────────────────────────────────────── writes

/**
 * What changed (one notification read, or all of them) and who changed it: the bell and
 * the notifications page each apply the other's changes (the bell in its own state, the
 * page by refetching its rows) and ignore their own.
 */
export type NotificationsReadDetail = ({ id: number } | { all: true }) & { source: 'page' | 'bell' };
export const NOTIFICATIONS_READ_EVENT = 'notifications:read';

export function announceNotificationsRead(detail: NotificationsReadDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NotificationsReadDetail>(NOTIFICATIONS_READ_EVENT, { detail }));
}

/**
 * PATCH /api/notifications exactly as the page always sent it (only a Content-Type header,
 * as the bell still does), but a failed status now throws so the page can roll back.
 */
async function patchNotifications(body: { id: number } | { markAll: true }): Promise<void> {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      message = (await res.json())?.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
}

/** The page's read-state writes. */
export const notificationWrites = {
  /** PATCH /api/notifications `{ id }`. */
  markRead: async (id: number): Promise<void> => {
    await patchNotifications({ id });
    announceNotificationsRead({ id, source: 'page' });
  },
  /** PATCH /api/notifications `{ markAll: true }`. */
  markAllRead: async (): Promise<void> => {
    await patchNotifications({ markAll: true });
    announceNotificationsRead({ all: true, source: 'page' });
  },
};

/** Refetch the notification lists on screen (after a read-state change). */
export function invalidateNotifications(): Promise<void> {
  return invalidate([NOTIFICATIONS, 'list']);
}
