// Client-side stale-while-revalidate cache for the dashboard summary.
// Stored in localStorage so it survives in-app navigation but not hard refresh.

const CACHE_KEY = 'dashboard_summary_v1';
const TTL_MS = 3 * 60 * 1000; // 3 minutes

interface CacheEntry {
  data: any;
  ts: number;
}

export function loadDashboardCache(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function saveDashboardCache(data: any): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable (private mode quota etc.) — silently skip
  }
}

// Call this from any page that performs mutations (loans, chit-funds, repayments, contributions)
export function invalidateDashboardCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
