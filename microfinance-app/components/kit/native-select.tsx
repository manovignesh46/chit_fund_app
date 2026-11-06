import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: NativeSelectOption[];
  /** Adds a first, empty option with this text. */
  placeholder?: string;
  /** 'sm' for toolbars and rows-per-page. */
  size?: 'sm' | 'md';
  /** Called with the new value (alongside onChange). */
  onValueChange?: (value: string) => void;
}

/**
 * A styled native <select>: best on phones (OS picker) and for short fixed lists.
 * `data-ui` opts it out of the legacy dark-mode field rules in styles/theme/base.css.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ options, placeholder, size = 'md', className, children, onChange, onValueChange, ...props }, ref) => (
    <div className={cn('relative', props.disabled && 'opacity-50')}>
      <select
        ref={ref}
        data-ui=""
        className={cn(
          'w-full cursor-pointer appearance-none rounded-md border border-input bg-field pl-3 pr-9 text-foreground shadow-sm transition-colors',
          'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed aria-[invalid=true]:border-destructive',
          size === 'sm' ? 'h-10 text-sm md:h-8' : 'h-11 text-base md:h-9 md:text-sm',
          className
        )}
        onChange={(event) => {
          onChange?.(event);
          onValueChange?.(event.target.value);
        }}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
);
NativeSelect.displayName = 'NativeSelect';
