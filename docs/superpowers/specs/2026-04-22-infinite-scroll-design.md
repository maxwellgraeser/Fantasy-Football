# Infinite Scroll — Players Table

**Date:** 2026-04-22  
**Status:** Approved

## Problem

All ~2,000 skill-position players are rendered into the DOM at once via TanStack React Table, causing noticeable lag on the Players page.

## Solution

Slice the rendered rows to 25 at a time, auto-loading the next 25 when the user scrolls to the bottom. All data remains client-side — this is a rendering optimization only.

## Scope

Single file: `src/pages/PlayersPage.tsx`. No new dependencies.

## Implementation

### State

```ts
const [visibleCount, setVisibleCount] = useState(25);
const sentinelRef = useRef<HTMLDivElement>(null);
```

### Row slicing

```ts
const allRows = table.getRowModel().rows;
const visibleRows = allRows.slice(0, visibleCount);
```

Render `visibleRows` instead of `allRows`.

### Sentinel + IntersectionObserver

```ts
useEffect(() => {
  const sentinel = sentinelRef.current;
  if (!sentinel) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setVisibleCount(n => Math.min(n + 25, allRows.length));
    }
  });
  observer.observe(sentinel);
  return () => observer.disconnect();
}, [allRows.length]);
```

Place `<div ref={sentinelRef} />` immediately after the last `<tr>` (inside or just after `<tbody>`).

### Reset on filter/sort change

```ts
useEffect(() => {
  setVisibleCount(25);
}, [columnFilters, globalFilter, sorting]);
```

Ensures filtering to a position like WR doesn't keep a stale large count.

### Footer indicator

Below the table:

```tsx
<p className="text-xs text-slate-500 text-center py-2">
  {visibleCount < allRows.length
    ? `Showing ${visibleCount} of ${allRows.length} players`
    : `All ${allRows.length} players loaded`}
</p>
```

## Out of Scope

- Server-side pagination (all data is already cached client-side)
- Virtualization (not needed given 25-row increments)
- Changes to data fetching, caching, or scoring logic
