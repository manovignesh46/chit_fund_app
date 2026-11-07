import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { TONE_TEXT, type StatusTone } from './status';

export interface StatCardTrend {
  /** e.g. "+12% vs last month" */
  label: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news (colours the trend). Default: up = good. */
  positive?: boolean;
}

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  label: React.ReactNode;
  /** The figure. Pass <Money value={…} compact /> for amounts. */
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Colour the value only when it carries meaning (overdue = destructive). Default neutral. */
  tone?: StatusTone;
  trend?: StatCardTrend;
  /** Make the whole card a link (e.g. to the filtered list). */
  href?: string;
  /** Skeleton with the same height as the loaded card. */
  loading?: boolean;
}

/**
 * A key figure: label, value, optional hint/trend. Used in KPI grids and detail key-figure strips.
 * With `href` the card is a link; with `onClick` (and no href) it is a button.
 */
export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', trend, href, loading = false, className, ...props }: StatCardProps) {
  const trendColour =
    trend && trend.direction !== 'flat'
      ? (trend.positive ?? trend.direction === 'up')
        ? 'text-success-text'
        : 'text-destructive-text'
      : 'text-muted-foreground';
  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : ArrowRight;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      <div className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', TONE_TEXT[tone])}>
        {loading ? <Skeleton className="h-8 w-32" /> : value}
      </div>
      {hint || trend ? (
        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {loading ? (
            <Skeleton className="h-3.5 w-24" />
          ) : (
            <>
              {trend ? (
                <span className={cn('inline-flex items-center gap-0.5 font-medium', trendColour)}>
                  <TrendIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  {trend.label}
                </span>
              ) : null}
              {hint ? <span>{hint}</span> : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );

  const cardClass = cn('block rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5', className);

  const interactive =
    'transition-colors hover:border-input hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  if (!href && props.onClick) {
    // A card that does something on this page (switch tab, apply a filter): a real button.
    const { onClick, ...rest } = props;
    return (
      <button
        type="button"
        onClick={onClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
        className={cn(cardClass, 'w-full text-left', interactive)}
        aria-busy={loading || undefined}
        {...(rest as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          cardClass,
          'transition-colors hover:border-input hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
        aria-busy={loading || undefined}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={cardClass} aria-busy={loading || undefined} {...props}>
      {body}
    </div>
  );
}
