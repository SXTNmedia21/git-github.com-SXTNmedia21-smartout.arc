---
title: "IMMUTABLE-only index expressions — timestamptz + interval is not"
id: LEARNING_0214
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [learning, migration, postgresql, index, immutable, timestamptz, engine-world]
---

# Learning-0214: Index expressions must be IMMUTABLE — `timestamptz + interval` is not

## Reference (for grep)

- Migration: `supabase/migrations/20260525000000_engine_world.sql` (Phase 0 engine_world)
- Fix commit: `0b338cbc9 fix(migrations): unblock pgTAP — 3 schema bugs in recent migrations`
- pgTAP error: index `idx_engine_world_staleness` on `(observed_at + (ttl_seconds || ' seconds')::interval)` rejected by Postgres planner as non-IMMUTABLE.

## Pattern

PostgreSQL requires expression indexes to use IMMUTABLE functions only. The
expression `timestamptz_value + interval_value` is **not** IMMUTABLE because
the result depends on the session's `TimeZone` setting — adding an interval
to a `timestamptz` produces a different `timestamptz` depending on TZ when
the interval crosses a DST boundary or when the result is rendered.

Authoring an index on such an expression compiles in CREATE INDEX (the
syntactic check) but fails at apply-time:

```
ERROR: functions in index expression must be marked IMMUTABLE
```

## What I tried (engine_world Phase 0)

```sql
CREATE INDEX IF NOT EXISTS idx_engine_world_staleness
  ON public.engine_world ((observed_at + (ttl_seconds || ' seconds')::interval));
```

Intent: cheap "is row stale?" query — `WHERE now() > observed_at + ttl_seconds*interval`.
Failed at pgTAP apply-from-empty.

## Why it shipped

- Authored locally without reseting Supabase Local (existing schema cached).
- pgTAP runs `supabase start` from empty + applies all migrations fresh.
  That re-applies the buggy index and fails. Same surfacing pattern as L-0213.

## Fix

Drop the computed-staleness index. The plain DESC index on `observed_at`
already supports the same query predicate — staleness is computed at read
time, not at index time.

```sql
-- Removed: CREATE INDEX ... ON ((observed_at + (ttl_seconds || ' seconds')::interval));
-- Kept:    CREATE INDEX ... ON (observed_at DESC);
```

Reader code computes `is_stale` in TypeScript:

```ts
function computeIsStale(observed_at: string, ttl_seconds: number): boolean {
  return Date.now() > new Date(observed_at).getTime() + ttl_seconds * 1000;
}
```

## Rule

Before adding an expression index in a migration:

1. **Audit IMMUTABLE-ness of every function in the expression.** Postgres
   docs list IMMUTABLE/STABLE/VOLATILE per function. Operator overloads
   inherit volatility from underlying function.
2. **Reject `timestamptz` + interval, `now()`, `current_timestamp`, any
   TZ-aware operator** in expression-index bodies.
3. **Prefer compute-at-read** for "is N seconds old?" queries — a plain
   `(observed_at DESC)` index plus a runtime predicate is cheaper than an
   IMMUTABLE-wrapping function.
4. **If you absolutely need pre-computed staleness:** wrap in an IMMUTABLE
   SQL function with no TZ-dependent operators. E.g. compute the epoch-
   seconds expiry as `EXTRACT(EPOCH FROM observed_at)::bigint + ttl_seconds`
   — both halves are IMMUTABLE on `timestamp without time zone`. Then index
   that. Adds complexity; prefer option 3 unless query profile demands it.

## How to detect at author-time

Run `supabase db reset` before commit. If migration applies cleanly to
empty DB, the index expression is IMMUTABLE-clean. Local reset is the
author-side equivalent of pgTAP fresh-apply.

## Sibling

- L-0213 (sibling enum value-spaces) — same surfacing pattern: bug ships
  silently because local re-apply is rare; pgTAP fresh-DB catches.
- L-0042 (timestamp ordering causal DAG) — same family of "it apply-broke
  not author-broke".

## References

- Migration file: `supabase/migrations/20260525000000_engine_world.sql`
- Fix commit: `0b338cbc9`
- ADR-0281 (engine_world architecture)
- PostgreSQL docs: https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-NOTES
- Function volatility: https://www.postgresql.org/docs/current/xfunc-volatility.html

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-05-05.
