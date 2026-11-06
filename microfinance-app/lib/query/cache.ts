/**
 * In-memory SWR cache capped at a fixed number of keys (oldest written first out).
 * SWR rewrites a key's entry on every state change, so keys on screen stay fresh.
 */
export class CappedCache<V> extends Map<string, V> {
  private readonly limit: number;

  constructor(limit = 200) {
    super();
    this.limit = limit;
  }

  set(key: string, value: V): this {
    if (this.has(key)) super.delete(key);
    super.set(key, value);
    while (this.size > this.limit) {
      const oldest = this.keys().next().value;
      if (oldest === undefined) break;
      super.delete(oldest);
    }
    return this;
  }
}
