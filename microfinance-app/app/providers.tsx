'use client';

/**
 * Client providers for the whole app, mounted in app/layout.tsx inside
 * ThemeProvider and PartnerProvider:
 *   - NuqsAdapter: URL state (lib/list/useListParams, components/kit/url-tabs)
 *   - QueryProvider: SWR cache and defaults (lib/query)
 *   - Toaster: sonner, themed by app/theme; loaded after first paint so it stays
 *     out of the shared bundle
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { QueryProvider } from '@/lib/query/provider';
import { clearAllCaches } from '@/lib/query/invalidate';

const Toaster = dynamic(() => import('@/components/ui/sonner').then((mod) => mod.Toaster), { ssr: false });

/** Reaching /login (logout, expired session) drops every cached response. */
function ClearCacheOnLogin() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (pathname === '/login') clearAllCaches();
  }, [pathname]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryProvider>
        <ClearCacheOnLogin />
        {children}
        <Toaster />
      </QueryProvider>
    </NuqsAdapter>
  );
}
