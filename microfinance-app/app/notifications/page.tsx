// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const unreadParam = filter === 'unread' ? '&unreadOnly=true' : '';
      const response = await fetch(
        `/api/notifications?page=${currentPage}&pageSize=${pageSize}${unreadParam}`
      );
      if (!response.ok) throw new Error('Failed to load notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setUnreadCount(data.unreadCount || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, pageSize, filter]);

  const markAsRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      transaction: 'Transaction',
      contribution: 'Contribution',
      auction: 'Auction',
      loan_created: 'Loan',
      loan_repayment: 'Repayment',
      chit_fund_created: 'Chit Fund',
      member_created: 'Member',
    };
    return labels[type] || type;
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="flex-shrink-0 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 min-h-[44px] flex items-center"
          >
            Back
          </button>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="w-full sm:w-auto sm:self-start px-4 py-2.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 min-h-[44px]"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl sm:rounded-lg shadow-md overflow-hidden mb-4">
        <div className="p-3 sm:p-4 border-b flex gap-2">
          <button
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
            className={`flex-1 sm:flex-none px-4 py-2.5 text-sm rounded-lg min-h-[44px] ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter('unread'); setCurrentPage(1); }}
            className={`flex-1 sm:flex-none px-4 py-2.5 text-sm rounded-lg min-h-[44px] ${
              filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading notifications...</div>
        ) : error ? (
          <div className="p-3 m-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  onClick={() => handleClick(notification)}
                  className={`w-full text-left px-3 sm:px-4 py-3.5 sm:py-4 active:bg-gray-100 transition-colors min-h-[44px] ${
                    !notification.read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {!notification.read && (
                      <span className="mt-2 w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                    <div className={`flex-1 min-w-0 ${notification.read ? 'ml-[18px] sm:ml-5' : ''}`}>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 leading-snug">
                          {notification.title}
                        </span>
                        <span className="self-start text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">
                          {getTypeLabel(notification.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed break-words">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {notification.actor?.name && (
                          <span className="block sm:inline">By {notification.actor.name}</span>
                        )}
                        {notification.actor?.name && (
                          <span className="hidden sm:inline"> · </span>
                        )}
                        <span className="block sm:inline mt-0.5 sm:mt-0">
                          <span className="sm:hidden">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                          <span className="hidden sm:inline">
                            {format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}
                            {' · '}
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </span>
                      </p>
                    </div>
                    {notification.link && (
                      <span className="text-xs text-blue-600 flex-shrink-0 mt-1 sm:mt-0">→</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm rounded-lg bg-gray-200 disabled:opacity-50 min-h-[44px]"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 px-2 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm rounded-lg bg-gray-200 disabled:opacity-50 min-h-[44px]"
            >
              Next
            </button>
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="w-full sm:w-auto text-base sm:text-sm border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px]"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      )}
    </div>
  );
}
