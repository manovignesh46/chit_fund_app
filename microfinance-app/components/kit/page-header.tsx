import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** Record count shown next to a list title. */
  count?: number;
  /** Next to the title on detail pages, e.g. <StatusBadge status="Active" />. */
  status?: React.ReactNode;
  /** Primary action and an overflow menu, right-aligned (stacked under the title on phones). */
  actions?: React.ReactNode;
  /** Small text above the title (e.g. "Loan #1042"). */
  eyebrow?: React.ReactNode;
  /**
   * 'inline' (default): actions sit to the right of the title at every width; use icon-only
   * buttons on phones (`iconOnPhone`). 'stack': actions go under the title below sm, for wide
   * controls such as a month picker or a segmented control.
   */
  actionsLayout?: 'inline' | 'stack';
}

/**
 * Class for a header action button that shows only its icon on phones: wrap the label in
 * `<span className="max-sm:sr-only">` so the accessible name stays.
 *
 *   <Button className={iconOnPhone}><Plus aria-hidden="true" /><span className="max-sm:sr-only">New loan</span></Button>
 */
export const iconOnPhone = 'max-sm:h-10 max-sm:w-10 max-sm:px-0';

/**
 * The single page-header style for list, detail, form and report pages. The actions sit to
 * the right of the title at every width; on phones they should be icon-only (`iconOnPhone`).
 */
export function PageHeader({ title, description, count, status, actions, eyebrow, actionsLayout = 'inline', className, ...props }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex gap-3 sm:gap-4', actionsLayout === 'stack' ? 'flex-col sm:flex-row sm:items-start sm:justify-between' : 'items-start justify-between', className)} {...props}>
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {typeof count === 'number' ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {count.toLocaleString('en-IN')}
            </span>
          ) : null}
          {status}
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className={cn('flex shrink-0 flex-wrap items-center gap-2', actionsLayout === 'stack' ? 'sm:justify-end' : 'justify-end')}>{actions}</div> : null}
    </div>
  );
}
