import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small muted text under the value. */
  hint?: React.ReactNode;
  /** Right-aligned tabular figures (in the inline layout). */
  numeric?: boolean;
  /** Span the full row in the grid layout. */
  full?: boolean;
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionItem[];
  /** Grid columns from `sm` up; phones always use one column. Default 2. */
  columns?: 1 | 2 | 3 | 4;
  /** 'grid': label above value. 'inline': label left, value right (key-figure lists). */
  layout?: 'grid' | 'inline';
}

const COLS: Record<NonNullable<DescriptionListProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

/** Label/value pairs for detail pages. Missing values should be passed as "—". */
export function DescriptionList({ items, columns = 2, layout = 'grid', className, ...props }: DescriptionListProps) {
  if (layout === 'inline') {
    return (
      <dl className={cn('divide-y', className)} {...props}>
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className={cn('text-right text-sm font-medium text-foreground', item.numeric && 'tabular-nums')}>
              {item.value}
              {item.hint ? <div className="text-xs font-normal text-muted-foreground">{item.hint}</div> : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn('grid gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5', COLS[columns], className)} {...props}>
      {items.map((item, i) => (
        <div key={i} className={cn('min-w-0', item.full && 'col-span-full')}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className={cn('mt-1 break-words text-sm text-foreground', item.numeric && 'tabular-nums')}>
            {item.value}
            {item.hint ? <div className="mt-0.5 text-xs text-muted-foreground">{item.hint}</div> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
