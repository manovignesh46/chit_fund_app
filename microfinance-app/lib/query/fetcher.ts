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

/** SWR fetcher: accepts a QueryKey (see keys.ts) or a plain /api-relative URL string. */
export function queryFetcher<T = unknown>(key: QueryKey | string): Promise<T> {
  const endpoint = typeof key === 'string' ? key : isQueryKey(key) ? keyToEndpoint(key) : null;
  if (!endpoint) return Promise.reject(new ApiError('Invalid query key', 0));
  return apiFetch<T>(endpoint);
}
