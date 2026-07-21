# Tab Swipe Navigation

## Objective

On mobile, allow users to swipe left/right anywhere within the tab content area to
navigate between tabs — instead of having to tap the tab buttons. Content **slides and
follows the finger** (native-app feel), snapping to the next/previous tab on release.

---

## Pages with Tabs

| Page | Tabs (left → right) |
|------|----------------------|
| Dashboard | overview → trends → collections → activities → events |
| Transactions | summary → record-transactions |
| Members detail | details → chit-funds → loans |
| Chit Fund detail | overview → contributions → auctions |
| Loan detail | loan-details → payment-schedule → record-payment |

---

## Hard Constraints (must not break)

### 1. Left 1/3 right-swipe → opens sidebar
`Sidebar.tsx` listens on `document` for right-swipes originating from `< window.innerWidth / 4`
(left quarter) to open the navigation drawer.
**Tab swipe ignores right-swipes starting from the left 1/3 of the screen** (slightly wider
guard than the sidebar's own 1/4 trigger, so the two gestures never both fire).

### 2. Horizontal swipe on tables → table scrolls
Tables render inside horizontally-scrollable containers (`overflow-x-auto`). If the swipe
target is inside an element that can still scroll in that direction, the browser handles it
(table scrolls, tab does not change).

### 3. Vertical swipe → page scrolls
If the gesture is primarily vertical, it is never intercepted — the browser scrolls normally.

---

## Implementation

### Component: `app/components/SwipeableTabs.tsx`

A reusable, generic (`<T extends string>`) client component. Unlike the original design (see
"History" below), this is a **sliding-panel track**, not an instant tab switch:

- All panels render simultaneously, laid out side-by-side in a flex track
  (`flex: 0 0 100%` each), clipped by an `overflow-x: hidden` viewport.
- The track's `transform: translateX(...)` rests at `-activeIndex * 100%`.
- Touch listeners (`touchstart`/`touchmove`/`touchend`/`touchcancel`) are attached directly to
  the component's own viewport element — **not `document`** — via a `useEffect` with `[]` deps.
  Live values (`activeTab`, `tabs`, `onTabChange`) are read through refs on every touch, so the
  effect never needs to rebind.
- **`touchmove`**: locks direction after 5px of travel (horizontal vs. vertical). Vertical →
  ignored (page scrolls). Horizontal starting in the left 1/3 while swiping right → ignored
  (sidebar owns it). Horizontal over a still-scrollable ancestor (`scrollWidth > clientWidth`,
  same parent-walk check `Sidebar.tsx` uses) → ignored (element scrolls). Otherwise the drag is
  "owned": `preventDefault()` is called (so page scroll doesn't fight the drag) and the track's
  transform is updated live to follow the finger, with rubber-banding past the first/last tab.
- **`touchend`**: commits to the next/previous tab on a fast flick (`velocity > 0.3px/ms` and
  `>20px` travel) or a long drag (`>25%` of viewport width); otherwise snaps back to the current
  tab. Commit calls `onTabChange`, which is the page's own `setActiveTab`.
- Desktop (`window.innerWidth >= 1024`) never binds the drag listeners — tab buttons still work
  and still animate the same slide via the `transform` CSS transition.

### Per-page wiring

Each page wraps its tab panels (previously `{activeTab === "x" && <Panel/>}` conditionals) in
`SwipeableTabs`, rendering **all** panels unconditionally, in tab order, as children:

```tsx
<SwipeableTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
  <PanelA />
  <PanelB />
</SwipeableTabs>
```

The tab nav bar (buttons calling `setActiveTab`) is untouched and sits above `SwipeableTabs`.
Existing per-tab lazy-load guards (`useRef` flags like `trendsInitialized`,
`contributionsInitialized`, `schedulesInitialized`, keyed on `activeTab`) are unaffected — data
fetching stays lazy; only *rendering* changed from "mount active panel only" to "mount all,
show one". Panels not yet activated show their existing skeleton/empty state until swiped to.

---

## Current Status

Implemented and wired into all 5 pages listed above. `SwipeableTabs` binds its gesture
listeners to its own DOM element, which only mounts once each page's loading gate clears — see
"History" below for why this matters.

---

## History

An earlier attempt (component `app/hooks/useTabSwipe.ts`) implemented **instant tab switching**
(no sliding) and was fully reverted (commit `975e4f5`) after a bug: swipe didn't work on the
first interaction, only after the user had already tapped a tab once.

**Root cause:** that hook bound `touchstart/move/end` to `document` in a `useEffect` with `[]`
deps, and used `containerRef.current` — but on 4 of 5 pages the tab wrapper sits behind a
loading gate (`loading ? <Skeleton/> : <div ref={tabSwipeRef}>...</div>`, or an early-return
skeleton). The effect ran once on mount, before the wrapper existed in the DOM, so the ref was
null / `contains()` failed on first touch.

The current `SwipeableTabs` avoids this structurally: its own touch listeners are attached
inside *its own* `useEffect`, which only runs after `SwipeableTabs` itself has mounted — which
only happens once the page is past its loading gate and the component is actually in the DOM.
There is no `document`-level listener and no dependency on an external ref existing early.
