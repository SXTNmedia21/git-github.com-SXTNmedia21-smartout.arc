---
title: "PLAN-4 — bands un-stub (real roster + duration column)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [adr-0367, day-line, employees, session-task-duration, migration, l-0042]
---

# PLAN-4 — bands un-stub

**Files:** `ManagerTimelineShell.tsx:338-354` (employees stub), `:315` (60min hardcode) + new migration + new hook.

## 4a. Real roster — useEmployeesForDate

**Problem:** `employees` are derived from task-assignees only (`role: "—"`, `shift: null`). Bands' EmpStrip + on-shift
counts don't reflect the real roster.

**Fix:** add `useEmployeesForDate(workspaceId, dateISO)` reading `schedule_shift` (the day's shifts) joined to `profile`
(display_name, role) — and resolve each shift's band via the session→day_line path (ADR-0367), so an employee lands in
the right area band. Shape: `{ id, name, role, area (day_line_id or department_id), shift: [start,end] }`.
- New hook in `apps/web/src/app/dashboard/oppgaver/_hooks/use-employees-for-date.ts` (data layer; mobile-shareable
  logic in packages/data if reused — web-only consumer for now, so app hook is fine per scope).
- Replace the Shell `employees` useMemo: union task-assignees (keep for unassigned coverage) + real roster from the hook.
- `shift: [start,end]` enables the rail "På vakt" derive (employee on shift if start ≤ now ≤ end) — feeds PLAN-3 KPI.

## 4b. session_task.duration column

**Problem:** `:315` hardcodes `endMin = startMin + 60`. session_task has no duration field.

**Fix:**
1. **Migration** `supabase/migrations/<ts>_session_task_duration.sql` — timestamp STRICTLY `> 20260801000006`
   (L-0042; verify repo tip first). `ALTER TABLE public.session_task ADD COLUMN duration_minutes integer;`
   (nullable — existing rows keep null → caller falls back to 60). Add a comment. No RLS change (column on existing table).
   Apply locally (`supabase migration up` or `db reset`) + regen types (`supabase gen types --local`) in SAME commit.
2. Update the Shell task mapping `:315`: `endMin = startMin + (t.duration_minutes ?? 60)`. Thread `duration_minutes`
   through the session-task hook row type (`ManagerTimelineTaskRow`) + the read query select.
3. ADR-0112 N/A (no capability/tool/enum). If a task capability writes duration later, that's a separate sortie — this
   plan only ADDS the column + reads it.

**Acceptance:** bands show real employees with roles + on-shift windows; task blocks honor `duration_minutes` when set
(60 fallback); migration timestamp > 20260801000006; types regen clean; typecheck green.

**Commit(s):** `feat(day-line): useEmployeesForDate — real roster in bands (ADR-0367)` +
`feat(schema): session_task.duration_minutes column + timeline readback (L-0042)`.
