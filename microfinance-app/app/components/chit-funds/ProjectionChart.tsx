'use client';

/**
 * Cumulative balance by calendar month (the projection page's chart). One series, or two
 * in simulation mode (simulated, plus the baseline dashed). Loaded with next/dynamic so
 * recharts stays out of the page's first-load bundle. Figures are the server's; nothing is
 * computed here.
 */
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { chartColor } from '@/components/kit/chart-card';

export interface ProjectionChartPoint {
  label: string;
  balance: number;
  baseline?: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="text-muted-foreground">{p.dataKey === 'baseline' ? 'Baseline' : 'Cumulative balance'}</span>
          <span className="font-medium">{formatMoney(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export default function ProjectionChart({ points, compare }: { points: ProjectionChartPoint[]; compare: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          width={76}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
        />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }} />
        {compare ? (
          <Line type="monotone" dataKey="baseline" stroke={chartColor(2)} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }} isAnimationActive={false} />
        ) : null}
        <Line
          type="monotone"
          dataKey="balance"
          stroke={chartColor(1)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
