---
title: "BLOCKED — BUG-SIM-27 temporal lock date boundary"
status: blocked
created: 2026-05-25
updated: 2026-05-25
module: schedule
tags: [blocked, migration, bugs, sim]
---

# BLOCKED — BUG-SIM-27: Schedule temporal lock 02:00-02:30 post-midnight trap

## Bug

`schedule_shift_is_temporally_locked()` uses `v_local_now::date` for the date
comparison. At 02:20 Oslo local time, `v_local_now::date` = `N+1` (today), but the
shift's `shift_date` = `N` (yesterday evening). The function returns `locked = true`
even though the shift (e.g. a wedding-dinner running to 03:00) is still active and
the banquet captain needs to approve hours.

**Location:**
`supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql:43`

**Buggy line:**
```sql
RETURN p_shift_date < v_local_now::date OR v_shift_start_local <= v_local_now;
```

## Why blocked

The fix is a `CREATE OR REPLACE FUNCTION public.schedule_shift_is_temporally_locked`
with a grace-window approach:

```sql
-- Option A — shift-end-anchored grace window (4 hours after date-roll):
RETURN p_shift_date < (v_local_now - INTERVAL '4 hours')::date
  OR v_shift_start_local <= v_local_now;
```

Or alternatively adding a `lock_after` column on `schedule_shift` to let the DB
trigger respect a business-hours window — which also requires a schema migration.

Both paths require schema migrations. Batch sortie `feat/sim-fast-wins-batch-2`
forbids schema migrations.

## Resolution path

Coordinate with system-steward. Use Option A (4-hour grace) unless the council
decides `lock_after` is preferable (adds flexibility but more schema surface).

Migration name suggestion:
`20260626010000_schedule_shift_temporal_lock_grace_window.sql`

## Severity

HIGH — operational dead-end for any late-night op (hotels, bistros, festivals).
Affects every shift with `shift_date = N` that runs past midnight.
Any banquet captain trying to approve at 02:20 is blocked.
