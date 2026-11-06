/**
 * Cache invalidation by tag, usable outside React (event handlers, lib/api.ts).
 *
 * A tag is a resource name ('loans') or a key prefix (['loans', 'detail', 12]).
 * Matching keys are revalidated if a component shows them; unmounted keys are
 * marked stale so their next mount fetches (cached data still paints first).
 *
 * The SWR provider (provider.tsx) registers its scoped `mutate` here on mount.
 */
import { unstable_serialize, type Cache, type ScopedMutator } from 'swr';
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
  const cache = cacheRef;
  const clear = () => {
    if (cache && 'clear' in cache && typeof (cache as unknown as Map<string, unknown>).clear === 'function') {
      (cache as unknown as Map<string, unknown>).clear();
    }
  };
  // The mutate settles asynchronously and can re-add a key after the first clear(): clear again then.
  void mutateRef(() => true, undefined, { revalidate: false }).finally(clear);
  clear();
}

/**
 * Put prefetched data into the cache for a key that has none yet, so the page that
 * needs it paints at once. Never overwrites data already cached (that data is newer
 * or equally fresh and is revalidated on mount anyway).
 */
export function primeCache(key: QueryKey, data: unknown): void {
  if (!mutateRef || !cacheRef) return;
  const existing = cacheRef.get(unstable_serialize(key));
  if (existing && existing.data !== undefined) return;
  void mutateRef(key, data, { revalidate: false });
}

/** For tests and the styleguide: is this key one the tag would invalidate? */
export function tagMatchesKey(tag: QueryTag, key: QueryKey): boolean {
  return matches(key, tag);
}
