'use client';

import * as React from 'react';

const subscribe = () => () => {};

/**
 * False on the server and during the hydration render, true otherwise (including
 * components first mounted by a client-side navigation).
 *
 * Pages are prerendered under the root layout's `force-static`, where URL search
 * params are empty. Anything derived from the URL must render its defaults until
 * this is true, or the hydration markup will not match (React error #418).
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(subscribe, () => true, () => false);
}
