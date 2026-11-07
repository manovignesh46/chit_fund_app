'use client';

/**
 * Opens a notification in place: a side panel on desktop, a bottom sheet on phones
 * (Radix sheet: focus trap, Escape, backdrop click, scroll lock). Details come from
 * GET /api/notifications/:id/details each time one is opened (cached for a re-open,
 * always revalidated). Navigating is an explicit action (the link button at the bottom).
 *
 * Used by the notifications page and the top-bar bell; both load it with next/dynamic
 * so the dialog code stays out of first paint.
 */
import * as React from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { notificationSummary, notificationTypeLabel, useNotificationDetails, type NotificationItem } from '@/lib/query/notifications';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/components/kit/error-state';

export type { NotificationDetails, NotificationItem } from '@/lib/query/notifications';
export { notificationSummary, notificationTypeLabel } from '@/lib/query/notifications';

function linkLabel(link: string) {
  if (link.startsWith('/transactions')) return 'Open in Transactions';
  if (link.startsWith('/loans')) return 'Open loan';
  if (link.startsWith('/chit-funds')) return 'Open chit fund';
  if (link.startsWith('/members')) return 'Open member';
  return 'Open';
}

const money2 = (n: number) => formatMoney(n, { decimals: 2 });

interface Props {
  notification: NotificationItem | null;
  onClose: () => void;
  /** Where focus goes on close (default: what had focus when the sheet opened). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function NotificationDetailSheet({ notification, onClose, returnFocusRef }: Props) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const open = notification !== null;

  // Keep showing the last notification while the sheet animates closed.
  const [shown, setShown] = React.useState<NotificationItem | null>(notification);
  React.useEffect(() => {
    if (notification) setShown(notification);
  }, [notification]);

  // What had focus as it opens (read during render, before Radix moves focus inside).
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = open;

  const details = useNotificationDetails(notification?.id ?? null);
  const current = notification ?? shown;
  if (!current) return null;

  const data = notification && details.data?.notification?.id === notification.id ? details.data : undefined;
  const n = data?.notification ?? current;
  const d = n.details || null;
  const { message, reason } = notificationSummary(n);
  const transactions = data?.transactions ?? [];
  const loading = open && !data && !details.error;
  const loadError = open && !data ? errorMessage(details.error) : null;

  // Balance after each affected partner's row
  const balances = transactions
    .filter((t) => t.partnerBalance !== null)
    .map((t) => ({ id: t.id, partner: t.to_partner || t.from_partner || '—', balance: t.partnerBalance as number }));
  const totalBalance = transactions.length ? transactions[transactions.length - 1].totalBalance : null;

  const amountClass = d?.direction === 'credit' ? 'text-success-text' : d?.direction === 'debit' ? 'text-destructive-text' : 'text-foreground';
  const created = new Date(n.createdAt);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 p-0', isDesktop ? 'w-full sm:max-w-[420px]' : 'max-h-[88dvh]')}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current ?? previousFocus.current;
          if (target && target.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <SheetHeader className="space-y-1.5 border-b px-4 pb-3 pr-14 pt-4 text-left sm:px-5 sm:pt-5">
          <span className="inline-flex w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {notificationTypeLabel(n.type)}
          </span>
          <SheetTitle>{n.title}</SheetTitle>
          <SheetDescription className="sr-only">Notification details</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {d?.amount !== undefined ? (
            <div>
              <p className={cn('text-3xl font-bold tabular-nums', amountClass)}>
                {d.direction === 'credit' ? '+' : d.direction === 'debit' ? '−' : ''}
                {money2(d.amount)}
              </p>
              {d.direction === 'transfer' ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{d.fromPartner}</span>
                  <span aria-hidden="true" className="mx-2">→</span>
                  <span className="sr-only"> to </span>
                  <span className="font-medium text-foreground">{d.toPartner}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.direction === 'credit' ? 'Credited to' : 'Debited from'}{' '}
                  <span className="font-medium text-foreground">{d.toPartner || d.fromPartner}</span>
                </p>
              )}
            </div>
          ) : null}

          {reason ? (
            <div className="rounded-lg border-l-4 border-primary bg-info-subtle px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-info-text">Reason</p>
              <p className="break-words text-sm text-foreground">{reason}</p>
            </div>
          ) : (
            <p className="break-words text-sm text-muted-foreground">{message}</p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {d?.date ? (
              <>
                <dt className="text-muted-foreground">Transaction date</dt>
                <dd className="text-foreground">{format(new Date(d.date), 'dd MMM yyyy')}</dd>
              </>
            ) : null}
            {d?.enteredBy ? (
              <>
                <dt className="text-muted-foreground">Entered as</dt>
                <dd className="text-foreground">{d.enteredBy}</dd>
              </>
            ) : null}
            {n.actor?.name ? (
              <>
                <dt className="text-muted-foreground">Recorded by</dt>
                <dd className="text-foreground">{n.actor.name}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Recorded</dt>
            <dd className="text-foreground">
              {format(created, 'dd MMM yyyy, h:mm a')}
              <span className="text-muted-foreground"> · {formatDistanceToNow(created, { addSuffix: true })}</span>
            </dd>
          </dl>

          {loading ? (
            <div className="space-y-2" role="status" aria-label="Loading details">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : null}
          {loadError ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-text">
              {loadError}
            </p>
          ) : null}
          {data?.entityMissing ? (
            <p className="rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-text">
              This transaction no longer exists. It may have been deleted after this notification was sent.
            </p>
          ) : null}

          {balances.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance after this entry</p>
              <div className="divide-y rounded-lg border">
                {balances.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{b.partner}</span>
                    <span className={cn('font-medium tabular-nums', b.balance < 0 ? 'text-destructive-text' : 'text-foreground')}>{money2(b.balance)}</span>
                  </div>
                ))}
                {totalBalance !== null ? (
                  <div className="flex items-center justify-between bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Total (all partners)</span>
                    <span className="font-semibold tabular-nums text-foreground">{money2(totalBalance)}</span>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Running balances as stored when the entry was saved.</p>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          {n.link && !data?.entityMissing ? (
            <Button asChild className="flex-1">
              <Link href={n.link} onClick={onClose}>
                {linkLabel(n.link)}
              </Link>
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
