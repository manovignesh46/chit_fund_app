'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  /** Navigate (rendered as a link). */
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Ask first: the action runs `confirm.onConfirm` after the ConfirmDialog. */
  confirm?: Pick<ConfirmDialogProps, 'title' | 'description' | 'confirmLabel' | 'onConfirm'>;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
}

export interface RowActionsProps {
  actions: RowAction[];
  /** Accessible name of the menu button, e.g. "Actions for Anitha Devi". */
  label?: string;
  align?: 'start' | 'end';
  className?: string;
}

/** The "⋯" menu at the end of a row or in a detail header. */
export function RowActions({ actions, label = 'Row actions', align = 'end', className }: RowActionsProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = React.useState<RowAction | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn('text-muted-foreground hover:text-foreground', className)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-[10rem]" onClick={(event) => event.stopPropagation()}>
          {actions.map((action, i) => {
            const Icon = action.icon;
            const content = (
              <>
                {Icon ? <Icon aria-hidden="true" /> : null}
                {action.label}
              </>
            );
            const itemClass = cn(action.destructive && 'text-destructive-text focus:bg-destructive-subtle focus:text-destructive-text');
            return (
              <React.Fragment key={`${action.label}-${i}`}>
                {action.separatorBefore && i > 0 ? <DropdownMenuSeparator /> : null}
                {action.href && !action.disabled ? (
                  <DropdownMenuItem asChild className={itemClass}>
                    <Link href={action.href}>{content}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className={itemClass}
                    disabled={action.disabled}
                    onSelect={() => {
                      if (action.confirm) setConfirming(action);
                      else action.onSelect?.();
                    }}
                  >
                    {content}
                  </DropdownMenuItem>
                )}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming?.confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          returnFocusRef={triggerRef}
          title={confirming.confirm.title}
          description={confirming.confirm.description}
          confirmLabel={confirming.confirm.confirmLabel}
          onConfirm={confirming.confirm.onConfirm}
          tone={confirming.destructive === false ? 'default' : 'destructive'}
        />
      ) : null}
    </>
  );
}
