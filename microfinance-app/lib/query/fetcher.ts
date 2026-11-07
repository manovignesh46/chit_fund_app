/**
 * GET fetcher for SWR and a write helper, with the same behaviour as lib/api.ts
 * `fetchAPI` (JSON headers, cookies, no HTTP cache, partner header, 30 s timeout,
 * the same error messages), plus an HTTP status on errors.
 */
import { invalidateDashboardCache } from '../dashboardCache';
import { isQueryKey, keyToEndpoint, type QueryKey } from './keys';

const API_BASE = '/api';
const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function activePartnerName(): string {
  if (typeof window === 'undefined') return 'Me';
  try {
    const id = localStorage.getItem('selectedPartnerId');
    const name = localStorage.getItem('selectedPartnerName');
    return id && name ? name : 'Me';
  } catch {
    return 'Me';
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Plain objects are sent as JSON. */
  body?: unknown;
}

/** Fetch `/api{endpoint}` and parse JSON. Throws ApiError (with status) on failure. */
export async function apiFetch<T>(endpoint: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, headers, signal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-active-partner': activePartnerName(),
        ...(headers as Record<string, string> | undefined),
      },
      body: body === undefined || typeof body === 'string' ? (body as string | undefined) : JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        signal?.aborted ? 'Request cancelled.' : 'Request timed out. The server took too long to respond.',
        0
      );
    }
    throw new ApiError(
      'Network error: Unable to connect to the server. Please check your internet connection and try again.',
      0
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const fromBody =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    throw new ApiError(
      fromBody ?? `${response.status}: ${response.statusText || 'An error occurred while fetching data'}`,
      response.status,
      data
    );
  }

  const method = (rest.method ?? 'GET').toUpperCase();
  if (method !== 'GET') invalidateDashboardCache();
  return data as T;
}

/**
 * Requests started ahead of need (row hover, idle next page; see prefetch.ts), by endpoint.
 * The next SWR fetch of the same endpoint within PREFETCH_TTL_MS takes the request instead
 * of sending a new one, so a prefetch followed by the real mount costs one request.
 * Older entries are ignored: cached data is never trusted as fresh beyond that window.
 */
export const PREFETCH_TTL_MS = 5_000;
const prefetched = new Map<string, { promise: Promise<unknown>; at: number }>();

/** Start and remember a prefetch request for `endpoint` (prefetch.ts). Returns null if a fresh one exists. */
export function rememberPrefetch(endpoint: string, start: () => Promise<unknown>): Promise<unknown> | null {
  const existing = prefetched.get(endpoint);
  if (existing && Date.now() - existing.at < PREFETCH_TTL_MS) return null;
  const promise = start();
  prefetched.set(endpoint, { promise, at: Date.now() });
  promise.catch(() => {
    if (prefetched.get(endpoint)?.promise === promise) prefetched.delete(endpoint);
  });
  return promise;
}

function takePrefetched<T>(endpoint: string): Promise<T> | null {
  const entry = prefetched.get(endpoint);
  if (!entry) return null;
  prefetched.delete(endpoint);
  return Date.now() - entry.at < PREFETCH_TTL_MS ? (entry.promise as Promise<T>) : null;
}

/** SWR fetcher: accepts a QueryKey (see keys.ts) or a plain /api-relative URL string. */
export function queryFetcher<T = unknown>(key: QueryKey | string): Promise<T> {
  const endpoint = typeof key === 'string' ? key : isQueryKey(key) ? keyToEndpoint(key) : null;
  if (!endpoint) return Promise.reject(new ApiError('Invalid query key', 0));
  return takePrefetched<T>(endpoint) ?? apiFetch<T>(endpoint);
}
