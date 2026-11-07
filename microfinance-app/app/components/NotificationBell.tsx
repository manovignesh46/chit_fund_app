'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { announceNotificationsRead, notificationSummary, NOTIFICATIONS_READ_EVENT, type NotificationItem, type NotificationsReadDetail } from '@/lib/query/notifications';

// The detail sheet (Radix dialog) loads on the first opened notification, not with the shell.
const NotificationDetailSheet = dynamic(() => import('./NotificationDetailSheet'), { ssr: false });

type Notification = NotificationItem;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([] as Notification[]);
  // Latest list for event handlers (read outside state updaters).
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [openNotification, setOpenNotification] = useState(null as Notification | null);
  const [sheetUsed, setSheetUsed] = useState(false);
  const dropdownRef = useRef(null as HTMLDivElement | null);
  const bellRef = useRef(null as HTMLButtonElement | null);
  const eventSourceRef = useRef(null as EventSource | null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=15');
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource('/api/notifications/stream');
      eventSourceRef.current = es;

      es.addEventListener('connected', (event) => {
        setConnected(true);
        try {
          const data = JSON.parse(event.data);
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.notification) {
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === data.notification.id);
              if (exists) return prev;
              return [data.notification, ...prev].slice(0, 15);
            });
          }
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        } catch {
          // fallback refetch
          fetchNotifications();
        }
      });

      es.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchNotifications]);

  // The notifications page marks notifications read too: follow it without a refetch.
  useEffect(() => {
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<NotificationsReadDetail>).detail;
      if (!detail || detail.source === 'bell') return;
      if ('all' in detail) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        return;
      }
      const hit = notificationsRef.current.find((n) => n.id === detail.id);
      if (!hit) {
        // Older than the bell's latest 15: only the server knows the new unread count.
        void fetchNotifications();
        return;
      }
      if (hit.read) return;
      setNotifications((prev) => prev.map((n) => (n.id === detail.id ? { ...n, read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
    };
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes the panel and returns focus to the bell.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      bellRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      announceNotificationsRead({ id, source: 'bell' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      announceNotificationsRead({ all: true, source: 'bell' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Open the details in place; navigating is an explicit action inside the sheet.
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    setSheetUsed(true);
    setOpenNotification({ ...notification, read: true });
  };

  const closeDetails = useCallback(() => setOpenNotification(null), []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={bellRef}
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-sidebar-accent"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {connected && (
          <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full border border-sidebar bg-success" title="Live" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 top-[calc(var(--topbar-height)+0.5rem)] z-50 w-auto max-w-[calc(100vw-1.5rem)] rounded-xl border bg-popover text-popover-foreground shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-none md:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-sm text-xs font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-80">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : (
              notifications.map((notification) => {
                const { message, reason } = notificationSummary(notification);
                const unread = !notification.read;
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'min-h-[44px] w-full border-b border-l-2 px-3 py-3.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4',
                      unread ? 'border-l-primary bg-primary-subtle/60' : 'border-l-transparent'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                      <div className={cn('min-w-0', !unread && 'ml-4')}>
                        <p className={cn('text-sm text-foreground', unread ? 'font-semibold' : 'font-normal')}>{notification.title}</p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{message}</p>
                        {reason && (
                          <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Reason:</span> {reason}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-b-xl border-t bg-muted/50 px-3 py-3 sm:px-4">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-md py-2 text-center text-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
      {sheetUsed ? <NotificationDetailSheet notification={openNotification} onClose={closeDetails} returnFocusRef={bellRef} /> : null}
    </div>
  );
}
