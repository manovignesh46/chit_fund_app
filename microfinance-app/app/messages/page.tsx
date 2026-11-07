'use client';

/**
 * Team chat. The shell gives /messages its full-height layout (nav-config `layout: 'full'`)
 * and the top bar its title and back link, so the page is only the chat: team list
 * (desktop), messages, composer. Live messages arrive on the SSE stream; older ones load
 * when the top of the list scrolls into view, keeping the reading position.
 */
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2, MessageSquare, SendHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

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

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function getDisplayName(sender: Sender) {
  if (sender.partner?.name) return sender.partner.name;
  if (sender.role === 'admin') return `${sender.name} (Admin)`;
  return sender.name;
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
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
  const initialScrollDoneRef = useRef(false);
  // Sentinel at the top of the list — when visible, triggers loading older messages
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
    } catch { /* non-critical */ }
  }, []);

  const fetchInitial = useCallback(async () => {
    try {
      const [msgRes, userRes] = await Promise.all([
        fetch('/api/messages?limit=30'),
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

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  useEffect(() => {
    const es = new EventSource('/api/messages/stream');
    eventSourceRef.current = es;
    es.addEventListener('chat_message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) { appendMessage(data.message); markRead(); }
      } catch { /* ignore */ }
    });
    es.onerror = () => { /* browser auto-reconnects */ };
    return () => { es.close(); eventSourceRef.current = null; };
  }, [appendMessage, markRead]);

  // Scroll to bottom on initial load + new messages
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

  useEffect(() => { adjustTextareaHeight(); }, [content]);

  // Load older messages, preserving scroll position (WhatsApp style)
  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const firstId = messages[0].id;
    const list = listRef.current;
    const prevScrollHeight = list?.scrollHeight ?? 0;

    try {
      const res = await fetch(`/api/messages?beforeId=${firstId}&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      const older: Message[] = data.messages || [];
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHasMore(data.hasMore || false);
        // After React re-renders, restore scroll so existing messages stay in place
        requestAnimationFrame(() => {
          if (list) {
            list.scrollTop = list.scrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages]);

  // IntersectionObserver on the top sentinel: fires loadOlder automatically
  useEffect(() => {
    if (!initialScrollDoneRef.current || loading) return;

    observerRef.current?.disconnect();

    if (!hasMore || !topSentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadOlder();
        }
      },
      { root: listRef.current, threshold: 0.1 }
    );

    observerRef.current.observe(topSentinelRef.current);

    return () => { observerRef.current?.disconnect(); };
  }, [hasMore, loading, loadOlder]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  const renderMessages = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-3 py-4" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
              <Skeleton className={cn('h-10 rounded-2xl', i % 2 === 0 ? 'w-40' : 'w-52')} />
            </div>
          ))}
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageSquare aria-hidden="true" className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground">Say hello to your team!</p>
        </div>
      );
    }

    const items: React.ReactNode[] = [];

    messages.forEach((msg, idx) => {
      const prevMsg = messages[idx - 1];
      // Insert a date separator when the day changes
      if (!prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt)) {
        items.push(
          <div key={`sep-${msg.id}`} className="flex items-center gap-3 py-2" role="separator" aria-label={formatDateSeparator(msg.createdAt)}>
            <div className="h-px flex-1 bg-border" />
            <span className="whitespace-nowrap px-1 text-xs font-medium text-muted-foreground">{formatDateSeparator(msg.createdAt)}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        );
      }

      const isOwn = msg.sender.id === currentUserId;
      items.push(
        <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
          <div className={cn('flex max-w-xs flex-col sm:max-w-md', isOwn ? 'items-end' : 'items-start')}>
            {!isOwn && <span className="mb-0.5 ml-1 text-xs font-medium text-muted-foreground">{getDisplayName(msg.sender)}</span>}
            <div
              className={cn(
                'rounded-2xl px-4 py-2 shadow-sm',
                isOwn ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-card text-card-foreground'
              )}
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-snug">{msg.content}</p>
              <p className={cn('mt-1 text-right text-xs', isOwn ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                {isOwn ? <span className="sr-only">You, </span> : null}
                {formatMessageTime(msg.createdAt)}
              </p>
            </div>
          </div>
        </div>
      );
    });

    return items;
  };

  return (
    // The shell gives /messages its full-height layout (nav-config `layout: 'full'`):
    // this fills the space between the top bar and the phone bottom bar.
    <div ref={containerRef} className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background sm:p-4">
      <h1 className="sr-only">Team chat</h1>
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-y bg-card text-card-foreground sm:rounded-xl sm:border sm:shadow-sm">
        {/* Who is in the chat (phones; desktop has the team list) */}
        {participants.length > 0 && (
          <p className="flex-shrink-0 truncate border-b px-3 py-2 text-xs text-muted-foreground md:hidden">
            <span className="font-medium text-foreground">Team:</span> {teamLabel}
          </p>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Team list (desktop) */}
          <div className="hidden w-52 flex-shrink-0 flex-col border-r bg-muted/40 p-4 md:flex">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team</h2>
            <p className="mb-3 text-xs text-muted-foreground">Chat with your partners</p>
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                  <span aria-hidden="true" className={cn('h-2 w-2 flex-shrink-0 rounded-full', p.role === 'admin' ? 'bg-primary' : 'bg-success')} />
                  <span className="truncate">
                    {p.partner?.name || p.name}
                    {p.role === 'admin' ? <span className="sr-only"> (admin)</span> : null}
                    {p.id === currentUserId && <span className="text-xs text-muted-foreground"> (you)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Message area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
            <div
              ref={listRef}
              role="log"
              aria-label="Messages"
              aria-busy={loading || loadingOlder || undefined}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4"
            >
              {/* Top sentinel — IntersectionObserver triggers loadOlder when this scrolls into view */}
              <div ref={topSentinelRef} className="h-px" />

              {/* Loading older spinner */}
              {loadingOlder && (
                <div className="flex justify-center py-3">
                  <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                    <Loader2 aria-hidden="true" className="h-3 w-3 motion-safe:animate-spin" />
                    Loading older messages…
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div role="alert" className="mb-2 flex items-start gap-2 rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
                  <span className="min-w-0 flex-1 break-words">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="-my-0.5 inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                </div>
              )}

              {/* Messages + date separators */}
              <div className="flex flex-col gap-1.5 sm:gap-2">{renderMessages()}</div>

              {/* Bottom spacer so last message isn't flush against input */}
              <div className="h-2" />
            </div>

            {/* Input bar */}
            <form
              onSubmit={handleSend}
              className="flex flex-shrink-0 items-end gap-2 border-t bg-card px-3 py-2.5 sm:px-5 sm:py-3"
              style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
            >
              <label htmlFor="chat-composer" className="sr-only">
                Message
              </label>
              <Textarea
                id="chat-composer"
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message"
                maxLength={2000}
                aria-describedby="chat-composer-hint"
                className="min-h-0 flex-1 resize-none overflow-hidden rounded-2xl px-4 py-2.5 leading-snug"
                style={{ maxHeight: '96px' }}
              />
              <span id="chat-composer-hint" className="sr-only">
                Use the Send button. On larger screens, Control or Command with Enter also sends.
              </span>
              <Button
                type="submit"
                size="icon"
                disabled={!content.trim() || sending}
                className="h-11 w-11 flex-shrink-0 rounded-full md:h-10 md:w-10"
                aria-label="Send message"
              >
                {sending ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : <SendHorizontal aria-hidden="true" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
