'use client';

/**
 * Trends page charts (recharts, loaded with next/dynamic so it stays out of the page's
 * first-load bundle). One measure per chart (no second axis); colours from the --chart-*
 * slots; a hover tooltip with full amounts. Figures are the server's.
 */
import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { chartColor, type ChartLegendItem } from '@/components/kit/chart-card';

export interface TrendPoint {
  period: string;
  [series: string]: number | string;
}

export interface TrendSeries {
  key: string;
  label: string;
  slot: ChartLegendItem['slot'];
}

const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };

/** "January 2026" → "Jan '26"; long labels are cut to 8 characters. */
export function shortPeriod(label: string): string {
  if (!label) return '';
  const parts = label.split(' ');
  if (parts.length === 2 && parts[1].length === 4) return `${parts[0].slice(0, 3)} '${parts[1].slice(2)}`;
  return label.length > 8 ? label.slice(0, 8) : label;
}

function ChartTooltip({ active, payload, label, series }: { active?: boolean; payload?: { dataKey?: string | number; value?: number }[]; label?: string; series: TrendSeries[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: s ? chartColor(s.slot) : undefined }} />
              {s?.label ?? p.dataKey}
            </span>
            <span className="font-medium">{formatMoney(p.value ?? 0)}</span>
          </p>
        );
      })}
      <p className="mt-1 text-muted-foreground">Click for the period breakdown</p>
    </div>
  );
}

export default function FinancialGraph({
  data,
  series,
  kind,
  onSelect,
}: {
  data: TrendPoint[];
  series: TrendSeries[];
  kind: 'bar' | 'line';
  onSelect?: (period: string) => void;
}) {
  const onClick = (state: unknown) => {
    const label = (state as { activeLabel?: string } | null)?.activeLabel;
    if (label && onSelect) onSelect(label);
  };
  const common = {
    data,
    margin: { top: 8, right: 12, bottom: 0, left: 4 },
    onClick,
    style: { cursor: onSelect ? 'pointer' : undefined },
  };
  // An array, not a fragment: recharts finds its axes among the chart's direct children.
  const axes = [
    <CartesianGrid key="grid" vertical={false} stroke="hsl(var(--border))" />,
    <XAxis key="x" dataKey="period" tickFormatter={shortPeriod} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tick={axisTick} interval="preserveStartEnd" minTickGap={12} />,
    <YAxis key="y" width={72} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v: number) => formatMoneyCompact(v)} />,
    <Tooltip key="tip" content={<ChartTooltip series={series} />} cursor={kind === 'bar' ? { fill: 'hsl(var(--muted))' } : { stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }} />,
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      {kind === 'bar' ? (
        <BarChart {...common} barGap={2} barCategoryGap="24%">
          {axes}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={chartColor(s.slot)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      ) : (
        <LineChart {...common}>
          {axes}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={chartColor(s.slot)}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: chartColor(s.slot) }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
