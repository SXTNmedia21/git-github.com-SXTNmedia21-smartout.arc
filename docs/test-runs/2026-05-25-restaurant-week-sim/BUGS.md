---
title: Restaurant-Week Sim — Bug Report
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [schedule, simulation, bug-report]
---

# Restaurant-Week Sim — Bug Report (2026-05-25)

Bugs surfaced during the restaurant-week capability simulation run on 2026-05-25.

## BUG-SIM-08 — schedule: shift lookup silently returns empty (get_colleagues_on_shift)

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Capability | `schedule` |
| Tool | `get_colleagues_on_shift` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` line 136 |
| Severity | High — silent empty result, no error surfaced to user |

**Root cause:** `.eq("id", params.shift_id)` filtered against the `schedule_shift` table whose PK column is `schedule_shift_id`, not `id`. Every lookup returned 0 rows. The select at line 146 also named the column `id` instead of `schedule_shift_id`.

**Fix:** `feat/schedule-pk-fix` — Sortie E. Replaced `.eq("id", ...)` with `.eq("schedule_shift_id", ...)` and updated the select string to name `schedule_shift_id` correctly.

---

## BUG-SIM-09 — schedule: shift detail lookup silently returns not_found (get_shift_detail)

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Capability | `schedule` |
| Tool | `get_shift_detail` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` lines 241 + 243 |
| Severity | High — every `get_shift_detail` call returns `{ error: "shift_not_found" }` |

**Root cause:** Same PK column mismatch. `.select("id, ...")` named a non-existent column; `.eq("id", params.shift_id)` matched nothing.

**Fix:** Same Sortie E commit. Select now uses `schedule_shift_id`; filter now uses `.eq("schedule_shift_id", ...)`.

---

## Additional fix (same commit) — get_today_schedule select column

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Tool | `get_today_schedule` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` line 208 |

Select string listed `id` instead of `schedule_shift_id`. Not in the original sim bug list but identified during the fix sweep — same class of error.
