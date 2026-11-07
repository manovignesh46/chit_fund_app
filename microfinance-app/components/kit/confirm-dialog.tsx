'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { errorMessage } from './error-state';

export interface ConfirmDialogProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra content between the description and the buttons (e.g. what will be deleted). */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'destructive' (default) for deletes and other irreversible actions. */
  tone?: 'destructive' | 'default';
  /**
   * Runs on confirm. While its promise is pending the buttons are disabled; on
   * success the dialog closes; if it throws, the dialog stays open with the error.
   */
  onConfirm: () => void | Promise<void>;
  /** Uncontrolled use: the element that opens the dialog. */
  trigger?: React.ReactElement;
  /** Controlled use (e.g. opened from a menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where focus goes on close when there is no trigger (defaults to the element focused before opening). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Confirmation for destructive actions: replaces window.confirm and the copy-pasted delete modals. */
export function ConfirmDialog({
  title,
  description,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  onConfirm,
  trigger,
  open: openProp,
  onOpenChange,
  returnFocusRef,
}: ConfirmDialogProps) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  React.useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setFailure(null);
    }
  }, [open]);

  const confirm = async () => {
    setPending(true);
    setFailure(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      setFailure(errorMessage(error) ?? 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (trigger) return;
          const target = returnFocusRef?.current ?? previousFocus.current;
          if (target && target.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        {failure ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={pending}
            className={cn(pending && 'cursor-wait')}
          >
            {pending ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
