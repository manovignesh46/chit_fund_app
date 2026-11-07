import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Updating…" marker for a server-computed figure while a write is being confirmed: the old
 * value stays, dimmed, until the refetch brings the server's value. Never compute the new
 * figure in the browser instead.
 */
export function Updating({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-flex items-center gap-2', className)} aria-busy={active || undefined}>
      <span className={cn('transition-opacity', active && 'opacity-40')}>{children}</span>
      {active ? (
        <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
          Updating…
        </span>
      ) : null}
    </span>
  );
}
