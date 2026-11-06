import * as React from 'react';
import { Inbox, SearchX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * 'no-data': nothing exists yet (offer the Create action).
   * 'no-results': filters/search matched nothing (offer Clear filters).
   */
  variant?: 'no-data' | 'no-results';
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Primary action, e.g. <Button asChild><Link href="/loans/new">New loan</Link></Button>. */
  action?: React.ReactNode;
  /** For 'no-results': renders a "Clear filters" button. */
  onClearFilters?: () => void;
  compact?: boolean;
}

export function EmptyState({ variant = 'no-data', title, description, icon, action, onClearFilters, compact = false, className, ...props }: EmptyStateProps) {
  const Icon = icon ?? (variant === 'no-results' ? SearchX : Inbox);
  const heading = title ?? (variant === 'no-results' ? 'No matching results' : 'Nothing here yet');
  const text =
    description ?? (variant === 'no-results' ? 'Try a different search or clear the filters.' : undefined);
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}
      {...props}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">{heading}</p>
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
      </div>
      {action || (variant === 'no-results' && onClearFilters) ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {variant === 'no-results' && onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
