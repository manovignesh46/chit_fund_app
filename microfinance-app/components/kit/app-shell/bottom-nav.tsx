'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { BOTTOM_BAR_ITEMS, type NavItem } from './nav-config';

// The sheet (Radix dialog, the full menu) is not needed for first paint.
const loadMoreSheet = () => import('./more-sheet');
const MoreSheet = dynamic(loadMoreSheet, { ssr: false });

const KEYBOARD_ATTRIBUTE = 'data-keyboard-open';
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden', 'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week']);

function opensKeyboard(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
}

/**
 * On touch devices, hide the bar while the on-screen keyboard is up, so it does not
 * ride on top of the keyboard and push sticky form buttons up (sets
 * <html data-keyboard-open>, which also zeroes --bottom-nav-height). "Up" means a text
 * field has focus and the visual viewport lost a fifth of its height.
 */
function useKeyboardOpenFlag() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    const coarse = window.matchMedia('(pointer: coarse)');
    const root = document.documentElement;
    let baseHeight = vv?.height ?? window.innerHeight;
    let baseWidth = window.innerWidth;
    const update = () => {
      const height = vv?.height ?? window.innerHeight;
      if (window.innerWidth !== baseWidth) {
        baseWidth = window.innerWidth;
        baseHeight = height;
      }
      baseHeight = Math.max(baseHeight, height);
      const open = coarse.matches && opensKeyboard(document.activeElement) && height < baseHeight * 0.8;
      if (open) root.setAttribute(KEYBOARD_ATTRIBUTE, '');
      else root.removeAttribute(KEYBOARD_ATTRIBUTE);
    };
    const later = () => window.setTimeout(update, 50);
    vv?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    return () => {
      vv?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
      root.removeAttribute(KEYBOARD_ATTRIBUTE);
    };
  }, []);
}

const itemClass =
  'flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium leading-tight text-muted-foreground transition-colors ' +
  'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ' +
  'aria-[current=page]:text-primary-text data-[active=true]:text-primary-text';

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={itemClass}>
      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
      {item.shortLabel ?? item.label}
    </Link>
  );
}

/**
 * Phone and tablet bottom bar (below `lg`): Home, Chit Funds, Loans, Dues, More.
 * More opens a bottom sheet with the full menu, partner, theme and sign-out.
 */
export function BottomNav({ activeId }: { activeId: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const moreRef = React.useRef<HTMLButtonElement>(null);
  useKeyboardOpenFlag();

  // Fetch the sheet's code while idle on small screens, so the first tap is instant.
  React.useEffect(() => {
    if (!window.matchMedia('(max-width: 1023.98px)').matches) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void loadMoreSheet());
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  // A More-sheet destination is active: highlight More (only one item is ever active).
  const onBar = BOTTOM_BAR_ITEMS.some((item) => item.id === activeId);
  const moreActive = !!activeId && !onBar && activeId !== 'messages' && activeId !== 'notifications';

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden [html[data-keyboard-open]_&]:hidden"
      >
        <ul className="mx-auto flex h-[calc(3.5rem-1px)] max-w-xl items-stretch px-1">
          {BOTTOM_BAR_ITEMS.map((item) => (
            <li key={item.id} className="flex-1 p-0.5">
              <BarLink item={item} active={item.id === activeId} />
            </li>
          ))}
          <li className="flex-1 p-0.5">
            <button
              ref={moreRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              data-active={moreActive}
              onClick={() => {
                setMounted(true);
                setOpen(true);
              }}
              className={itemClass}
            >
              <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 2} />
              More
            </button>
          </li>
        </ul>
      </nav>
      {mounted ? <MoreSheet open={open} onOpenChange={setOpen} activeId={activeId} returnFocusRef={moreRef} /> : null}
    </>
  );
}
