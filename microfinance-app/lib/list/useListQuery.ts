'use client';

/**
 * Fetch one page of a list through SWR, driven by useListParams.
 *
 *   const list = useListParams({ id: 'loans', filters: ['status'], defaults: { status: 'Active' } });
 *   const { items, meta, isInitialLoading, isRefreshing } = useListQuery<Loan>('loans', list, { itemsKey: 'loans' });
 *
 * - Waits for `list.ready`, so the first request already carries the URL's params.
 * - Keeps the previous page's rows while the next one loads (`isRefreshing`);
 *   `isInitialLoading` is true only when nothing is cached yet (show skeletons then).
 * - Reads the list envelope (`items` + `meta`) and, until an endpoint has it,
 *   the legacy shape (`<itemsKey>`, `totalCount`, `totalPages`).
 * - Snaps an out-of-range page to the last page.
 */
import * as React from 'react';
import useSWR, { type KeyedMutator, type SWRConfiguration } from 'swr';
import { queryKeys, type QueryKey, type QueryParams } from '../query/keys';
import { buildMeta, type ListMeta, type SortOrder } from './types';

export interface ListResult<TItem, TSummary = unknown, TFacets = unknown> {
  items: TItem[];
  meta: ListMeta;
  summary?: TSummary;
  facets?: TFacets;
}

/** The parts of a list controller (useListParams) that the query needs. */
export interface ListQueryInput {
  apiParams: Record<string, string | number>;
  ready?: boolean;
  setParams?: (patch: { page: number }) => void;
}

export interface UseListQueryOptions<TItem, TSummary, TFacets> {
  /** API action, default 'list'. */
  action?: string;
  /** Legacy response key holding the rows, e.g. 'loans'. */
  itemsKey?: string;
  /** Extra API params that are not part of the URL state. */
  extraParams?: QueryParams;
  /** Set false to hold the request. */
  enabled?: boolean;
  /** Custom mapping from the raw response. */
  select?: (raw: unknown, request: Record<string, string | number>) => ListResult<TItem, TSummary, TFacets>;
  swr?: SWRConfiguration;
}

export interface UseListQueryResult<TItem, TSummary, TFacets> {
  items: TItem[];
  meta: ListMeta | null;
  summary: TSummary | undefined;
  facets: TFacets | undefined;
  /** No data for this list yet: show skeleton rows. */
  isInitialLoading: boolean;
  /** Showing the previous params' rows while new ones load: dim them, never blank. */
  isRefreshing: boolean;
  /** Any request in flight, including silent background revalidation. */
  isValidating: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<unknown>;
  key: QueryKey | null;
}

type Raw = Record<string, unknown>;

const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Read either the envelope or a legacy `{ <itemsKey>, totalCount, totalPages }` response. */
export function normaliseListResponse<TItem, TSummary = unknown, TFacets = unknown>(
  raw: unknown,
  request: Record<string, string | number>,
  itemsKey?: string
): ListResult<TItem, TSummary, TFacets> {
  const body: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const fromKey = itemsKey ? body[itemsKey] : undefined;
  const items = (Array.isArray(body.items)
    ? body.items
    : Array.isArray(fromKey)
      ? fromKey
      : Array.isArray(body.data)
        ? body.data
        : Array.isArray(raw)
          ? raw
          : []) as TItem[];

  if (body.meta && typeof body.meta === 'object') {
    return { items, meta: body.meta as ListMeta, summary: body.summary as TSummary, facets: body.facets as TFacets };
  }

  const page = num(body.page ?? body.currentPage, num(request.page, 1));
  const pageSize = num(body.pageSize, num(request.pageSize, items.length || 10));
  const totalCount = num(body.totalCount ?? body.total, items.length);
  return {
    items,
    meta: buildMeta({
      page,
      pageSize,
      totalCount,
      sort: (request.sort as string) ?? null,
      order: (request.order as SortOrder) ?? null,
      q: (request.q as string) ?? null,
    }),
    summary: body.summary as TSummary,
    facets: body.facets as TFacets,
  };
}

export function useListQuery<TItem, TSummary = unknown, TFacets = unknown>(
  resource: string,
  list: ListQueryInput,
  options: UseListQueryOptions<TItem, TSummary, TFacets> = {}
): UseListQueryResult<TItem, TSummary, TFacets> {
  const { action = 'list', itemsKey, extraParams, enabled = true, select, swr } = options;
  const request = React.useMemo(() => ({ ...list.apiParams, ...(extraParams as Record<string, string | number>) }), [list.apiParams, extraParams]);
  const key: QueryKey | null =
    enabled && list.ready !== false
      ? action === 'list'
        ? queryKeys.list(resource, request)
        : queryKeys.action(resource, action, null, request)
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<unknown, Error>(key, swr);

  const result = React.useMemo(() => {
    if (data === undefined) return null;
    return select ? select(data, request) : normaliseListResponse<TItem, TSummary, TFacets>(data, request, itemsKey);
    // `request` is captured with the data it produced through the key; recompute on data change only.
  }, [data]);

  const meta = result?.meta ?? null;
  const setParams = list.setParams;
  React.useEffect(() => {
    if (!meta || !setParams || isLoading) return;
    if (meta.totalPages > 0 && meta.page > meta.totalPages) setParams({ page: meta.totalPages });
  }, [meta, setParams, isLoading]);

  return {
    items: result?.items ?? [],
    meta,
    summary: result?.summary,
    facets: result?.facets,
    isInitialLoading: data === undefined && !error,
    isRefreshing: data !== undefined && isLoading,
    isValidating,
    error,
    mutate,
    key,
  };
}
