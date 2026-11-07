'use client';

/**
 * Notifications (List template). List state is in the URL: `status=unread`, page,
 * pageSize (10/25/50: the server sends at most 50). Opening a notification marks it read
 * and shows its details in a sheet; navigating is an explicit action inside the sheet.
 * Read-state writes update the rows in place and tell the top-bar bell (no refetch).
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import { format, formatDistanceToNow } from 'date-fns';
import { BellOff, CheckCheck, ChevronRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { normaliseListResponse, useListQuery } from '@/lib/list/useListQuery';
import { queryKeys } from '@/lib/query/keys';
import { prefetchQuery, whenIdle } from '@/lib/query/prefetch';
import {
  NOTIFICATION_MAX_PAGE_SIZE,
  NOTIFICATION_PAGE_SIZES,
  NOTIFICATIONS,
  NOTIFICATIONS_READ_EVENT,
  notificationSummary,
  notificationTypeLabel,
  notificationWrites,
  type NotificationItem,
  type NotificationsReadDetail,
} from '@/lib/query/notifications';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshProgress } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { formatRange, ListPagination } from '@/components/kit/list-pagination';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SegmentedControl } from '@/components/kit/period-picker';

const NotificationDetailSheet = dynamic(() => import('../components/NotificationDetailSheet'), { ssr: false });

const FILTERS = ['status'] as const;
type Filter = (typeof FILTERS)[number];

interface RawList {
  notifications?: NotificationItem[];
  unreadCount?: number;
  [key: string]: unknown;
}

export default function NotificationsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <Notifications />
    </PageContainer>
  );
}

function Notifications() {
  const list = useListParams<Filter>({ id: 'notifications', filters: FILTERS });
  const p = list.params;
  const unreadOnly = p.status === 'unread';
  const pageSize = Math.min(p.pageSize, NOTIFICATION_MAX_PAGE_SIZE);

  // The page URL says `status=unread`; the API's name for it is `unreadOnly=true`.
  const request = React.useMemo(() => {
    const out: Record<string, string | number> = { page: p.page, pageSize };
    if (unreadOnly) out.unreadOnly = 'true';
    return out;
  }, [p.page, pageSize, unreadOnly]);

  const query = useListQuery<NotificationItem, { unreadCount: number }>(
    NOTIFICATIONS,
    { apiParams: request, ready: list.ready, setParams: list.setParams },
    {
      select: (raw, req) => {
        const base = normaliseListResponse<NotificationItem>(raw, req, 'notifications');
        return { ...base, summary: { unreadCount: Number((raw as RawList)?.unreadCount) || 0 } };
      },
    }
  );
  const meta = query.meta;
  const unreadCount = query.summary?.unreadCount ?? 0;
  const [open, setOpen] = React.useState<NotificationItem | null>(null);
  const [sheetUsed, setSheetUsed] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  // Preload the next page once this one has settled.
  React.useEffect(() => {
    if (!list.ready || !meta?.hasNext || query.isRefreshing) return;
    const next = queryKeys.list(NOTIFICATIONS, { ...request, page: meta.page + 1 });
    return whenIdle(() => prefetchQuery(next));
  }, [list.ready, request, meta, query.isRefreshing]);

  // Marked read from the top-bar bell: refetch this page's rows and count.
  const { mutate } = query;
  React.useEffect(() => {
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<NotificationsReadDetail>).detail;
      if (detail && detail.source !== 'page') void mutate();
    };
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
  }, [mutate]);

  /** Update the rows on screen without a refetch (as the page always did). */
  const patchRows = (change: (n: NotificationItem) => NotificationItem, unread: (count: number) => number) =>
    query.mutate(
      (raw) => {
        const body = raw as RawList | undefined;
        if (!body || !Array.isArray(body.notifications)) return raw;
        return { ...body, notifications: body.notifications.map(change), unreadCount: unread(Number(body.unreadCount) || 0) };
      },
      { revalidate: false }
    );

  const markRead = async (notification: NotificationItem) => {
    void patchRows((n) => (n.id === notification.id ? { ...n, read: true } : n), (count) => Math.max(0, count - 1));
    try {
      await notificationWrites.markRead(notification.id);
    } catch (error) {
      void query.mutate();
      toast.error("Couldn't mark the notification as read", { description: errorMessage(error) ?? 'Please try again.' });
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    void patchRows((n) => ({ ...n, read: true }), () => 0);
    try {
      await notificationWrites.markAllRead();
      toast.success('All notifications marked as read');
    } catch (error) {
      void query.mutate();
      toast.error("Couldn't mark all as read", { description: errorMessage(error) ?? 'Please try again.' });
    } finally {
      setMarkingAll(false);
    }
  };

  // Open the details in place; navigating is an explicit action inside the sheet.
  const openNotification = (notification: NotificationItem) => {
    if (!notification.read) void markRead(notification);
    setSheetUsed(true);
    setOpen({ ...notification, read: true });
  };
  const closeSheet = React.useCallback(() => setOpen(null), []);

  const rows = query.items;
  const busy = query.isRefreshing;

  let body: React.ReactNode;
  if (query.isInitialLoading) {
    body = (
      <ul aria-hidden="true" className="divide-y">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="space-y-2 px-4 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </li>
        ))}
      </ul>
    );
  } else if (query.error && rows.length === 0) {
    body = <ErrorState title="Couldn't load notifications" error={query.error} onRetry={() => void query.mutate()} />;
  } else if (rows.length === 0) {
    body = unreadOnly ? (
      <EmptyState
        variant="no-results"
        icon={CheckCheck}
        title="No unread notifications"
        description="You're all caught up."
        onClearFilters={list.clearFilters}
      />
    ) : (
      <EmptyState icon={BellOff} title="No notifications yet" description="Transactions, payments and new records by your partners show up here." />
    );
  } else {
    body = (
      <ul className={cn('divide-y transition-opacity', busy && 'opacity-60')} aria-busy={busy || undefined}>
        {rows.map((notification) => (
          <li key={notification.id}>
            <NotificationRow notification={notification} onOpen={openNotification} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        count={meta?.totalCount}
        description={unreadCount > 0 ? `${unreadCount.toLocaleString('en-IN')} unread` : undefined}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={() => void markAllRead()} disabled={markingAll} className="w-full sm:w-auto">
              {markingAll ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : <CheckCheck aria-hidden="true" />}
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Show"
          value={unreadOnly ? 'unread' : 'all'}
          onChange={(value) => list.setParams({ status: value === 'unread' ? 'unread' : null })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount.toLocaleString('en-IN')})` : 'Unread' },
          ]}
        />
        {meta && meta.totalCount > 0 ? (
          <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
            {formatRange(meta.page, meta.pageSize, meta.totalCount)}
          </p>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <RefreshProgress active={busy} />
        {body}
      </div>

      {meta && meta.totalCount > 0 ? (
        <ListPagination
          className="mt-4"
          page={meta.page}
          pageSize={pageSize}
          totalCount={meta.totalCount}
          pageSizes={NOTIFICATION_PAGE_SIZES}
          onPageChange={(page) => list.setParams({ page })}
          onPageSizeChange={(size) => list.setParams({ pageSize: size })}
        />
      ) : null}

      {sheetUsed ? <NotificationDetailSheet notification={open} onClose={closeSheet} /> : null}
    </div>
  );
}

function NotificationRow({ notification, onOpen }: { notification: NotificationItem; onOpen: (n: NotificationItem) => void }) {
  const unread = !notification.read;
  const { message, reason } = notificationSummary(notification);
  const created = new Date(notification.createdAt);
  const relative = formatDistanceToNow(created, { addSuffix: true });
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex min-h-[44px] w-full items-start gap-3 border-l-2 px-3 py-3.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4 sm:py-4',
        unread ? 'border-l-primary bg-primary-subtle/60' : 'border-l-transparent'
      )}
    >
      <span aria-hidden="true" className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} />
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className={cn('text-sm leading-snug text-foreground', unread ? 'font-semibold' : 'font-medium')}>
            {unread ? <span className="sr-only">Unread: </span> : null}
            {notification.title}
          </span>
          <span className="self-start whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {notificationTypeLabel(notification.type)}
          </span>
        </span>
        <span className="block break-words text-sm leading-relaxed text-muted-foreground">{message}</span>
        {reason ? (
          <span className="mt-0.5 block break-words text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Reason:</span> {reason}
          </span>
        ) : null}
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {notification.actor?.name ? <span className="block sm:inline">By {notification.actor.name}</span> : null}
          {notification.actor?.name ? <span className="hidden sm:inline"> · </span> : null}
          <span className="mt-0.5 block sm:mt-0 sm:inline">
            <span className="sm:hidden">{relative}</span>
            <span className="hidden sm:inline">
              <time dateTime={created.toISOString()}>{format(created, 'MMM d, yyyy h:mm a')}</time> · {relative}
            </span>
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
