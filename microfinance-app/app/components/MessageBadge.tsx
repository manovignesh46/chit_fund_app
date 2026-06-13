'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function MessageBadge() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isOnMessagesPage = pathname === '/messages';

  useEffect(() => {
    const es = new EventSource('/api/messages/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', (event) => {
      setConnected(true);
      try {
        const data = JSON.parse(event.data);
        if (!isOnMessagesPage && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('chat_message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!isOnMessagesPage && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('unread_count', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!isOnMessagesPage && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isOnMessagesPage]);

  useEffect(() => {
    if (isOnMessagesPage) {
      setUnreadCount(0);
    }
  }, [isOnMessagesPage]);

  return (
    <Link
      href="/messages"
      className="relative p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
      aria-label="Messages"
    >
      <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-400" />
      {unreadCount > 0 && !isOnMessagesPage && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {connected && (
        <span
          className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"
          title="Live"
        />
      )}
    </Link>
  );
}
