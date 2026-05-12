---
title: "TanStack Query shared queryKey + different shapes = runtime crash"
id: LEARNING_0221
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [learning, tanstack-query, react, cache, bug]
---

# Learning-0221: TanStack queryKey shape collision

## Reference (for grep)

- Issues #313 + #314 (auto-reported "object is not iterable")
- Fix commit: c3a25356f (`apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx`)
- Memory: `learning_tanstack_query_shape_collision.md`

## Bug pattern

Two `useQuery` hooks share the same `queryKey` but their `queryFn`
returns DIFFERENT shapes. TanStack caches by key. Whichever query lands
first poisons the other consumer's expected shape.

```ts
// hook A — apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts
const query = useQuery({
  queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),
  queryFn: async () => {
    const { data } = await supabase.from("workspace_operating_hours").select(...);
    return { entries: transform(data), persistedCount: data.length };  // OBJECT
  },
});

// hook B — apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx
const baseQuery = useQuery({
  queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),  // SAME KEY
  queryFn: async () => {
    const { data } = await supabase.from("workspace_operating_hours").select(...);
    return data ?? [];  // ARRAY
  },
});

// Crash site:
for (const row of baseQuery.data ?? []) {  // ← if cached value is the OBJECT, "object is not iterable"
  baseMap.set(row.day_of_week, row);
}
```

## Why it crashes

TS type-checks `useQuery<T>` per call site, but the cache is runtime.
At cache hit, the object stored is whatever the FIRST query returned.
Second consumer reads that with the WRONG type assumption — TS never
sees the discrepancy because the cached value's type isn't typed at
runtime.

## 2026-05-04 occurrence

User navigated `/dashboard/settings/operating-hours` (cached `{entries,
persistedCount}`) → `/dashboard/organization/departments/[id]` (read
the same cache, expected array). `useMemo` over `data ?? []` failed
the iterable check. PostHog auto-reported via the dashboard error
boundary. Issues #313 + #314 created.

## Fix

Discriminate the queryKey by shape:

```ts
// hook A keeps composed key (canonical for settings)
queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none")

// hook B adds a "raw" discriminator
queryKey: [...dashboardKeys.workspaceOperatingHours(wsId ?? "none"), "raw"]
```

Now the two consumers have distinct cache entries. No collision.

## Detection

```bash
# Find queryKey usages that collide
grep -rEn 'queryKey:\s*[a-zA-Z]' apps/web/src/ \
  | sed 's/.*queryKey:\s*//' | sort | uniq -c | sort -rn | head -20
```

Then for each duplicated key, audit `queryFn` return shapes.

Stronger guard: lint rule that flags any `queryKey` reuse across files
if the local `queryFn` returns ≠ types. Requires AST analysis (deferred).

## Anti-pattern

Reusing a queryKey factory like `dashboardKeys.X(id)` across multiple
queries with different `queryFn` shapes. Either:

1. Each shape gets its own discriminated key (`...key, "raw"`, `...key, "composed"`), OR
2. Consolidate to ONE canonical shape; raw consumers derive from it

## Related

- L-0149 (phantom-registration in tool-selector — different surface, same "TS type ≠ runtime cache" theme)
- ADR-0114 (TanStack Query as canonical client-side cache)
- Memory: `learning_tanstack_query_shape_collision.md`
