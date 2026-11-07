import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Stick to the bottom of the screen on phones (above the bottom bar, which sets
   * --bottom-nav-height). Default true.
   */
  sticky?: boolean;
  /** 'end': buttons right-aligned. 'between': first child left, the rest right. */
  align?: 'end' | 'between';
}

/** Form buttons. Put the primary (submit) button last; on phones buttons fill the width. */
export function FormActions({ sticky = true, align = 'end', className, children, ...props }: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto',
        align === 'end' ? 'sm:justify-end' : 'sm:justify-between',
        sticky &&
          'sticky bottom-[var(--bottom-nav-height,0px)] z-20 -mx-4 border-t bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
        !sticky && 'pt-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
