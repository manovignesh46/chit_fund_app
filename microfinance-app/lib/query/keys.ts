/**
 * Query keys: `[resource, action, idOrNull, params]`.
 *
 *   ['loans', 'list', null, { page: 2, status: 'Active' }]
 *   ['loans', 'detail', 12]
 *
 * The active partner is deliberately NOT part of a key: the server only reads the
 * `x-active-partner` header on write paths, so reads are the same for every partner.
 */

export type QueryParamValue = string | number | boolean | null | undefined | readonly string[];
export type QueryParams = Readonly<Record<string, QueryParamValue>>;
export type QueryId = string | number | null;
export type QueryKey =
  | readonly [resource: string, action: string]
  | readonly [resource: string, action: string, id: QueryId]
  | readonly [resource: string, action: string, id: QueryId, params: QueryParams];

/** Drop empty values and sort keys, so equal params give equal keys and short URLs. */
export function cleanParams(params: QueryParams | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const name of Object.keys(params).sort()) {
    const value = params[name];
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) out[name] = value.join(',');
      continue;
    }
    out[name] = String(value);
  }
  return out;
}

export const queryKeys = {
  list: (resource: string, params?: QueryParams): QueryKey => [resource, 'list', null, cleanParams(params)],
  detail: (resource: string, id: string | number, params?: QueryParams): QueryKey =>
    params ? [resource, 'detail', id, cleanParams(params)] : [resource, 'detail', id],
  action: (resource: string, action: string, id: QueryId = null, params?: QueryParams): QueryKey =>
    params ? [resource, action, id, cleanParams(params)] : [resource, action, id],
};

/** Builds the GET URL (relative to /api) for a key. */
export type EndpointBuilder = (action: string, id: QueryId, params: Record<string, string>) => string;

/**
 * Default: `/{resource}/consolidated?action={action}&id={id}&...params`, the pattern most
 * API routes use. Families whose endpoints differ register their own builder.
 */
const consolidated =
  (resource: string): EndpointBuilder =>
  (action, id, params) => {
    const search = new URLSearchParams({ action });
    if (id !== null && id !== undefined) search.set('id', String(id));
    for (const [name, value] of Object.entries(params)) search.set(name, value);
    return `/${resource}/consolidated?${search.toString()}`;
  };

const endpoints = new Map<string, EndpointBuilder>();

/** Register a custom URL builder for a resource (call at module load in lib/query/<family>.ts). */
export function registerEndpoint(resource: string, builder: EndpointBuilder): void {
  endpoints.set(resource, builder);
}

export function isQueryKey(value: unknown): value is QueryKey {
  return Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'string';
}

/** The /api-relative URL a key fetches, e.g. `/loans/consolidated?action=list&page=2`. */
export function keyToEndpoint(key: QueryKey): string {
  const [resource, action, id = null, params] = key;
  const builder = endpoints.get(resource) ?? consolidated(resource);
  return builder(action, id ?? null, cleanParams(params));
}
