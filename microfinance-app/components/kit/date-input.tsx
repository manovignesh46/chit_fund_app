import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> {
  /** "YYYY-MM-DD" or "" */
  value?: string;
  defaultValue?: string;
  /** Called with "YYYY-MM-DD" (or "" when cleared). */
  onValueChange?: (value: string) => void;
}

/**
 * Native date picker (<input type="date">) with the kit field style; the OS picker
 * is the most reliable choice on phones. `data-ui` opts it out of the legacy
 * dark-mode rules; `color-scheme` keeps the picker readable in both themes.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, onChange, onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      type="date"
      data-ui=""
      className={cn(
        'flex h-11 w-full rounded-md border border-input bg-field px-3 py-1 text-base tabular-nums text-foreground shadow-sm transition-colors [color-scheme:light] dark:[color-scheme:dark]',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:h-9 md:text-sm',
        className
      )}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.target.value);
      }}
      {...props}
    />
  )
);
DateInput.displayName = 'DateInput';
