'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';

export interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled use: the element that opens the dialog. */
  trigger?: React.ReactElement;
  title: React.ReactNode;
  /** Shown under the title; pass `hideDescription` to keep it for screen readers only. */
  description?: React.ReactNode;
  hideDescription?: boolean;
  children: React.ReactNode;
  /** Buttons. Primary action last. */
  footer?: React.ReactNode;
  /** Desktop width. Default 'md' (32rem). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /**
   * Controlled use without `trigger`: where focus goes on close. Defaults to the element
   * that had focus when the dialog opened (Radix alone only restores focus to a trigger).
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

/** Forms and pickers in a modal: centred dialog from `md` up, bottom sheet on phones. */
export function ResponsiveDialog({ open, onOpenChange, trigger, title, description, hideDescription = false, children, footer, size = 'md', className, returnFocusRef }: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // Remember what had focus as the dialog opens: read during render, before the dialog's
  // own effects move focus inside it.
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = !!open;
  const onCloseAutoFocus = (event: Event) => {
    if (trigger) return;
    const target = returnFocusRef?.current ?? previousFocus.current;
    if (target && target.isConnected) {
      event.preventDefault();
      target.focus();
    }
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className={cn(WIDTH[size], className)} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription className={cn(hideDescription && 'sr-only')}>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent side="bottom" className={cn('flex flex-col gap-4', className)} onCloseAutoFocus={onCloseAutoFocus}>
        <SheetHeader className="pr-10 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription className={cn(hideDescription && 'sr-only')}>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1">{children}</div>
        {footer ? <SheetFooter className="[&>*]:w-full sm:[&>*]:w-auto">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}
