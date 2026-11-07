'use client';

/**
 * Horizontal bar rows for the dashboard's small monthly charts (no chart library):
 * one row per month, segments in the fixed --chart-* slots, value text in ink colours,
 * a tooltip with the full amounts on hover or keyboard focus.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { chartColor, type ChartLegendItem } from '@/components/kit/chart-card';

export interface BarSegment {
  value: number;
  slot: ChartLegendItem['slot'];
  /** Negative values (losses) are drawn in the destructive colour. */
  loss?: boolean;
}

export interface BarRow {
  key: string;
  label: string;
  segments: BarSegment[];
  /** Text at the end of the bar (usually a compact amount, or "—"). */
  valueText: string;
  /** Tooltip / accessible text lines. */
  details: string[];
  current?: boolean;
}

export function BarRows({ rows, max }: { rows: BarRow[]; max: number }) {
  const [active, setActive] = React.useState<string | null>(null);
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="relative"
          tabIndex={0}
          aria-label={[row.label, ...row.details].join('. ')}
          onMouseEnter={() => setActive(row.key)}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(row.key)}
          onBlur={() => setActive(null)}
        >
          <div className="flex items-center gap-3 rounded-sm focus-visible:outline-none">
            <span className={cn('w-16 shrink-0 text-right text-xs', row.current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {row.label}
            </span>
            <div className="flex h-5 flex-1 gap-0.5 overflow-hidden rounded bg-muted">
              {row.segments.map((segment, i) =>
                segment.value !== 0 ? (
                  <div
                    key={i}
                    className="h-full rounded-[3px] transition-[width] duration-500"
                    style={{
                      width: `${max > 0 ? (Math.abs(segment.value) / max) * 100 : 0}%`,
                      backgroundColor: segment.loss || segment.value < 0 ? 'hsl(var(--destructive))' : chartColor(segment.slot),
                    }}
                  />
                ) : null
              )}
            </div>
            <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-foreground">{row.valueText}</span>
          </div>
          {active === row.key && row.details.length > 0 ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-20 top-6 z-10 whitespace-nowrap rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            >
              <p className="mb-1 font-medium">{row.label}</p>
              {row.details.map((line) => (
                <p key={line} className="tabular-nums text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
