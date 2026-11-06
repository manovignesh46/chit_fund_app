'use client';

/**
 * Pick one record (member, loan, chit fund…) by searching on the server, instead of
 * loading every record into a <select> (the pageSize=1000 pattern).
 *
 *   <EntityCombobox<Member>
 *     value={member}
 *     onChange={setMember}
 *     loadOptions={(q, signal) => apiFetch(`/members/consolidated?action=list&search=${encodeURIComponent(q)}`, { signal }).then((r) => r.members)}
 *     getOptionValue={(m) => m.id}
 *     getOptionLabel={(m) => m.name}
 *     renderOption={(m) => <><span>{m.name}</span><span className="text-muted-foreground">{m.contact}</span></>}
 *     placeholder="Select member"
 *   />
 */
import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface EntityComboboxProps<T> {
  value: T | null;
  onChange: (value: T | null) => void;
  /** Fetch options for a query. Called with "" when opened. Abort `signal` when superseded. */
  loadOptions: (query: string, signal: AbortSignal) => Promise<T[]>;
  getOptionValue: (item: T) => string | number;
  getOptionLabel: (item: T) => string;
  renderOption?: (item: T) => React.ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show a clear (×) button when a value is selected. Default true. */
  clearable?: boolean;
  disabled?: boolean;
  debounceMs?: number;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

export function EntityCombobox<T>({
  value,
  onChange,
  loadOptions,
  getOptionValue,
  getOptionLabel,
  renderOption,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches',
  clearable = true,
  disabled = false,
  debounceMs = 250,
  id,
  className,
  ...aria
}: EntityComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [options, setOptions] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const loadRef = React.useRef(loadOptions);
  loadRef.current = loadOptions;

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(null);
    const timer = setTimeout(() => {
      loadRef
        .current(query.trim(), controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setOptions(items);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setFailed(error instanceof Error ? error.message : 'Could not load options');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, query ? debounceMs : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, debounceMs]);

  const selectedKey = value ? String(getOptionValue(value)) : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={aria['aria-invalid']}
            aria-describedby={aria['aria-describedby']}
            disabled={disabled}
            className={cn(
              'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-field px-3 text-left text-base shadow-sm transition-colors md:h-9 md:text-sm',
              'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
              value && clearable && 'pr-16'
            )}
          >
            <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
              {value ? getOptionLabel(value) : placeholder}
            </span>
            <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {value && clearable && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => onChange(null)}
            className="absolute right-8 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          <CommandList>
            {loading && options.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                Searching…
              </div>
            ) : failed ? (
              <div role="alert" className="px-3 py-6 text-center text-sm text-destructive-text">
                {failed}
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {options.length > 0 ? (
              <CommandGroup className={cn(loading && 'opacity-60')}>
                {options.map((item) => {
                  const key = String(getOptionValue(item));
                  return (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => {
                        onChange(item);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      <Check aria-hidden="true" className={cn('h-4 w-4', key === selectedKey ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 truncate">
                        {renderOption ? renderOption(item) : getOptionLabel(item)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
