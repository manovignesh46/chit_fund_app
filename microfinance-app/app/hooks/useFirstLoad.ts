import { useEffect, useRef, useState } from 'react';

/**
 * Splits a page's single `loading` flag into two states:
 *
 * - `initialLoading`: the first load, when there is nothing to show yet. Render a skeleton.
 * - `refreshing`: a later refetch (after a save, a page change, a filter change).
 *   Keep the existing content on screen and dim it instead of replacing it.
 *
 * A page counts as loaded once `loading` has been true and then turned false.
 */
export function useFirstLoad(loading: boolean) {
  const [loaded, setLoaded] = useState(false);
  const sawLoading = useRef(loading);
  if (loading) sawLoading.current = true;

  useEffect(() => {
    if (!loading && sawLoading.current) setLoaded(true);
  }, [loading]);

  return {
    loaded,
    initialLoading: loading && !loaded,
    refreshing: loading && loaded,
  };
}

/**
 * Classes for a container whose content is being refreshed in place.
 * The short delay stops quick refetches from flickering.
 */
export function refreshingClass(refreshing: boolean) {
  return refreshing
    ? 'opacity-60 transition-opacity duration-200 delay-150'
    : 'transition-opacity duration-200';
}
