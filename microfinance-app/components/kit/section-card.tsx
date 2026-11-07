import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header (a button, a menu, a period select). */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Remove body padding (for tables that run edge to edge). */
  flush?: boolean;
  contentClassName?: string;
}

/** A titled card section: the panel inside detail, form and report pages. */
export function SectionCard({ title, description, actions, footer, flush = false, className, contentClassName, children, ...props }: SectionCardProps) {
  const headingId = React.useId();
  const hasHeader = title || description || actions;
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2 id={headingId} className="text-base font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(!flush && 'p-4 sm:p-6', contentClassName)}>{children}</div>
      {footer ? <div className="border-t px-4 py-3 sm:px-6">{footer}</div> : null}
    </section>
  );
}
