/**
 * Server helpers for list endpoints (SPEC "List contract").
 *
 *   const list = parseListParams(searchParams, {
 *     sortable: { amount: 'amount', borrower: (o) => ({ borrower: { name: o } }) },
 *     searchable: ['borrower.name', 'borrower.contact'],
 *     filters: ['status'],
 *   });
 *   const where = { createdById: userId, ...(list.filters.status && { status: list.filters.status }), ...list.searchWhere };
 *   const rows = await prisma.loan.findMany({ where, orderBy: list.orderBy ?? { createdAt: 'desc' }, skip: list.skip, take: list.take });
 *   return NextResponse.json({ ...legacyBody, ...listEnvelope('loans', rows, { ...list, totalCount }) });
 *
 * Every new parameter is optional: with none supplied, `orderBy` and `searchWhere`
 * are undefined and the handler runs exactly the query it ran before.
 * Sorting only goes through the whitelist (never a raw column name from the URL),
 * with `id` as the tiebreaker. `pageSize` is capped at MAX_PAGE_SIZE (100).
 */
import { ALL, buildMeta, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type ListEnvelope, type ListMeta, type SortOrder } from './types';

/** Prisma orderBy fragment, e.g. `{ amount: 'desc' }` or `{ borrower: { name: 'asc' } }`. */
export type OrderByFragment = Record<string, unknown>;
/** A field name, or a function building a (nested) orderBy for the requested direction. */
export type SortTarget = string | ((order: SortOrder) => OrderByFragment);

export interface ParseListConfig<F extends string = never> {
  /** Public sort key → Prisma field or builder. Keys not listed are ignored. */
  sortable?: Readonly<Record<string, SortTarget>>;
  /** Applied when `sort` is absent. Leave unset to keep the handler's own default order. */
  defaultSort?: { sort: string; order: SortOrder };
  /** Dotted field paths searched case-insensitively with `q`, e.g. 'borrower.name'. */
  searchable?: readonly string[];
  /** Filter param names to read; values are returned as-is (multi-value stays comma-separated). */
  filters?: readonly F[];
  defaultPageSize?: number;
  /** Tiebreaker field appended to every sort. Default 'id'. Set null to disable. */
  tiebreaker?: string | null;
}

export interface ParsedListParams<F extends string = never> {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q: string | null;
  sort: string | null;
  order: SortOrder | null;
  filters: Record<F, string | null>;
  /** undefined when no (valid) sort was requested and there is no defaultSort. */
  orderBy: OrderByFragment[] | undefined;
  /** undefined when `q` is empty or nothing is searchable. Spread into `where`. */
  searchWhere: { OR: OrderByFragment[] } | undefined;
}

type SearchParamsLike = Pick<URLSearchParams, 'get'>;

function nest(path: string, leaf: unknown): OrderByFragment {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, part) => ({ [part]: acc }), leaf) as OrderByFragment;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return n > 0 ? n : fallback;
}

export function parseListParams<F extends string = never>(
  searchParams: SearchParamsLike,
  config: ParseListConfig<F> = {}
): ParsedListParams<F> {
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = Math.min(positiveInt(searchParams.get('pageSize'), config.defaultPageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const rawQ = (searchParams.get('q') ?? '').trim();
  const q = rawQ ? rawQ.slice(0, 200) : null;

  const rawSort = searchParams.get('sort');
  const rawOrder = searchParams.get('order');
  const requestedOrder: SortOrder | null = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : null;
  const sortable = config.sortable ?? {};
  const hasRequestedSort = !!rawSort && Object.prototype.hasOwnProperty.call(sortable, rawSort);

  let sort: string | null = null;
  let order: SortOrder | null = null;
  if (hasRequestedSort) {
    sort = rawSort;
    order = requestedOrder ?? 'asc';
  } else if (config.defaultSort && Object.prototype.hasOwnProperty.call(sortable, config.defaultSort.sort)) {
    sort = config.defaultSort.sort;
    order = config.defaultSort.order;
  }

  let orderBy: OrderByFragment[] | undefined;
  if (sort && order) {
    const target = sortable[sort];
    const fragment = typeof target === 'function' ? target(order) : nest(target, order);
    const tiebreaker = config.tiebreaker === undefined ? 'id' : config.tiebreaker;
    orderBy = tiebreaker && target !== tiebreaker ? [fragment, { [tiebreaker]: order }] : [fragment];
  }

  let searchWhere: ParsedListParams<F>['searchWhere'];
  if (q && config.searchable?.length) {
    searchWhere = { OR: config.searchable.map((path) => nest(path, { contains: q, mode: 'insensitive' })) };
  }

  const filters = {} as Record<F, string | null>;
  for (const name of config.filters ?? []) {
    const value = searchParams.get(name);
    filters[name] = value && value !== ALL ? value : null;
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q,
    sort,
    order,
    filters,
    orderBy,
    searchWhere,
  };
}

export type ListMetaInput = Pick<ListMeta, 'page' | 'pageSize' | 'totalCount'> &
  Partial<Pick<ListMeta, 'sort' | 'order' | 'q'>>;

/**
 * The envelope to spread into a response next to its existing keys:
 * `{ [key]: items, items, meta, ...extras }`. Legacy callers keep reading `key`.
 */
export function listEnvelope<TItem, TExtras extends Record<string, unknown> = Record<string, never>>(
  key: string,
  items: TItem[],
  meta: ListMetaInput,
  extras?: TExtras
): ListEnvelope<TItem> & Record<string, unknown> & TExtras {
  return {
    [key]: items,
    items,
    meta: buildMeta(meta),
    ...(extras ?? ({} as TExtras)),
  } as ListEnvelope<TItem> & Record<string, unknown> & TExtras;
}
