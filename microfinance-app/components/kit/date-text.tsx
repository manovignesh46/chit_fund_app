import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatDate, toIsoDate, type DateInput } from '@/lib/format';

export interface DateTextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  value: DateInput;
  withTime?: boolean;
  /** Shown for missing or invalid dates. Default "—". */
  fallback?: string;
}

/** A date as "06 Nov 2026" in a <time> element. */
export function DateText({ value, withTime = false, fallback = '—', className, ...props }: DateTextProps) {
  const iso = toIsoDate(value);
  if (!iso) {
    return (
      <span className={cn('text-muted-foreground', className)} {...props}>
        {fallback}
      </span>
    );
  }
  return (
    <time dateTime={iso} className={cn('tabular-nums whitespace-nowrap', className)} {...props}>
      {formatDate(value, { withTime })}
    </time>
  );
}
