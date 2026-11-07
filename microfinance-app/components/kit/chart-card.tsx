import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartLegendItem {
  label: string;
  /** Series slot 1–6 (the fixed --chart-* order). */
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  /** Draw the swatch as a dashed line (e.g. a baseline series). */
  dashed?: boolean;
}

export interface ChartCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header (period select, export). */
  actions?: React.ReactNode;
  /** Legend for two or more series (one series needs none: the title names it). */
  legend?: ChartLegendItem[];
  /** Plot height in px. Default 260. */
  height?: number;
  /** Where the same figures are listed as text (a table below, a tab). Shown under the plot. */
  tableNote?: React.ReactNode;
}

/** CSS colour of a series slot, for SVG fill/stroke (follows the theme). */
export const chartColor = (slot: ChartLegendItem['slot']) => `hsl(var(--chart-${slot}))`;

/**
 * A chart in a card (Report template): title, optional legend and actions, a fixed-height
 * plot area (children: the chart, usually a lazily loaded recharts component) and a note
 * pointing to the table view. Series colours come only from the --chart-* slots.
 */
export function ChartCard({ title, description, actions, legend, height = 260, tableNote, className, children, ...props }: ChartCardProps) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0 space-y-0.5">
          <h2 id={headingId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {legend && legend.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted-foreground sm:px-6" aria-label="Legend">
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0 w-4 border-t-2"
                style={{ borderColor: chartColor(item.slot), borderTopStyle: item.dashed ? 'dashed' : 'solid' }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="px-2 pb-2 pt-3 sm:px-4" style={{ height }}>
        {children}
      </div>
      {tableNote ? <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-6">{tableNote}</p> : null}
    </section>
  );
}
