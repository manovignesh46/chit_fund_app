'use client';

/**
 * List state (page, page size, search, sort, filters) kept in the URL.
 *
 * - Same parameter names in the page URL and the API: page, pageSize, q, sort, order, <filters>.
 * - Defaults are left out of the URL; history entries are replaced, never pushed.
 * - Any patch without `page` resets to page 1 in the same URL write.
 * - Page size is remembered per list in localStorage.
 * - `ready` is false during the hydration render: the page was prerendered with empty
 *   search params (root layout is force-static), so the hook returns the defaults
 *   until hydration is over, then the URL's values. Do not start the list query
 *   before `ready` (useListQuery does this for you). After a client-side navigation
 *   the URL is read on the first render.
 *
 * Pages use this hook (and kit/url-tabs) and never import nuqs directly.
 * Wrap the page body in <PageContainer> (it adds the Suspense boundary that
 * useSearchParams needs under the root layout's force-static).
 */
import * as React from 'react';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates, type ParserMap } from 'nuqs';
import { useHydrated } from '@/hooks/use-hydrated';
import { ALL, DEFAULT_PAGE_SIZE, PAGE_SIZES, type SortOrder } from './types';

export interface ListConfig<F extends string = never> {
  /** Stable list id, e.g. 'loans'. Used for the remembered page size. */
  id: string;
  /** Names of filter params, e.g. ['status', 'type', 'from', 'to']. */
  filters?: readonly F[];
  /** Per-list defaults; the URL overrides them. */
  defaults?: Partial<Record<F, string>> & { sort?: string; order?: SortOrder; pageSize?: number };
  /** Sort keys the list accepts; anything else in the URL is ignored. */
  sortable?: readonly string[];
}

export type ListParams<F extends string = never> = {
  page: number;
  pageSize: number;
  q: string;
  sort: string | null;
  order: SortOrder | null;
} & { [K in F]: string | null };

/** A change to the list state. `null` restores a value's default. */
export type ListPatch<F extends string = never> = Partial<{
  page: number | null;
  pageSize: number | null;
  q: string | null;
  sort: string | null;
  order: SortOrder | null;
}> &
  Partial<Record<F, string | null>>;

export interface ActiveFilter {
  name: string;
  value: string;
}

export interface ListController<F extends string = never> {
  params: ListParams<F>;
  setParams: (patch: ListPatch<F>) => void;
  /** Reset search and all filters to their defaults (page 1). */
  clearFilters: () => void;
  /** True once the URL and remembered settings have been read on the client. */
  ready: boolean;
  /** Filters (and search) that differ from the defaults, for chips and "no results" states. */
  activeFilters: ActiveFilter[];
  isFiltered: boolean;
  /** Params for the API: defaults filled in, empty and 'all' values dropped. */
  apiParams: Record<string, string | number>;
}

const ORDERS = ['asc', 'desc'] as const;
const storageKey = (id: string) => `list:${id}:pageSize`;
const PAGE_SIZE_EVENT = 'list-page-size-change';

function subscribePageSize(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(PAGE_SIZE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(PAGE_SIZE_EVENT, onChange);
  };
}

function readStoredPageSize(id: string): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    const n = raw ? Number(raw) : NaN;
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredPageSize(id: string, size: number | null): void {
  try {
    if (size === null) window.localStorage.removeItem(storageKey(id));
    else window.localStorage.setItem(storageKey(id), String(size));
  } catch {
    /* storage unavailable: page size is simply not remembered */
  }
  window.dispatchEvent(new Event(PAGE_SIZE_EVENT));
}

