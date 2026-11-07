'use client';

/**
 * Period pickers (Report template, list date filters).
 *
 *   <DateRangePicker from={from} to={to} onChange={(from, to) => list.setParams({ from, to })} />
 *   <MonthPicker value={month} onChange={setMonth} />
 *   <SegmentedControl value={period} onChange={setPeriod} options={[…]} aria-label="Period" />
 *
 * Values are plain "YYYY-MM-DD" (or "YYYY-MM" for months) so pages can keep them in the URL
 * with useListParams / useUrlState. The presets compute the same ranges the old
 * transactions DateFilter did (calendar days of the browser's date).
 */
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DateInput } from './date-input';
import { NativeSelect } from './native-select';

// ─────────────────────────────────────────────────────────────── date ranges

export type PeriodPreset = 'all' | 'today' | 'yesterday' | 'lastWeek' | 'last7Days' | 'thisMonth' | 'lastMonth' | 'untilLastMonth';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'last7Days', label: 'Last 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'untilLastMonth', label: 'Until last month' },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** "YYYY-MM-DD" of a local calendar date (y, m0, d may overflow; Date normalises them). */
export function isoDay(y: number, m0: number, d: number): string {
  const date = new Date(y, m0, d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The range a preset stands for on `today` (null ends are open). */
export function resolvePeriod(preset: PeriodPreset, today: Date = new Date()): { from: string | null; to: string | null } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const dow = today.getDay();
  switch (preset) {
    case 'today':
      return { from: isoDay(y, m, d), to: isoDay(y, m, d) };
    case 'yesterday':
      return { from: isoDay(y, m, d - 1), to: isoDay(y, m, d - 1) };
    case 'lastWeek':
      return { from: isoDay(y, m, d - dow - 7), to: isoDay(y, m, d - dow - 1) };
    case 'last7Days':
      return { from: isoDay(y, m, d - 7), to: isoDay(y, m, d) };
    case 'thisMonth':
      return { from: isoDay(y, m, 1), to: isoDay(y, m, d) };
    case 'lastMonth':
      return { from: isoDay(y, m - 1, 1), to: isoDay(y, m, 0) };
    case 'untilLastMonth':
      return { from: null, to: isoDay(y, m, 0) };
    default:
      return { from: null, to: null };
  }
}

/** The preset a range matches today, or 'custom'. */
export function matchPeriod(from: string | null, to: string | null, today: Date = new Date()): PeriodPreset | 'custom' {
  for (const { value } of PERIOD_PRESETS) {
    const r = resolvePeriod(value, today);
    if ((r.from ?? null) === (from || null) && (r.to ?? null) === (to || null)) return value;
  }
  return 'custom';
}

/** Human label for a range: the preset name, or "06 Nov 2026 – 07 Nov 2026". */
export function describePeriod(from: string | null, to: string | null): string {
  const preset = matchPeriod(from, to);
  if (preset !== 'custom') return PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? '';
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return 'All time';
}

export interface DateRangePickerProps {
  from: string | null;
  to: string | null;
  /** Called with the new range ("" or null ends are open). */
  onChange: (from: string | null, to: string | null) => void;
  id?: string;
  className?: string;
}

/**
 * A preset select plus a custom range. Presets apply at once; a custom range applies as
 * each end is picked (either end may stay open).
 */
export function DateRangePicker({ from, to, onChange, id, className }: DateRangePickerProps) {
  const matched = matchPeriod(from, to);
  const [customOpen, setCustomOpen] = React.useState(false);
  const showCustom = customOpen || matched === 'custom';
  const value = showCustom ? 'custom' : matched;
  const today = isoDay(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className={cn('space-y-2', className)}>
      <NativeSelect
        id={id}
        aria-label="Period"
        value={value}
        onValueChange={(next) => {
          if (next === 'custom') {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          const range = resolvePeriod(next as PeriodPreset);
          onChange(range.from, range.to);
        }}
        options={[...PERIOD_PRESETS, { value: 'custom', label: 'Custom range…' }]}
      />
      {showCustom ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>From</span>
            <DateInput value={from ?? ''} max={to || undefined} onValueChange={(next) => onChange(next || null, to)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>To</span>
            <DateInput value={to ?? ''} min={from || undefined} max={today} onValueChange={(next) => onChange(from, next || null)} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── months

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11" ↔ { year, month (1–12) }. Returns null for anything else. */
export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`;
export const currentMonthKey = (today: Date = new Date()) => monthKey(today.getFullYear(), today.getMonth() + 1);
export const monthLabel = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;
/** First and last day of a month as "YYYY-MM-DD". */
export const monthRange = (year: number, month: number) => ({ startDate: isoDay(year, month - 1, 1), endDate: isoDay(year, month, 0) });

export function shiftMonth(value: string, delta: number): string {
  const parsed = parseMonth(value) ?? parseMonth(currentMonthKey())!;
  const date = new Date(parsed.year, parsed.month - 1 + delta, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}

export interface MonthPickerProps {
  /** "YYYY-MM" */
  value: string;
  onChange: (value: string) => void;
  /** Year range of the year select (always includes the selected year). */
  minYear?: number;
  maxYear?: number;
  className?: string;
}

/** Previous / month select / year select / next. */
export function MonthPicker({ value, onChange, minYear = 2021, maxYear = 2040, className }: MonthPickerProps) {
  const parsed = parseMonth(value) ?? parseMonth(currentMonthKey())!;
  const from = Math.min(minYear, parsed.year);
  const to = Math.max(maxYear, parsed.year);
  const years = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  return (
    <div className={cn('flex items-center gap-1.5', className)} role="group" aria-label="Month">
      <Button type="button" variant="outline" size="icon" aria-label="Previous month" onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft aria-hidden="true" />
      </Button>
      <NativeSelect
        aria-label="Month"
        className="w-[8.5rem]"
        value={String(parsed.month)}
        onValueChange={(m) => onChange(monthKey(parsed.year, Number(m)))}
        options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
      />
      <NativeSelect
        aria-label="Year"
        className="w-[6rem]"
        value={String(parsed.year)}
        onValueChange={(y) => onChange(monthKey(Number(y), parsed.month))}
        options={years.map((y) => ({ value: y, label: y }))}
      />
      <Button type="button" variant="outline" size="icon" aria-label="Next month" onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── segmented control

export interface SegmentedOption<V extends string> {
  value: V;
  label: React.ReactNode;
}

export interface SegmentedControlProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A small set of mutually exclusive choices (report period, a list's kind filter). Radio semantics. */
export function SegmentedControl<V extends string>({ value, onChange, options, size = 'md', className, ...props }: SegmentedControlProps<V>) {
  const refs = React.useRef(new Map<V, HTMLButtonElement>());
  const move = (event: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current.get(options[next].value)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={props['aria-label']} className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-9 px-2.5 text-xs md:h-7' : 'h-10 px-3 text-sm md:h-8',
              selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
