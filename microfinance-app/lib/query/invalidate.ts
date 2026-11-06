/**
 * Cache invalidation by tag, usable outside React (event handlers, lib/api.ts).
 *
 * A tag is a resource name ('loans') or a key prefix (['loans', 'detail', 12]).
 * Matching keys are revalidated if a component shows them; unmounted keys are
 * marked stale so their next mount fetches (cached data still paints first).
 *
 * The SWR provider (provider.tsx) registers its scoped `mutate` here on mount.
 */
import type { Cache, ScopedMutator } from 'swr';
import type { QueryKey } from './keys';

export type QueryTag = string | readonly [resource: string, action?: string, id?: string | number | null];

let mutateRef: ScopedMutator | null = null;
let cacheRef: Cache | null = null;

/** Called by QueryProvider. Not for app code. */
export function registerQueryClient(mutate: ScopedMutator, cache: Cache): () => void {
  mutateRef = mutate;
  cacheRef = cache;
  return () => {
    if (mutateRef === mutate) {
      mutateRef = null;
      cacheRef = null;
    }
  };
}

function matches(key: unknown, tag: QueryTag): boolean {
  if (!Array.isArray(key)) return false;
  const [resource, action, id] = typeof tag === 'string' ? [tag] : tag;
  if (key[0] !== resource) return false;
  if (action !== undefined && key[1] !== action) return false;
  if (id !== undefined && id !== null && String(key[2]) !== String(id)) return false;
  return true;
}

/** Revalidate every cached query matching any of the tags. Resolves when refetches settle. */
export async function invalidate(...tags: QueryTag[]): Promise<void> {
  if (!mutateRef || tags.length === 0) return;
  await mutateRef((key) => tags.some((tag) => matches(key, tag)));
}

/** Money-related views that change after any financial write (SPEC "Invalidation"). */
export const MONEY_TAGS: readonly QueryTag[] = ['dashboard', 'dues', 'transactions', 'calendar', 'trends', 'activities'];

/** Revalidate everything that is cached (e.g. after switching the active partner). */
export async function revalidateAll(): Promise<void> {
  if (!mutateRef) return;
  await mutateRef(() => true);
}

/**
 * Drop all cached data without refetching. Use on login, logout and when the
 * signed-in identity (partner lock) changes, so one user never sees another's data.
 */
export function clearAllCaches(): void {
  if (!mutateRef) return;
  void mutateRef(() => true, undefined, { revalidate: false });
  if (cacheRef && 'clear' in cacheRef && typeof (cacheRef as unknown as Map<string, unknown>).clear === 'function') {
    (cacheRef as unknown as Map<string, unknown>).clear();
  }
}

/** For tests and the styleguide: is this key one the tag would invalidate? */
export function tagMatchesKey(tag: QueryTag, key: QueryKey): boolean {
  return matches(key, tag);
}
