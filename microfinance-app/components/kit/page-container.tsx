import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use the full width instead of the 80rem cap (wide reports, the calendar). */
  wide?: boolean;
  /** Shown while URL-dependent content resolves. Default: a header-and-rows skeleton. */
  fallback?: React.ReactNode;
}

/** Generic page placeholder: header, toolbar, table rows. Matches the list template's layout. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-9 w-28 sm:block" />
      </div>
      <Skeleton className="h-11 w-full max-w-sm md:h-9" />
      <div className="overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-12 items-center gap-4 border-b px-4 last:border-b-0">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The page body wrapper: max width 80rem, padding 16/24/32px.
 * Also the Suspense boundary that URL state (useSearchParams via nuqs) needs
 * under the root layout's `force-static`.
 */
export function PageContainer({ wide = false, fallback, className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8', !wide && 'max-w-7xl', className)}
      {...props}
    >
      <React.Suspense fallback={fallback ?? <PageSkeleton />}>{children}</React.Suspense>
    </div>
  );
}
