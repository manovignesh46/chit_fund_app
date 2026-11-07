'use client';

/**
 * A small hover/focus label for the shell's icon buttons and collapsed sidebar links.
 * The shell is on every page, so it avoids the Radix tooltip (popper + floating-ui)
 * in the shared bundle. The label is a visual aid only (aria-hidden): every trigger
 * already has an accessible name. It is position: fixed, so the sidebar's scrolling
 * nav does not clip it. Shows on pointer hover and keyboard focus; Escape hides it.
 */
import * as React from 'react';

type Side = 'right' | 'bottom';

interface ShellTooltipProps {
  label: React.ReactNode;
  side?: Side;
  /** When true the tooltip never shows (e.g. the sidebar is expanded and the label is visible). */
  disabled?: boolean;
  /** A single element that accepts ref, mouse and focus handlers. */
  children: React.ReactElement;
}

export function ShellTooltip({ label, side = 'right', disabled = false, children }: ShellTooltipProps) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  const show = React.useCallback(
    (delay: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos(side === 'right' ? { x: r.right + 14, y: r.top + r.height / 2 } : { x: r.left + r.width / 2, y: r.bottom + 6 });
      }, delay);
    },
    [side]
  );
  const hide = React.useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  React.useEffect(() => {
    if (!pos) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [pos, hide]);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  React.useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);

  const child = children as React.ReactElement<Record<string, unknown>>;
  const props = child.props as Record<string, ((event: unknown) => void) | undefined>;
  const trigger = React.cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    onMouseEnter: (event: unknown) => {
      props.onMouseEnter?.(event);
      if (!disabled) show(250);
    },
    onMouseLeave: (event: unknown) => {
      props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: unknown) => {
      props.onFocus?.(event);
      // Keyboard focus only: a mouse click should not leave a label behind.
      const target = (event as { currentTarget?: HTMLElement }).currentTarget;
      if (!disabled && target?.matches?.(':focus-visible')) show(0);
    },
    onBlur: (event: unknown) => {
      props.onBlur?.(event);
      hide();
    },
    onClick: (event: unknown) => {
      props.onClick?.(event);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {pos && !disabled ? (
        <span
          aria-hidden="true"
          role="presentation"
          style={{ left: pos.x, top: pos.y }}
          className={`pointer-events-none fixed z-[70] whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md animate-in fade-in-0 motion-reduce:animate-none ${
            side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2'
          }`}
        >
          {label}
        </span>
      ) : null}
    </>
  );
}