export function useListParams<F extends string = never>(config: ListConfig<F>): ListController<F> {
  const { id } = config;
  const filtersKey = (config.filters ?? []).join('|');
  const filterNames = React.useMemo(() => (filtersKey ? filtersKey.split('|') : []) as F[], [filtersKey]);
  const defaults: NonNullable<ListConfig<F>["defaults"]> = config.defaults ?? {};
  const defaultsKey = JSON.stringify(defaults);
  const sortable = config.sortable;
  const sortableKey = sortable?.join('|') ?? '';
  const fallbackPageSize = (PAGE_SIZES as readonly number[]).includes(defaults.pageSize ?? -1)
    ? (defaults.pageSize as number)
    : DEFAULT_PAGE_SIZE;

  const parsers = React.useMemo(() => {
    const d = JSON.parse(defaultsKey) as Record<string, string | undefined>;
    const map: ParserMap = {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(fallbackPageSize),
      q: parseAsString.withDefault(''),
      sort: d.sort ? parseAsString.withDefault(d.sort) : parseAsString,
      order: d.order ? parseAsStringLiteral(ORDERS).withDefault(d.order as SortOrder) : parseAsStringLiteral(ORDERS),
    };
    for (const name of filterNames) {
      const def = d[name];
      map[name] = def ? parseAsString.withDefault(def) : parseAsString;
    }
    return map;
  }, [defaultsKey, filterNames, fallbackPageSize]);

  const [urlValues, setRaw] = useQueryStates(parsers, { history: 'replace', shallow: true, scroll: false, clearOnDefault: true });

  const ready = useHydrated();
  const storedPageSize = React.useSyncExternalStore(
    subscribePageSize,
    () => readStoredPageSize(id),
    () => null
  );

  // During hydration render the defaults (what the prerendered HTML contains).
  const defaultValues = React.useMemo(() => {
    const d = JSON.parse(defaultsKey) as Record<string, string | undefined>;
    const values: Record<string, unknown> = { page: 1, pageSize: fallbackPageSize, q: '', sort: d.sort ?? null, order: d.order ?? null };
    for (const name of filterNames) values[name] = d[name] ?? null;
    return values;
  }, [defaultsKey, filterNames, fallbackPageSize]);
  const raw = (ready ? urlValues : defaultValues) as typeof urlValues;

  const urlHasPageSize = raw.pageSize !== fallbackPageSize;
  const pageSizeFromUrl = (PAGE_SIZES as readonly number[]).includes(raw.pageSize as number) ? (raw.pageSize as number) : null;
  const rememberedPageSize = ready ? storedPageSize : null;

  const params = React.useMemo(() => {
    const out: Record<string, unknown> = {
      page: Math.max(1, Math.floor(Number(raw.page) || 1)),
      pageSize: (urlHasPageSize ? pageSizeFromUrl : rememberedPageSize) ?? fallbackPageSize,
      q: (raw.q as string) ?? '',
      sort: (raw.sort as string | null) ?? null,
      order: (raw.order as SortOrder | null) ?? null,
    };
    const allowed = sortableKey ? sortableKey.split('|') : null;
    if (out.sort && allowed && !allowed.includes(out.sort as string)) {
      out.sort = null;
      out.order = null;
    }
    if (!out.sort) out.order = null;
    for (const name of filterNames) out[name] = (raw[name] as string | null) ?? null;
    return out as ListParams<F>;
  }, [raw, urlHasPageSize, pageSizeFromUrl, rememberedPageSize, fallbackPageSize, sortableKey, filterNames]);

  const setParams = React.useCallback(
    (patch: ListPatch<F>) => {
      const next: Record<string, unknown> = { ...patch };
      if (!('page' in patch)) next.page = null;
      if ('pageSize' in patch) writeStoredPageSize(id, patch.pageSize ?? null);
      if ('q' in patch && typeof patch.q === 'string') next.q = patch.q.trim() || null;
      void setRaw(next as Parameters<typeof setRaw>[0]);
    },
    [id, setRaw]
  );


  const clearFilters = React.useCallback(() => {
    const next: Record<string, null> = { q: null, page: null };
    for (const name of filterNames) next[name] = null;
    void setRaw(next as Parameters<typeof setRaw>[0]);
  }, [filterNames, setRaw]);

  const activeFilters = React.useMemo(() => {
    const d = JSON.parse(defaultsKey) as Record<string, string | undefined>;
    const list: ActiveFilter[] = [];
    if (params.q) list.push({ name: 'q', value: params.q });
    for (const name of filterNames) {
      const value = params[name] as string | null;
      if (value && value !== (d[name] ?? null)) list.push({ name, value });
    }
    return list;
  }, [params, filterNames, defaultsKey]);

  const apiParams = React.useMemo(() => {
    const out: Record<string, string | number> = { page: params.page, pageSize: params.pageSize };
    if (params.q) out.q = params.q;
    if (params.sort) {
      out.sort = params.sort;
      if (params.order) out.order = params.order;
    }
    for (const name of filterNames) {
      const value = params[name] as string | null;
      if (value && value !== ALL) out[name] = value;
    }
    return out;
  }, [params, filterNames]);

  return {
    params,
    setParams,
    clearFilters,
    ready,
    activeFilters,
    isFiltered: activeFilters.length > 0,
    apiParams,
  };
}
