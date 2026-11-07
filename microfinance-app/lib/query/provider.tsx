'use client';

/**
 * App-wide SWR configuration (mounted once in app/providers.tsx).
 *
 * - Cached data paints at once and is always revalidated on mount (never trusted as fresh).
 * - keepPreviousData: a list keeps its rows while the next page/filter loads.
 * - Background refresh failures on data that is already on screen raise a toast;
 *   first-load failures are left to the page (ErrorState).
 */
import * as React from 'react';
import { SWRConfig, useSWRConfig, type Cache, type SWRConfiguration } from 'swr';
import { CappedCache } from './cache';
import { queryFetcher } from './fetcher';
import { registerQueryClient } from './invalidate';

const MAX_KEYS = 200;

function notifyBackgroundError(error: unknown, key: string, cache: Cache): void {
  const entry = cache.get(key);
  if (!entry || entry.data === undefined) return;
  const message = error instanceof Error ? error.message : 'Could not refresh data';
  // sonner is loaded on demand so it stays out of the shared bundle.
  void import('sonner').then(({ toast }) =>
    toast.error('Could not refresh', { id: `swr-bg-${key}`, description: message })
  );
}

function ClientBridge() {
  const { mutate, cache } = useSWRConfig();
  React.useEffect(() => registerQueryClient(mutate, cache), [mutate, cache]);
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [cache] = React.useState(() => new CappedCache<never>(MAX_KEYS));

  const value = React.useMemo<SWRConfiguration>(
    () => ({
      provider: () => cache as unknown as Cache,
      fetcher: queryFetcher,
      keepPreviousData: true,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      focusThrottleInterval: 60_000,
      revalidateIfStale: true,
      errorRetryCount: 2,
      shouldRetryOnError: (error: unknown) => {
        const status = (error as { status?: number })?.status ?? 0;
        // Retry network failures and 5xx only; 4xx will not fix itself.
        return status === 0 || status >= 500;
      },
      onError: (error: unknown, key: string) => notifyBackgroundError(error, key, cache as unknown as Cache),
    }),
    [cache]
  );

  return (
    <SWRConfig value={value}>
      <ClientBridge />
      {children}
    </SWRConfig>
  );
}
