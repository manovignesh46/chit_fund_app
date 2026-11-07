import * as React from 'react';
import { AlertTriangle, Ban, Check, Clock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusStyle, STATUS_CLASSES, type StatusIconName } from './status';

const ICONS: Record<Exclude<StatusIconName, 'dot'>, LucideIcon> = {
  clock: Clock,
  check: Check,
  alert: AlertTriangle,
  ban: Ban,
};

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Any status string; resolved through components/kit/status.ts. */
  status: string | null | undefined;
  /** Override the displayed text (the colour still comes from `status`). */
  label?: React.ReactNode;
  size?: 'sm' | 'md';
}

/** Status pill: label plus icon or dot, colours from the one status map. */
export function StatusBadge({ status, label, size = 'sm', className, ...props }: StatusBadgeProps) {
  const style = getStatusStyle(status);
  const Icon = style.icon === 'dot' ? null : ICONS[style.icon];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none',
        size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
        STATUS_CLASSES[style.tone][style.variant],
        style.muted && 'opacity-80',
        className
      )}
      {...props}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
      ) : (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label ?? style.label}
    </span>
  );
}
