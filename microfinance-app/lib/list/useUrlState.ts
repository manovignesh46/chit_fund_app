'use client';

/**
 * A few named string values kept in the URL (outside a list), e.g. the calendar's
 * month or a report's period:
 *
 *   const url = useUrlState({ month: '', type: 'all' }, { history: 'push' });
 *   url.values.month            // '' until set, then e.g. '2026-11'
 *   url.set({ month: '2026-10' })
 *
 * - Defaults are left out of the URL (`clearOnDefault`).
 * - `history: 'push'` makes each change a history entry (Back returns to the previous
 *   value, as the calendar's month needs); the default 'replace' does not.
 * - Same hydration rule as useListParams: during the hydration render the values are the
 *   defaults (the page was prerendered without search params); `ready` turns true after.
 *   Do not start a URL-dependent query before `ready`.
 *
 * Pages use this hook (or useListParams / kit url-tabs) and never import nuqs directly.
 * The page body must be inside <PageContainer> (it provides the Suspense boundary).
 */
import * as React from 'react';
import { parseAsString, useQueryStates, type ParserMap } from 'nuqs';
import { useHydrated } from '@/hooks/use-hydrated';

export interface UrlStateOptions {
  history?: 'push' | 'replace';
}

export interface UrlState<K extends string> {
  values: Record<K, string>;
  /** Change some values; `null` (or the default) removes a value from the URL. */
  set: (patch: Partial<Record<K, string | null>>) => void;
  ready: boolean;
}

export function useUrlState<K extends string>(defaults: Record<K, string>, options: UrlStateOptions = {}): UrlState<K> {
  const defaultsKey = JSON.stringify(defaults);
  const history = options.history ?? 'replace';
  const parsers = React.useMemo(() => {
    const d = JSON.parse(defaultsKey) as Record<string, string>;
    const map: ParserMap = {};
    for (const name of Object.keys(d)) map[name] = parseAsString.withDefault(d[name]);
    return map;
  }, [defaultsKey]);

  const [urlValues, setRaw] = useQueryStates(parsers, { history, shallow: true, scroll: false, clearOnDefault: true });
  const ready = useHydrated();
  const values = React.useMemo(
    () => (ready ? urlValues : (JSON.parse(defaultsKey) as Record<string, string>)) as Record<K, string>,
    [ready, urlValues, defaultsKey]
  );
  const set = React.useCallback(
    (patch: Partial<Record<K, string | null>>) => {
      void setRaw(patch as Parameters<typeof setRaw>[0]);
    },
    [setRaw]
  );
  return { values, set, ready };
}
