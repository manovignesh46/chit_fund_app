"use client";

import React, { useEffect, useRef } from "react";

interface SwipeableTabsProps<T extends string> {
  /** Ordered tab ids. Must match the order of `children` panels 1:1. */
  tabs: readonly T[];
  /** Currently active tab id (controlled by the parent page). */
  activeTab: T;
  /** Called when a swipe commits to a different tab. */
  onTabChange: (tab: T) => void;
  /**
   * One panel node per tab, in the same order as `tabs`.
   * All panels are always rendered (laid out in a horizontal track); only the
   * active one is visible. Pass exactly `tabs.length` children, unconditionally.
   */
  children: React.ReactNode;
  className?: string;
}

// Settle animation used when snapping to a tab (after release or a tab-button click).
const SETTLE = "transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)";

/**
 * Mobile sliding tab panels. Swipe left/right on the content to move between
 * tabs; the track follows the finger and snaps to the next/previous tab on
 * release. Tab-button clicks (which change `activeTab`) animate the same slide.
 *
 * Design notes / constraints preserved (mirrors Sidebar.tsx gesture logic):
 *  - Listeners bind to this component's own element (not `document`) and the
 *    component only mounts once its page's content is past the loading gate, so
 *    the gesture works on first touch — no stale/null-ref binding.
 *  - `preventDefault` is called ONLY on a locked horizontal drag we own, so
 *    vertical page scrolling is never blocked.
 *  - A right-swipe originating in the left 1/3 of the screen is handed off to
 *    the sidebar's swipe-to-open gesture.
 *  - A horizontal swipe over a still-scrollable element (e.g. a wide table in
 *    `.table-shell`) is handed off to the browser so the table scrolls.
 *  - Desktop (>= 1024px) has no drag; tab clicks still animate the slide.
 */
export default function SwipeableTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: SwipeableTabsProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, tabs.indexOf(activeTab));

  // Live refs so the one-time touch effect reads current values without rebinding.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onChangeRef = useRef(onTabChange);
  onChangeRef.current = onTabChange;

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    // Mobile only — desktop keeps tap-to-switch.
    if (typeof window !== "undefined" && window.innerWidth >= 1024) return;

    const g = {
      startX: 0,
      startY: 0,
      lastX: 0,
      lastTime: 0,
      velocityX: 0,
      locked: null as null | "h" | "v",
      owning: false, // we are actively dragging the track
      ignored: false, // gesture handed off (vertical / sidebar / table scroll)
      originLeftThird: false,
    };

    const baseTransform = () =>
      `translateX(-${activeIndexRef.current * 100}%)`;

    const setDrag = (px: number) => {
      track.style.transition = "none";
      track.style.transform = `translateX(calc(-${activeIndexRef.current * 100}% + ${px}px))`;
    };

    const settleTo = (transform: string) => {
      track.style.transition = SETTLE;
      track.style.transform = transform;
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.lastX = t.clientX;
      g.lastTime = Date.now();
      g.velocityX = 0;
      g.locked = null;
      g.owning = false;
      g.ignored = false;
      g.originLeftThird = t.clientX < window.innerWidth / 3;
    };

    const onMove = (e: TouchEvent) => {
      if (g.ignored) return;
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Lock gesture direction after 5px of travel.
      if (g.locked === null) {
        if (adx < 5 && ady < 5) return;
        g.locked = adx >= ady ? "h" : "v";

        if (g.locked === "v") {
          g.ignored = true; // vertical -> let the page scroll
          return;
        }

        // Right-swipe from the left 1/3 is reserved for the sidebar open gesture.
        if (dx > 0 && g.originLeftThird) {
          g.ignored = true;
          return;
        }

        // If the touch is inside a still-scrollable horizontal container
        // (e.g. a wide table), let the browser scroll it instead.
        // A small tolerance avoids false positives from sub-pixel layout
        // rounding (flex/grid containers routinely report scrollWidth a
        // fraction of a px larger than clientWidth with nothing to scroll).
        // Stop at `track` (not just `viewport`): the track itself is our
        // own flex rail holding every panel side by side, so it is always
        // many panel-widths wider than its clientWidth with scrollLeft
        // permanently 0 (we move it via `transform`, never native scroll) —
        // checking it would treat every leftward drag as "still scrollable".
        const OVERFLOW_TOLERANCE = 4;
        let el = e.target as HTMLElement | null;
        while (el && el !== viewport && el !== track) {
          const overflow = el.scrollWidth - el.clientWidth;
          if (overflow > OVERFLOW_TOLERANCE) {
            if (
              (dx < 0 && el.scrollLeft < overflow - OVERFLOW_TOLERANCE) ||
              (dx > 0 && el.scrollLeft > OVERFLOW_TOLERANCE)
            ) {
              g.ignored = true;
              return;
            }
          }
          el = el.parentElement;
        }

        g.owning = true;
      }

      if (!g.owning) return;

      // We own a horizontal drag — take over the gesture.
      if (e.cancelable) e.preventDefault();

      const now = Date.now();
      const dt = now - g.lastTime;
      if (dt > 0) g.velocityX = (t.clientX - g.lastX) / dt;
      g.lastX = t.clientX;
      g.lastTime = now;

      // Rubber-band when dragging past the first / last tab.
      let eff = dx;
      const atFirst = activeIndexRef.current === 0;
      const atLast = activeIndexRef.current === tabsRef.current.length - 1;
      if ((atFirst && dx > 0) || (atLast && dx < 0)) eff = dx * 0.3;

      setDrag(eff);
    };

    const onEnd = () => {
      if (!g.owning) return;
      g.owning = false;

      const width = viewport.clientWidth || window.innerWidth;
      const dx = g.lastX - g.startX;
      const adx = Math.abs(dx);
      const idx = activeIndexRef.current;
      const last = tabsRef.current.length - 1;

      const fastFlick = Math.abs(g.velocityX) > 0.3 && adx > 20;
      const farEnough = adx > width * 0.25;
      const commit = fastFlick || farEnough;

      let target = idx;
      if (commit && dx < 0 && idx < last) target = idx + 1;
      else if (commit && dx > 0 && idx > 0) target = idx - 1;

      if (target !== idx) {
        // Begin the settle immediately, then let React re-render with the new tab.
        settleTo(`translateX(-${target * 100}%)`);
        onChangeRef.current(tabsRef.current[target]);
      } else {
        settleTo(baseTransform()); // snap back
      }
    };

    viewport.addEventListener("touchstart", onStart, { passive: true });
    viewport.addEventListener("touchmove", onMove, { passive: false });
    viewport.addEventListener("touchend", onEnd);
    viewport.addEventListener("touchcancel", onEnd);
    return () => {
      viewport.removeEventListener("touchstart", onStart);
      viewport.removeEventListener("touchmove", onMove);
      viewport.removeEventListener("touchend", onEnd);
      viewport.removeEventListener("touchcancel", onEnd);
    };
    // Bind once; live values are read through refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panels = React.Children.toArray(children);

  return (
    <div ref={viewportRef} className={className} style={{ overflowX: "hidden" }}>
      <div
        ref={trackRef}
        style={{
          display: "flex",
          transform: `translateX(-${activeIndex * 100}%)`,
          transition: SETTLE,
          willChange: "transform",
        }}
      >
        {panels.map((panel, i) => (
          <div
            key={tabs[i] ?? i}
            style={{ flex: "0 0 100%", minWidth: 0 }}
            aria-hidden={i !== activeIndex}
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
