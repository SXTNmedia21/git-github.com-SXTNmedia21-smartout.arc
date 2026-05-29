---
title: "PLAN-1 — web location readback (Tidslinjen chip-bar filter)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [adr-0430, adr-0367, day-line, location-readback]
---

# PLAN-1 — web location readback

**File:** `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` (~line 300-345)

**Problem:** post-M4, `locationByShift` is hardcoded `Map(... null)`. The Tidslinjen-tab location chip-bar filter
is dead (every event gets `location_id: null`).

**Fix:** resolve location via the ADR-0367 tri-layer path `schedule_shift → shift_session (schedule_shift_id) →
shift_session_day_line (shift_session_id) → day_line.location_id`. Verified schema: `shift_session.schedule_shift_id`
(FK `shift_session_schedule_shift_id_fkey`), `shift_session_day_line(shift_session_id, day_line_id)`,
`day_line.location_id`.

Implementation:
1. After fetching `shiftIds`, query the session→day_line chain for those shifts:
   ```ts
   const { data: sessionRows } = await supabase
     .from("shift_session")
     .select("schedule_shift_id, shift_session_day_line(day_line:day_line_id(location_id))")
     .in("schedule_shift_id", shiftIds);
   ```
   (PostgREST embed: `shift_session_day_line` → `day_line` via `day_line_id`. If embed disambiguation is needed,
   pin the FK constraint name — verify the relationship resolves; fall back to two queries if PGRST201.)
2. Build `locationByShift` from the resolved rows: first day_line's `location_id` per shift (single-location V1,
   mirrors shift-mcp create). Shifts with no session/day_line → `null` (legitimately unscheduled).
3. Replace the hardcoded `null` map + drop the two "deferred" comments.

**Acceptance:** `locationByShift` returns real location_ids for shifts that have a materialized session+day_line;
chip-bar filter functions. `pnpm turbo typecheck --filter=./apps/web` green. grep: no "location filter deferred"
comment left.

**Commit:** `fix(day-line): restore location readback via session→day_line (ADR-0430/0367)`.
