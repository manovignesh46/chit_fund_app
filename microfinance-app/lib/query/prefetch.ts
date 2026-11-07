/**
 * Prefetch a query before it is needed (row hover/touch, the next list page when idle).
 *
 *   prefetchQuery(loanKeys.detail(12));
 *
 * - The request is shared with the next SWR fetch of the same key within
 *   PREFETCH_TTL_MS (fetcher.ts), so hover-then-click sends one request, not two.
 * - When it resolves, the data primes the cache for a key that has nothing cached,
 *   so the destination paints at once; it still revalidates on mount as usual.
 * - Failures are silent: the page's own fetch reports errors.
 */
import { apiFetch, rememberPrefetch } from './fetcher';
import { primeCache } from './invalidate';
import { keyToEndpoint, type QueryKey } from './keys';

export function prefetchQuery(key: QueryKey): void {
  if (typeof window === 'undefined') return;
  const endpoint = keyToEndpoint(key);
  const promise = rememberPrefetch(endpoint, () => apiFetch(endpoint));
  if (!promise) return;
  promise.then((data) => primeCache(key, data)).catch(() => undefined);
}

/** Run `task` when the browser is idle (or after a short delay where idle callbacks are missing). */
export function whenIdle(task: () => void, timeout = 2_000): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (w.requestIdleCallback) {
    const handle = w.requestIdleCallback(task, { timeout });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(task, 300);
  return () => window.clearTimeout(timer);
}
