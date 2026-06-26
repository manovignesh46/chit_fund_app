"use client";

import React, { useEffect, useRef } from "react";

export function useTabSwipe<T extends string>(
  containerRef: React.RefObject<HTMLElement | null>,
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void
) {
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const setActiveTabRef = useRef(setActiveTab);
  setActiveTabRef.current = setActiveTab;

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) return;

    const state = {
      startX: 0,
      startY: 0,
      startTime: 0,
      isOriginLeftThird: false,
      outsideContainer: false,
      // direction lock: undefined = not yet determined, true = horizontal, false = vertical
      directionLocked: undefined as boolean | undefined,
      scrollableCancelled: false,
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Read container live — works even when it's conditionally rendered (loading states)
      const container = containerRef.current;

      // Use DOM containment check — reliable regardless of scroll position
      if (!container || !container.contains(e.target as Node)) {
        state.outsideContainer = true;
        return;
      }

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;

      state.outsideContainer = false;
      state.startX = touchX;
      state.startY = touchY;
      state.startTime = Date.now();
      // Left 1/3 right-swipe is reserved for sidebar open gesture
      state.isOriginLeftThird = touchX < window.innerWidth / 3;
      state.directionLocked = undefined;
      state.scrollableCancelled = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (state.outsideContainer || state.directionLocked === false || state.scrollableCancelled) return;

      const deltaX = e.touches[0].clientX - state.startX;
      const deltaY = e.touches[0].clientY - state.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Lock direction once finger has moved at least 5px
      if (state.directionLocked === undefined) {
        if (absDeltaX < 5 && absDeltaY < 5) return;
        state.directionLocked = absDeltaX >= absDeltaY;
      }

      // Vertical — bail out, let page scroll normally
      if (!state.directionLocked) return;

      // Horizontal locked — check if a scrollable element (e.g. table) should
      // consume this swipe instead of navigating tabs
      const container = containerRef.current;
      let target = e.target as HTMLElement;
      while (target && container && target !== container) {
        if (target.scrollWidth > target.clientWidth) {
          const canScrollLeft =
            deltaX < 0 &&
            target.scrollLeft < target.scrollWidth - target.clientWidth;
          const canScrollRight = deltaX > 0 && target.scrollLeft > 0;
          if (canScrollLeft || canScrollRight) {
            state.scrollableCancelled = true;
            return;
          }
        }
        target = target.parentElement as HTMLElement;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (state.outsideContainer || state.directionLocked !== true || state.scrollableCancelled) return;

      const deltaX = e.changedTouches[0].clientX - state.startX;
      const elapsed = Math.max(Date.now() - state.startTime, 1);
      const velocityX = Math.abs(deltaX) / elapsed; // px/ms

      // Trigger on fast flick OR sufficient travel distance
      const isFastSwipe = velocityX > 0.3 && Math.abs(deltaX) > 15;
      const isLongSwipe = Math.abs(deltaX) >= 30;
      if (!isFastSwipe && !isLongSwipe) return;

      const currentTabs = tabsRef.current;
      const currentActive = activeTabRef.current;
      const currentIdx = currentTabs.indexOf(currentActive);

      if (deltaX < 0) {
        // Swipe left → next tab
        if (currentIdx < currentTabs.length - 1) {
          setActiveTabRef.current(currentTabs[currentIdx + 1]);
        }
      } else {
        // Swipe right → prev tab (skip if in sidebar-open zone)
        if (state.isOriginLeftThird) return;
        if (currentIdx > 0) {
          setActiveTabRef.current(currentTabs[currentIdx - 1]);
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []); // Empty — runs once; containerRef.current is read live on each touch
}
