'use client';

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import Link from 'next/link';
import { format, isToday, isYesterday } from 'date-fns';
import { PaperAirplaneIcon, ChevronLeftIcon } from '@heroicons/react/24/solid';

interface Sender {
  id: number;
  name: string;
  role: string;
  partner?: { id: number; name: string } | null;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  sender: Sender;
}

interface Participant {
  id: number;
  name: string;
  role: string;
  partner?: { id: number; name: string } | null;
}

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, h:mm a');
}

function getDisplayName(sender: Sender) {
  if (sender.partner?.name) return sender.partner.name;
  if (sender.role === 'admin') return `${sender.name} (Admin)`;
  return sender.name;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingScrollRef = useRef(false);

  const HEADER_HEIGHT = 64;

  const updateChatLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.innerWidth >= 640) {
      el.style.top = '';
      el.style.height = '';
      el.style.bottom = '';
      return;
    }

    const vv = window.visualViewport;
    if (!vv) {
      el.style.top = `${HEADER_HEIGHT}px`;
      el.style.bottom = '0';
      el.style.height = '';
      return;
    }

    el.style.top = `${vv.offsetTop + HEADER_HEIGHT}px`;
    el.style.height = `${vv.height - HEADER_HEIGHT}px`;
    el.style.bottom = 'auto';
  }, []);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const initialScrollDoneRef = useRef(false);

  const scrollToBottom = useCallback((instant = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  }, []);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  const markRead = useCallback(async () => {
    try {
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markRead: true }),
      });
    } catch {
      // non-critical
    }
  }, []);

  const fetchInitial = useCallback(async () => {
    try {
      const [msgRes, userRes] = await Promise.all([
        fetch('/api/messages?limit=50'),
        fetch('/api/user?action=me'),
      ]);
      if (!msgRes.ok) throw new Error('Failed to load messages');
      const data = await msgRes.json();
      setMessages(data.messages || []);
      setParticipants(data.participants || []);
      setHasMore(data.hasMore || false);
      setError(null);

      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUserId(userData.id);
      }

      await markRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [markRead]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      pendingScrollRef.current = true;
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    const es = new EventSource('/api/messages/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      // live connection established
    });

    es.addEventListener('chat_message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          appendMessage(data.message);
          markRead();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // browser auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [appendMessage, markRead]);

  useLayoutEffect(() => {
    if (loading) return;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      pendingScrollRef.current = false;
      scrollToBottom(true);
      requestAnimationFrame(() => scrollToBottom(true));
      return;
    }

    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content]);

  // Keep chat pinned below header when mobile keyboard opens/closes
  useEffect(() => {
    updateChatLayout();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateChatLayout);
    vv?.addEventListener('scroll', updateChatLayout);
    window.addEventListener('resize', updateChatLayout);

    return () => {
      vv?.removeEventListener('resize', updateChatLayout);
      vv?.removeEventListener('scroll', updateChatLayout);
      window.removeEventListener('resize', updateChatLayout);
    };
  }, [updateChatLayout]);

  const handleInputBlur = () => {
    setTimeout(updateChatLayout, 50);
    setTimeout(updateChatLayout, 300);
  };

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const firstId = messages[0].id;
    const prevHeight = listRef.current?.scrollHeight ?? 0;

    try {
      const res = await fetch(`/api/messages?beforeId=${firstId}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      const older: Message[] = data.messages || [];
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHasMore(data.hasMore || false);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop += listRef.current.scrollHeight - prevHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send');
      }
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          pendingScrollRef.current = true;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      setContent(text);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && window.innerWidth >= 640) {
      e.preventDefault();
      handleSend();
    }
  };

  const teamLabel = participants
    .map((p) => {
      const name = p.partner?.name || p.name;
      return p.id === currentUserId ? `${name} (you)` : name;
    })
    .join(' · ');

  const renderMessageList = () => {
    if (loading) {
      return <div className="text-center text-gray-500 text-sm py-6">Loading...</div>;
    }
    if (messages.length === 0) {
      return (
        <div className="text-center text-gray-500 text-sm py-6 px-4">
          No messages yet. Say hello!
        </div>
      );
    }

    return (
      <>
        {hasMore && (
          <div className="text-center pb-3">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="text-xs text-blue-600 dark:text-blue-400 bg-white dark:bg-surface-elevated px-3 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-surface-border disabled:opacity-50"
            >
              {loadingOlder ? 'Loading...' : 'Load older'}
            </button>
          </div>
        )}

        <div className="space-y-2 sm:space-y-3">
          {messages.map((msg) => {
            const isOwn = msg.sender.id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col max-w-xs sm:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="text-xs font-medium text-gray-500 dark:text-theme-muted mb-0.5 ml-1">
                      {getDisplayName(msg.sender)}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 shadow-sm ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'themed-card text-gray-900 dark:text-theme-primary rounded-bl-sm border border-gray-100 dark:border-surface-border'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                      {msg.content}
                    </p>
                    <p className={`text-xs mt-1 text-right ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-theme-muted'}`}>
                      {formatMessageTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`messages-fullscreen flex min-h-0 w-full flex-1 flex-col overflow-hidden ${
        isMobile
          ? 'fixed bottom-0 left-0 right-0 z-10 bg-gray-100 dark:bg-surface'
          : 'bg-gray-50 dark:bg-surface-elevated p-4'
      }`}
      style={isMobile ? { top: `${HEADER_HEIGHT}px` } : undefined}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-surface-border themed-card shadow-sm">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 dark:border-surface-border px-3 py-2.5 sm:px-5 sm:py-3">
          <Link
            href="/dashboard"
            className="rounded-full p-2 text-gray-700 dark:text-theme-secondary hover:bg-gray-50 dark:hover:bg-surface-hover sm:hidden"
            aria-label="Back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-gray-900 dark:text-theme-primary sm:text-xl">Team Chat</h1>
            {participants.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                <span className="sm:hidden">{teamLabel}</span>
                <span className="hidden sm:inline">Chat with your partners</span>
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="hidden flex-shrink-0 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:border-surface-border dark:bg-surface-hover dark:text-theme-secondary dark:hover:bg-surface-border sm:flex"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="hidden w-52 flex-shrink-0 flex-col border-r border-gray-100 bg-gray-50 dark:bg-surface-elevated p-4 md:flex">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Team</h2>
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-theme-secondary">
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      p.role === 'admin' ? 'bg-purple-500' : 'bg-green-500'
                    }`}
                  />
                  <span className="truncate">
                    {p.partner?.name || p.name}
                    {p.id === currentUserId && <span className="text-xs text-gray-400"> (you)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-100 dark:bg-surface sm:themed-card">
            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4"
            >
              {error && (
                <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span className="break-words">{error}</span>
                  <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
                </div>
              )}
              {renderMessageList()}
            </div>

            <form
              onSubmit={handleSend}
              className="flex flex-shrink-0 items-end gap-2 border-t border-gray-200 dark:border-surface-border themed-card px-3 py-2.5 sm:px-5 sm:py-3"
              style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            >
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={updateChatLayout}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message"
                maxLength={2000}
                className="flex-1 resize-none overflow-hidden rounded-2xl border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-elevated px-4 py-2.5 text-base leading-snug focus:themed-card focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                style={{ maxHeight: '96px' }}
              />
              <button
                type="submit"
                disabled={!content.trim() || sending}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
