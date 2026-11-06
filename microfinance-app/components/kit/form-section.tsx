import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Field columns from `md` up; phones always use one. Default 2. */
  columns?: 1 | 2;
}

/** A titled group of fields in a card: two columns on desktop, one on phones. */
export function FormSection({ title, description, columns = 2, className, children, ...props }: FormSectionProps) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6', className)}
      {...props}
    >
      <div className="mb-5 space-y-1">
        <h2 id={headingId} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className={cn('grid grid-cols-1 gap-x-6 gap-y-5', columns === 2 && 'md:grid-cols-2')}>{children}</div>
    </section>
  );
}
