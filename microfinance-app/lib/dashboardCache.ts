// Dashboard summary cache facade.
//
// The dashboard page still keeps its summary in localStorage (stale-while-revalidate,
// survives in-app navigation but expires after 3 minutes). New code reads the dashboard
// through SWR (lib/query); invalidateDashboardCache() clears both, so every existing
// caller keeps working and also refreshes SWR queries tagged 'dashboard'.

import { invalidate } from './query/invalidate';

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
  void invalidate('dashboard');
}
