'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface SearchInputProps {
  /** The committed search (e.g. list.params.q). */
  value: string;
  /** Called with the new search after `debounceMs` of no typing, or at once on Enter/clear. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible label (visually hidden). Default "Search". */
  label?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
  id?: string;
}

/** Debounced search box (300 ms; Enter applies at once; Escape clears). */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', debounceMs = 300, className, autoFocus, id }: SearchInputProps) {
  const [text, setText] = React.useState(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Follow outside changes (Back, "Clear all") unless the user is mid-edit.
  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = React.useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const trimmed = next.trim();
    if (trimmed === committed.current) return;
    committed.current = trimmed;
    onChangeRef.current(trimmed);
  }, []);

  const handleChange = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), debounceMs);
  };

  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        aria-label={label}
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        className="pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(text);
          } else if (event.key === 'Escape' && text) {
            event.preventDefault();
            setText('');
            commit('');
          }
        }}
      />
      {text ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            commit('');
          }}
          className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:w-9"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
