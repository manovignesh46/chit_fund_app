'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import NotificationDetailSheet, { notificationSummary, type NotificationItem } from './NotificationDetailSheet';

type Notification = NotificationItem;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([] as Notification[]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [openNotification, setOpenNotification] = useState(null as Notification | null);
  const dropdownRef = useRef(null as HTMLDivElement | null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setOpenNotification({ ...notification, read: true });
  };

  const closeDetails = useCallback(() => setOpenNotification(null), []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {connected && (
          <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-surface-card" title="Live" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 md:w-96 max-w-[calc(100vw-1.5rem)] sm:max-w-none themed-card border border-gray-200 dark:border-surface-border z-50 shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-surface-border">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-theme-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet</div>
            ) : (
              notifications.map((notification) => {
                const { message, reason } = notificationSummary(notification);
                const unread = !notification.read;
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-3 sm:px-4 py-3.5 border-b border-l-2 border-b-gray-100 dark:border-b-surface-border transition-colors min-h-[44px] hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-surface-hover dark:active:bg-surface-hover ${
                      unread ? 'border-l-blue-500 bg-blue-50/60 dark:bg-blue-500/10' : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {unread && (
                        <span className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" aria-label="Unread" />
                      )}
                      <div className={`min-w-0 ${unread ? '' : 'ml-4'}`}>
                        <p className={`text-sm text-gray-900 dark:text-theme-primary ${unread ? 'font-semibold' : 'font-normal'}`}>{notification.title}</p>
                        <p className="text-xs text-gray-700 dark:text-theme-secondary mt-0.5 break-words">{message}</p>
                        {reason && (
                          <p className="text-xs text-gray-600 dark:text-theme-secondary mt-0.5 line-clamp-2 break-words">
                            <span className="font-medium text-gray-500 dark:text-theme-muted">Reason:</span> {reason}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-theme-muted mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 sm:px-4 py-3 border-t border-gray-100 dark:border-surface-border bg-gray-50 dark:bg-surface-elevated rounded-b-lg">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 min-h-[44px] flex items-center justify-center"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
      <NotificationDetailSheet notification={openNotification} onClose={closeDetails} />
    </div>
  );
}
