'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/kit/error-state';

/** Error boundary for every page below the root layout (the shell stays usable). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border bg-card shadow-sm">
        <ErrorState
          title="Something went wrong on this page"
          error={process.env.NODE_ENV === 'production' ? 'The page hit an unexpected error. Try again, or go back to the dashboard.' : error}
          onRetry={reset}
        />
        <div className="flex justify-center border-t px-4 py-3">
          <Button asChild variant="link">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
        {error.digest ? <p className="pb-4 text-center text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
