// Simple in-memory cache utility for API routes

type CacheEntry<T> = {
  data: T;
  expiry: number;
};

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 60 * 1000; // 1 minute in milliseconds

  // Get data from cache or fetch it using the provided function
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Return cached data if it exists and hasn't expired
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache
    this.cache.set(key, {
      data,
      expiry: now + ttl,
    });

    return data;
  }

  // Manually set cache entry
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  // Manually invalidate cache entry
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  // Invalidate all cache entries that match a prefix
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear the entire cache
  clear(): void {
    this.cache.clear();
  }
}

// Create a singleton instance
export const apiCache = new APICache();
