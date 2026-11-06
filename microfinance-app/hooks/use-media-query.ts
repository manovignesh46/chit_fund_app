'use client';

import * as React from 'react';

/**
 * Subscribe to a CSS media query. Returns `false` during server rendering and
 * hydration, then the real value (so markup matches on hydration).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Tailwind `md` and up (768px): desktop dialogs, tables instead of cards. */
export const DESKTOP_QUERY = '(min-width: 768px)';
