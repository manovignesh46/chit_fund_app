/** Shared list contract types (client and server). See SPEC "List contract". */

export type SortOrder = 'asc' | 'desc';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;
/** Largest page a list endpoint returns (the biggest rows-per-page choice); larger requests get this many. */
export const MAX_PAGE_SIZE = 100;

/** Filter value meaning "no filter" when the list has a non-empty default (e.g. loans status=Active). */
export const ALL = 'all';

/** Pagination and sort metadata returned by list endpoints (`meta` in the envelope). */
export interface ListMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  sort: string | null;
  order: SortOrder | null;
  q: string | null;
}

/** The list envelope added alongside each endpoint's existing keys. */
export interface ListEnvelope<TItem, TSummary = unknown, TFacets = unknown> {
  items: TItem[];
  meta: ListMeta;
  summary?: TSummary;
  facets?: TFacets;
}

export function buildMeta(input: {
  page: number;
  pageSize: number;
  totalCount: number;
  sort?: string | null;
  order?: SortOrder | null;
  q?: string | null;
}): ListMeta {
  const totalPages = input.pageSize > 0 ? Math.ceil(input.totalCount / input.pageSize) : 0;
  return {
    page: input.page,
    pageSize: input.pageSize,
    totalCount: input.totalCount,
    totalPages,
    hasPrev: input.page > 1,
    hasNext: input.page < totalPages,
    sort: input.sort ?? null,
    order: input.order ?? null,
    q: input.q ?? null,
  };
}
