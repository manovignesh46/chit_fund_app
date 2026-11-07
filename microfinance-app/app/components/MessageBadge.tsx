'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';

export default function MessageBadge() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isOnMessagesPage = pathname === '/messages';

  // Read through a ref so moving to and from /messages does not reopen the stream:
  // the shell mounts this once and the connection stays up across navigation.
  const onMessagesPageRef = useRef(isOnMessagesPage);
  onMessagesPageRef.current = isOnMessagesPage;

  useEffect(() => {
    const es = new EventSource('/api/messages/stream');
    eventSourceRef.current = es;

    const applyCount = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (!onMessagesPageRef.current && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore
      }
    };

    es.addEventListener('connected', (event) => {
      setConnected(true);
      applyCount(event as MessageEvent);
    });
    es.addEventListener('chat_message', applyCount);
    es.addEventListener('unread_count', applyCount);

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isOnMessagesPage) {
      setUnreadCount(0);
    }
  }, [isOnMessagesPage]);

  return (
    <Link
      href="/messages"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-text"
      aria-label={unreadCount > 0 && !isOnMessagesPage ? `Messages, ${unreadCount} unread` : 'Messages'}
      aria-current={isOnMessagesPage ? 'page' : undefined}
    >
      <MessagesSquare aria-hidden="true" className="h-5 w-5" />
      {unreadCount > 0 && !isOnMessagesPage && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {connected && (
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full border border-sidebar bg-success"
          title="Live"
        />
      )}
    </Link>
  );
}
