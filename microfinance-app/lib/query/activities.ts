/**
 * Activities data family (the /activities list).
 *
 *   const query = useListQuery<ActivityRow>(ACTIVITIES, list, { itemsKey: 'activities' });
 *
 * Keys: ['activities', 'list', null, params]. URL: `/dashboard/consolidated?action=activities&…`.
 * 'activities' is a MONEY tag (invalidate.ts), so every financial write already marks it stale.
 * The page always sends `sort`, which makes the server page the list in SQL (lib/activitiesList.ts).
 */
import { registerEndpoint } from './keys';

export const ACTIVITIES = 'activities';

registerEndpoint(ACTIVITIES, (_action, _id, params) => {
  const query = new URLSearchParams(params).toString();
  return `/dashboard/consolidated?action=activities${query ? `&${query}` : ''}`;
});

/** One activity row, exactly as the API returns it. */
export interface ActivityRow {
  id: string;
  type: 'Loan' | 'Chit Fund';
  action: string;
  details: string;
  /** "06 Nov 2026" (formatted by the server). */
  date: string;
  amount?: number;
  entityId?: number;
  entityType?: 'loan' | 'chitFund' | string;
}

/** Where an activity row leads: its loan or its chit fund (null when it has no record). */
export function activityHref(activity: Pick<ActivityRow, 'entityId' | 'entityType'>): string | null {
  if (!activity.entityId) return null;
  if (activity.entityType === 'loan') return `/loans/${activity.entityId}`;
  if (activity.entityType === 'chitFund') return `/chit-funds/${activity.entityId}`;
  return null;
}
