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
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

/** Forms and pickers in a modal: centred dialog from `md` up, bottom sheet on phones. */
export function ResponsiveDialog({ open, onOpenChange, trigger, title, description, hideDescription = false, children, footer, size = 'md', className }: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className={cn(WIDTH[size], className)}>
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
      <SheetContent side="bottom" className={cn('flex flex-col gap-4', className)}>
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
