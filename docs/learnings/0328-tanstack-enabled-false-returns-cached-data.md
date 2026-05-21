---
title: "TanStack Query v5 enabled:false returns CACHED data — gate visibility on the result, not enabled"
id: LEARNING_0328
status: canonical
layer: learning
created: 2026-05-21
updated: 2026-05-21
tags: [tanstack-query, react-query, mobile, cache, visibility-gate, council, day-line, task-manager]
---

# Learning-0328: `enabled:false` does not hide already-cached data

## Context

Post-implementation council (2026-05-21) on the `dayline-shift-tasks` sortie. The
mobile status-gate hid an employee's day_line tasks by passing
`shiftSessionId = null` to `useDayLineItems` when the shift was not active
(`scheduled`/`clocked_in`), relying on the hook's `enabled` guard
(`enabled: dayLineIds.length > 0 && shiftSessionId !== null`). The caller used
`const { data: items = [] } = useDayLineItems(...)`, assuming `enabled:false`
→ `data === undefined` → `[]` default → no tasks shown.

`feature-dev:code-reviewer` REJECTED (95% confidence). The assumption is wrong in
TanStack Query v5.

## The trap

**TanStack Query v5: a query with cached data and `enabled:false` stays in
`success` state and keeps returning the last fetched `data` for `staleTime`.**
The caller's `= []` default only applies on the very first render before any
fetch — i.e. when `data` is genuinely `undefined`.

Failure trace (verified against `use-day-line-items.ts`):
- `queryKey: ["day-line-items", dayLineIds.slice().sort().join(",")]` — **omits
  `shiftSessionId`**. `staleTime: 30_000`.
1. Employee `clocked_in` → real `shiftSessionId` → query runs → `data` = N tasks,
   cached under key K.
2. Employee `clocked_out` → gate flips `shiftSessionId` to `null` → `enabled:false`.
3. `dayLineIds` is unchanged (the `shift_session` row still has its day_lines), so
   **the cache key K is unchanged**.
4. v5 returns the cached N tasks (`data !== undefined`) → the `= []` default never
   fires → tasks remain visible for up to `staleTime` (~30s) after clock-out.

The null-*session* path (a day off, `session === null`) is fine — `dayLineIds`
collapses to `[]`, the key changes to a cold key, `data` is `undefined`. The bug
only manifests on **status transitions while the session row persists**.

## The rule

**Gate visibility on the RESULT, not on `enabled`.** `enabled` is a fetch
optimization (don't hit the network when off), NOT a hide mechanism. To hide
data, filter the returned array at the call site:

```ts
const { data: rawItems = [] } = useDayLineItems(dayLineIds, dayLineIds, gatedShiftSessionId);
const items = isShiftActiveForTasks(session?.status) ? rawItems : [];
```

`gatedShiftSessionId` (null when inactive) still prevents fetching; the
`isShiftActiveForTasks ? rawItems : []` filter guarantees hiding regardless of
cache state. Belt + suspenders. (Fix commit `b2759b013`.)

Alternative: put the gating param in the `queryKey` so a flip to null produces a
cold key (`data` → `undefined`). Either works; the result-filter is preferred
because it keeps the hook's responsibility narrow and the visibility policy in the
component.

## Why verification missed it (meta)

The `verify` skill drove the SQL resolver live (psql, 5 probes) but explicitly did
NOT drive the mobile GUI (no Expo runtime) and said so. The cache-return behavior
only manifests at the React/TanStack runtime — so it was invisible to SQL probes,
typecheck, and the jest unit test (which tests the pure helper, not the hook
wiring). It surfaced ONLY because the council dispatched a reviewer who knew the v5
cache semantics. Sibling of L-0325 (council coverage-gap voids no-blocker): a PASS
on the surfaces you *can* drive is not a PASS on the surfaces you can't — name the
undriven seam, and let a domain reviewer cover it.

## Detection

When a visibility/permission gate is implemented via `enabled`, grep the consumer:
does it rely on `data === undefined` to hide? If the `queryKey` doesn't include the
gating variable and `staleTime > 0`, it leaks stale data on the gate flip. Gate on
the result.
