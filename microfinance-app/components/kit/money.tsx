'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, formatMoneyCompact, toAmount, type MoneyInput } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * How an amount is coloured (SPEC "Money"):
 *  - auto: normal text; negative amounts red; zero a muted dash
 *  - inflow: "+₹…" in success text (money received)
 *  - outflow: normal text (money paid out)
 *  - overdue: red when above zero, otherwise a muted dash
 *  - loss: red
 *  - plain: normal text, zero shown as ₹0
 */
export type MoneyTone = 'auto' | 'inflow' | 'outflow' | 'overdue' | 'loss' | 'plain';

export interface MoneyProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: MoneyInput;
  tone?: MoneyTone;
  decimals?: number;
  /** ₹1.25 L / ₹2.4 Cr with the full amount in a tooltip. For stat cards. */
  compact?: boolean;
  /** Shown for null/undefined/unparsable values. Default "—". */
  fallback?: string;
}

/** An amount: Indian grouping, tabular numerals, no wrapping. Right-align it in tables. */
export function Money({ value, tone = 'auto', decimals = 0, compact = false, fallback = '—', className, ...props }: MoneyProps) {
  const amount = toAmount(value);
  const base = 'tabular-nums whitespace-nowrap';

  if (amount === null) {
    return (
      <span className={cn(base, 'text-muted-foreground', className)} {...props}>
        {fallback}
      </span>
    );
  }

  const isZero = Math.round(Math.abs(amount) * 10 ** decimals) === 0;
  if (isZero && tone !== 'plain') {
    return (
      <span className={cn(base, 'text-muted-foreground', className)} aria-label={formatMoney(0)} {...props}>
        —
      </span>
    );
  }

  const colour =
    tone === 'inflow'
      ? 'text-success-text'
      : tone === 'loss' || tone === 'overdue' || (tone === 'auto' && amount < 0)
        ? 'text-destructive-text'
        : undefined;
  const full = formatMoney(amount, { decimals, signed: tone === 'inflow' });

  if (!compact || formatMoneyCompact(amount) === formatMoney(amount)) {
    return (
      <span className={cn(base, colour, className)} {...props}>
        {full}
      </span>
    );
  }

  const short = (tone === 'inflow' && amount > 0 ? '+' : '') + formatMoneyCompact(amount);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={full}
            className={cn(base, colour, 'cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
            {...props}
          >
            {short}
          </span>
        </TooltipTrigger>
        <TooltipContent>{full}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
