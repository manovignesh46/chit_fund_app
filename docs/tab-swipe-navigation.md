# Tab Swipe Navigation

## Objective

On mobile, allow users to swipe left/right anywhere within the tab content area to navigate between tabs — instead of having to tap the tab buttons.

---

## Pages with Tabs

| Page | Tabs (left → right) |
|------|----------------------|
| Dashboard | overview → collections → activities → events |
| Transactions | summary → history → record-transactions |
| Members detail | details → chit-funds → loans |
| Chit Fund detail | overview → contributions → auctions |
| Loan detail | loan-details → payment-schedule → record-payment |

---

## Hard Constraints (must not break)

### 1. Left 1/3 right-swipe → opens sidebar
`Sidebar.tsx` listens on `document` for right-swipes originating from `< window.innerWidth / 4` (left quarter) to open the navigation drawer.  
**Tab swipe must not fire for right-swipes starting from the left 1/3 of the screen.**

### 2. Horizontal swipe on tables → table scrolls
Tables use `overflow-x-auto`. If the swipe target is inside a horizontally scrollable element that can still scroll in that direction, the browser must handle it (table scrolls, tab does not change).

### 3. Vertical swipe → page scrolls
If the gesture is primarily vertical, do not intercept it. Let the browser scroll the page normally.

---

## Implementation

### Hook: `app/hooks/useTabSwipe.ts`

A single reusable hook attached to `document`-level touch events.

**`touchstart`**
- Reads `containerRef.current` live (handles conditional/loading renders)
- Checks if the touch target belongs to the tab container using `container.contains(e.target)`
- If outside container → marks gesture as ignored
- Records start position, time, and whether origin is in left 1/3

**`touchmove`**
- Locks direction (horizontal or vertical) after 5px of movement — committed for the rest of the gesture
- If vertical-first → cancelled, page scrolls normally
- If horizontal-first → checks whether the touch target is a scrollable element (e.g. table) that can still scroll in that direction; if yes → cancelled

**`touchend`**
- Navigates to next/prev tab if:
  - Fast flick: velocity > 0.3 px/ms with at least 15px travel, **or**
  - Long swipe: at least 30px horizontal travel
- Right-swipe from left 1/3 → skipped (reserved for sidebar)

### Per-page wiring

Each tab page:
1. Creates `const tabSwipeRef = useRef<HTMLDivElement>(null)`
2. Calls `useTabSwipe(tabSwipeRef, [...tabs], activeTab, setActiveTab)`
3. Wraps the tab nav bar + all tab content in `<div ref={tabSwipeRef}>`  
   (wrapper opens just before `{/* Tab navigation */}` and closes before the delete confirmation modal)

---

## Current Status

### What works
- Swipe navigation functions correctly **after the user taps a tab button** first
- Left/right cycle through tabs works
- Sidebar open gesture is not broken
- Table horizontal scroll is not broken

### Known Issue
Swipe does not work on first interaction (before tapping a tab). Root cause not yet confirmed. Two suspects:

**A. `container.contains()` returns false**  
The `<div ref={tabSwipeRef}>` may not be wrapping the element the user is actually touching. Need to verify that the wrapper div in each page's JSX correctly encloses all tab content that is visible to the user.

**B. `containerRef.current` is null at touch time**  
On pages where the tab section is inside a loading conditional (e.g. dashboard: `loading ? <Skeleton/> : <div ref={tabSwipeRef}>`), the ref div is not in the DOM on the first render. The `useEffect` runs once on mount — if the div does not exist yet, `containerRef.current` is null. Even though we read it live on each `touchstart`, if React has not committed the div to the DOM by the time the first touch fires, `contains()` will fail.

---

## Files Changed

| File | Change |
|------|--------|
| `app/hooks/useTabSwipe.ts` | New hook (created) |
| `app/dashboard/page.tsx` | Import hook, add ref, wrap tab section |
| `app/transactions/page.tsx` | Import hook, add ref, wrap tab section |
| `app/members/[id]/page.tsx` | Import hook, add ref, wrap tab section |
| `app/chit-funds/[id]/page.tsx` | Import hook, add ref, wrap tab section |
| `app/loans/[id]/page.tsx` | Import hook, add ref, wrap tab section |
