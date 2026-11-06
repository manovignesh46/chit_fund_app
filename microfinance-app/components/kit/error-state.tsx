import * as React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  /** An Error, a message, or anything thrown; its message is shown. */
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return null;
}

/** A load failure in place of content, with Retry. */
export function ErrorState({ title = "Couldn't load this", error, onRetry, retrying = false, compact = false, className, ...props }: ErrorStateProps) {
  const message = errorMessage(error);
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}
      {...props}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive-subtle text-destructive-text">
        <AlertCircle aria-hidden="true" className="h-5 w-5" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {message ? <p className="break-words text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden="true" className={cn(retrying && 'motion-safe:animate-spin')} />
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      ) : null}
    </div>
  );
}
