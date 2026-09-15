# Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render players 25 at a time in the Players table, auto-loading the next 25 when the user scrolls to the bottom, eliminating the lag caused by rendering 2,000+ DOM rows at once.

**Architecture:** Add `visibleCount` state and a sentinel `<div>` watched by `IntersectionObserver` in `PlayersPage.tsx`. Slice `table.getRowModel().rows` to `visibleCount` before rendering. Reset `visibleCount` to 25 whenever filters or sorting change.

**Tech Stack:** React 19 (hooks), TanStack React Table 8, Tailwind CSS, native `IntersectionObserver` API.

---

## File Map

| File | Change |
|------|--------|
| `src/pages/PlayersPage.tsx` | Add `useRef`/`useEffect` imports, `visibleCount` state, `sentinelRef`, two effects, row slice, sentinel div, footer indicator |

---

### Task 1: Add state and refs

**Files:**
- Modify: `src/pages/PlayersPage.tsx:1` (imports), `src/pages/PlayersPage.tsx:24` (component body)

- [ ] **Step 1: Update imports to include `useRef` and `useEffect`**

Replace line 1:
```tsx
import { useState, useMemo, useCallback } from 'react'
```
With:
```tsx
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
```

- [ ] **Step 2: Add `visibleCount` state and `sentinelRef` after the existing state declarations**

After line 33 (`const [globalFilter, setGlobalFilter] = useState('')`), add:
```tsx
const [visibleCount, setVisibleCount] = useState(25)
const sentinelRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "feat: add visibleCount state and sentinel ref for infinite scroll"
```

---

### Task 2: Add IntersectionObserver effect

**Files:**
- Modify: `src/pages/PlayersPage.tsx` (after sentinelRef declaration)

- [ ] **Step 1: Add the IntersectionObserver effect**

After the `sentinelRef` declaration (Task 1 Step 2), add:
```tsx
const allRows = table.getRowModel().rows
const visibleRows = allRows.slice(0, visibleCount)

useEffect(() => {
  const sentinel = sentinelRef.current
  if (!sentinel) return
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setVisibleCount((n) => Math.min(n + 25, allRows.length))
    }
  })
  observer.observe(sentinel)
  return () => observer.disconnect()
}, [allRows.length])
// NOTE: visibleCount is intentionally excluded from deps. Including it would
// recreate the observer after every load-more, firing immediately if the
// sentinel is still visible and causing a rapid cascade.
```

Note: `allRows` and `visibleRows` must be declared **after** the `table` declaration (line 198 in the original). Place this block immediately after `const table = useReactTable(...)`.

- [ ] **Step 2: Add the reset effect**

Immediately after the IntersectionObserver effect, add:
```tsx
useEffect(() => {
  setVisibleCount(25)
}, [columnFilters, globalFilter, sorting])
```

Where `columnFilters` is the positions/rookie filter state. Since those are derived via `useMemo` into `filtered` (not a TanStack column filter), use the source states instead:
```tsx
useEffect(() => {
  setVisibleCount(25)
}, [positions, includeRookies, globalFilter, sorting])
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "feat: add IntersectionObserver and filter-reset effects for infinite scroll"
```

---

### Task 3: Wire up the rendered rows and sentinel

**Files:**
- Modify: `src/pages/PlayersPage.tsx:280` (tbody rows), `src/pages/PlayersPage.tsx:298` (after tbody)

- [ ] **Step 1: Replace `table.getRowModel().rows` with `visibleRows` in the render loop**

Find (line 280):
```tsx
{table.getRowModel().rows.map((row) => (
```
Replace with:
```tsx
{visibleRows.map((row) => (
```

- [ ] **Step 2: Add the sentinel div after the closing `</table>` tag**

Find (line 299):
```tsx
        </div>
      )}
    </div>
  )
}
```
Replace with:
```tsx
        </div>
        <div ref={sentinelRef} className="h-1" />
        <p className="text-xs text-slate-500 text-center py-3 tabular-nums">
          {visibleCount < allRows.length
            ? `Showing ${Math.min(visibleCount, allRows.length)} of ${allRows.length} players`
            : `All ${allRows.length} players loaded`}
        </p>
      )}
    </div>
  )
}
```

The sentinel must be **outside** the scrollable `overflow-x-auto` div so the observer fires on the page scroll, not the table's horizontal scroll container. Place it after the closing `</div>` of the `overflow-x-auto` wrapper.

- [ ] **Step 3: Verify the rank column still shows correct numbers**

The `rank` column uses `row.index + 1` (line 49 original). `row.index` is TanStack's position in the full sorted model — not the render index — so slicing does not break rank numbers. No change needed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "feat: render sliced rows and add scroll sentinel with player count footer"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the Players page and verify initial load**

Expected: Only ~25 rows visible in DOM (inspect with DevTools → Elements). Footer shows "Showing 25 of N players".

- [ ] **Step 3: Scroll to the bottom**

Expected: 25 more rows appear. Footer updates to "Showing 50 of N players". Repeat — each scroll-to-bottom adds 25.

- [ ] **Step 4: Apply a position filter (e.g. WR only)**

Expected: `visibleCount` resets, footer shows "Showing 25 of M players" for the filtered set.

- [ ] **Step 5: Type in the search box**

Expected: `visibleCount` resets, first 25 matching results shown.

- [ ] **Step 6: Sort by a column**

Expected: `visibleCount` resets, first 25 rows of newly sorted order shown.

- [ ] **Step 7: Scroll to the end of a small filtered set**

Expected: Footer shows "All N players loaded" once `visibleCount >= allRows.length`.

- [ ] **Step 8: Click a player row**

Expected: Navigates to player detail page normally.
