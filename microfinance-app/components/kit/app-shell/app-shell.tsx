'use client';

/**
 * The app frame, mounted once in app/layout.tsx (it never re-mounts on navigation,
 * so the top bar's SSE connections and fetched user/partner state survive):
 *
 *   skip link · AppSidebar (lg+, fixed) · [TopBar (sticky) · <main id="main-content">] · BottomNav (< lg, fixed)
 *
 * The document scrolls (not <main>), so Back restores the scroll position.
 * Layout variables (styles/theme/shell.css): --topbar-height, --sidebar-width,
 * --sidebar-width-icon, --shell-sidebar-width (current), --bottom-nav-height.
 * `/login` renders without the shell. Routes with `layout: 'full'` in nav-config
 * (/messages) fill the viewport between the bars and the document does not scroll.
 * <main> has no padding: pages bring their own container (PageContainer, or the
 * legacy `.page-container` / `container mx-auto px-4 py-8`). It is a block box
 * (a flex column only for full-height pages), so `max-w-* mx-auto` page roots take
 * the available width instead of shrinking to their content.
 */
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';
import { BreadcrumbLabelsProvider } from './breadcrumb-labels';
import { getActiveNavItem, getRouteLayout, isShellless } from './nav-config';
import { toggleSidebarCollapsed } from './sidebar-state';

const DESKTOP = '(min-width: 1024px)';

/** Ctrl/Cmd+B toggles the desktop sidebar. */
function useSidebarShortcut() {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'b' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (!window.matchMedia(DESKTOP).matches) return;
      event.preventDefault();
      toggleSidebarCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Full-height pages: size the column to the visual viewport, so an on-screen
 * keyboard that does not resize the layout viewport (iOS Safari) cannot hide the
 * composer. CSS falls back to 100dvh before this runs.
 */
function useVisualViewportHeight(enabled: boolean, ref: React.RefObject<HTMLDivElement>) {
  React.useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!enabled || !el || !vv) return;
    const update = () => {
      el.style.height = `${Math.round(vv.height)}px`;
    };
    update();
    vv.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      el.style.height = '';
    };
  }, [enabled, ref]);
}

/**
 * Hash links to content that renders after its data loads (e.g. /loans/12#loan-recovery
 * from a client-side Link): Next only scrolls when the target already exists, so wait
 * for it (up to 4 s, or until the user scrolls) and scroll it into view then.
 */
function useScrollToLateHashTarget(pathname: string) {
  React.useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || document.getElementById(id)) return;
    let done = false;
    const stop = () => {
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', stop);
    };
    const observer = new MutationObserver(() => {
      const target = document.getElementById(id);
      if (!target || done) return;
      stop();
      target.scrollIntoView({ block: 'start' });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(stop, 4000);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return stop;
  }, [pathname]);
}

function ShellFrame({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const full = getRouteLayout(pathname) === 'full';
  const activeId = getActiveNavItem(pathname)?.id ?? null;
  const columnRef = React.useRef<HTMLDivElement>(null);
  useSidebarShortcut();
  useVisualViewportHeight(full, columnRef);
  useScrollToLateHashTarget(pathname);

  return (
    <BreadcrumbLabelsProvider>
        <div data-app-shell="" data-layout={full ? 'full' : 'page'} className="min-h-dvh bg-background">
          <a
            href="#main-content"
            className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Skip to main content
          </a>
          <AppSidebar activeId={activeId} />
          <div
            ref={columnRef}
            className={`flex min-w-0 flex-col transition-[padding-left] duration-200 ease-out motion-reduce:transition-none lg:pl-[var(--shell-sidebar-width)] ${
              full ? 'h-dvh overflow-hidden' : 'min-h-dvh'
            }`}
          >
            <TopBar />
            <main
              id="main-content"
              tabIndex={-1}
              className={`flex-1 pb-[var(--bottom-nav-height)] focus:outline-none ${full ? 'flex min-h-0 flex-col overflow-hidden' : 'block'}`}
            >
              {children}
            </main>
          </div>
          <BottomNav activeId={activeId} />
        </div>
    </BreadcrumbLabelsProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  if (isShellless(pathname)) return <>{children}</>;
  return <ShellFrame pathname={pathname}>{children}</ShellFrame>;
}
