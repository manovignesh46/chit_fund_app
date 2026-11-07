import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChip {
  /** Stable key, e.g. the param name. */
  key: string;
  /** e.g. "Status: Active" */
  label: React.ReactNode;
  /** Accessible text for the remove button; default derived from a string label. */
  removeLabel?: string;
  onRemove: () => void;
}

export interface FilterChipsProps extends React.HTMLAttributes<HTMLDivElement> {
  chips: FilterChip[];
  onClearAll?: () => void;
}

/** Active filters as removable chips, plus "Clear all". Renders nothing when empty. */
export function FilterChips({ chips, onClearAll, className, ...props }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} {...props}>
      <ul className="contents" aria-label="Active filters">
        {chips.map((chip) => (
          <li
            key={chip.key}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-primary-border bg-primary-subtle pl-3 pr-1 text-xs font-medium text-primary-text"
          >
            <span className="max-w-[16rem] truncate">{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={chip.removeLabel ?? (typeof chip.label === 'string' ? `Remove filter ${chip.label}` : 'Remove filter')}
              className="relative inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-[''] md:after:hidden"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {onClearAll && chips.length > 0 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
