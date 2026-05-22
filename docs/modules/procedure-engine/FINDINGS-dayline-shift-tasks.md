---
title: "Findings — Day_line → Shift Tasks → Min dag: dual-perspective + reuse audit"
status: done
created: 2026-05-21
updated: 2026-05-22
module: procedure-engine
tags: [findings, dual-perspective, reuse-audit, day-line, shift-tasks, min-dag, anti-duplication]
---

# Findings — Day_line → Shift Tasks → Min dag

> Dual-perspective verification + reuse audit for the goal: *admin ties task to a location's day_line → employee whose shift operates at that location sees + executes it in Min dag (mobile)*. **Conclusion: the pipe is ~70% already shipped. Both remaining gaps are EXTEND-EXISTING, not build-new.** Verified by grep/read, file:line below.

## 1. Dual-perspective gap matrix

| Function | Web (admin/creator) | Web (employee/receiver) | Mobile (employee/receiver) |
|----------|---------------------|-------------------------|----------------------------|
| Create task on location day_line | ✅ `AddTaskDialog`/`DayLineStrip`/`add-day-line-item-action` → `task.create_session(day_line_id, assignee, scheduled_at)` | n/a | n/a (ADR-0133 no mobile authoring) |
| Resolve shift→day_lines (by location) | n/a | ❌ none | ✅ `use-shift-session.ts:65` (joins `shift_session_day_line→day_line→location`) |
| List shift's location tasks | n/a | ❌ (TasksTab is manager/session-scoped) | ✅ `useDayLineItems` (`use-day-line-items.ts`) + ADR-0367 §M2 leak-filter + ADR-0134 telemetry |
| Active-shift status gate | n/a | n/a | 🟡 status returned, **not gated** (Gap 2) |
| Full "Min dag" surface (sections/day-meter/filters) | ❌ | ❌ | 🟡 partial — `HomeShiftCard`/`DuringShiftView.v2`, NOT the prototype forside |
| Execute / complete | manager via TasksTab | ✅ action | ✅ `use-complete-calendar-task` + `TaskModal` + BFF `/api/mobile/tasks/[id]/complete` → `task.complete` |
| Hook/cron task anchored to day_line | n/a | — | ❌ `session-hook-executor` + `engine-dispatch` set NO `day_line_id` (Gap 1) |

## 2. Reuse audit — what already exists (DO NOT re-implement)

### Gap 1 — A-ANCHOR (hook/cron task gets `day_line_id`) → **EXTEND-EXISTING**
- **Missing:** the inserts at `session-hook-executor/index.ts:161-169`, `engine-dispatch/index.ts:787-804` (`assign_task`) and `:2146-2170` (`create_session_task`) write `session_task` **without** `day_line_id`. Column exists (`20260620120600_day_line_child_fks.sql:7`).
- **REUSE (do not reinvent the resolver):** the `(department_session_id, location_id) → day_line` join already lives in `ensure_shift_session()` (`20260620130000:65-70`) and the single-location `LIMIT 1` pattern in `20260620120700_day_line_backfill.sql:8-35`. The attach is two lines: `SELECT day_line_id FROM day_line WHERE department_session_id = $X` with a `COUNT(*) > 1 → NULL` guard (multi-location). **No new resolver function.**
- ADD: that 2-line attach in the 3 insert sites (single-location → attach, multi → NULL, per council Q-C).

### Gap 2 — status-gate (show tasks only when `shift_session.status ∈ scheduled/clocked_in`) → **EXTEND-EXISTING**
- **Missing:** `useDayLineItems` (`use-day-line-items.ts:69,149`) fires on `dayLineIds.length>0 && shiftSessionId!==null` — **no status gate**. `HomeShiftCard.tsx:63-87` calls it without checking `session.status`.
- **REUSE (do not make a new type or use the wrong signal):** `use-shift-session.ts:29` already returns `status: "scheduled"|"clocked_in"|"clocked_out"|"cancelled"`. Gate = one conditional in `HomeShiftCard`: pass `shiftSessionId = null` when status ∉ {scheduled, clocked_in} → the hook's existing `enabled` guard disables the query for free. Mirrors the server-side filter already in `day_line_back_populate` (`20260620130100:13-19`).
- **TRAP:** do NOT use `shift-phase.ts` / `useShiftPhase` for this gate — it derives phase from `time_entry`, not `shift_session.status`. Wrong signal. Complementary, not the same.

## 3. Duplication risks (existing impl to reuse instead)

| Tempting new logic | Reuse this instead |
|--------------------|--------------------|
| New "resolve day_line for session" SQL fn | `ensure_shift_session():65-70` join + `20260620120700` `LIMIT 1` — inline, 2 lines |
| New `fn_list_shift_tasks` resolver RPC | **redundant** — mobile resolves client-side (`use-shift-session` + `useDayLineItems`). A-DATA dropped. |
| New ShiftPhase/status type for the gate | `ShiftSessionRow.status` (`use-shift-session.ts:29`) — already the exact union |
| New `enabled` flag / param on `useDayLineItems` | existing `enabled: dayLineIds.length>0 && shiftSessionId!==null` — pass null to gate |
| `useShiftPhase()` as the visibility gate | wrong signal (time-entry); use `shift_session.status` |

## 4. Verdict per gap
| Gap | Verdict | Effort |
|-----|---------|--------|
| Gap 1 — A-ANCHOR day_line_id | **EXTEND-EXISTING** (3 insert sites, mirror existing join) | small, db/edge |
| Gap 2 — status-gate | **EXTEND-EXISTING** (1 conditional, reuse existing status field) | tiny, mobile |
| `fn_list_shift_tasks` resolver | **DROPPED** (already resolved client-side) | — |
| Full Min dag surface | **separate UI sortie**, ported from mockups (§5) | medium, mobile |
| Web receiver parity | **OUT** (mobile-primary, ADR-0133) | — |

## 5. Mockup source (confirmed — port, do not redesign)
Min dag / mobile-day UI ports from the **design-folder mockups**:
- `docs/modules/procedure-engine/taskmanager-DESIGNE/components/min-dag.jsx` + `Task Manager.html` — canonical Min dag (TaskKort, sections, day-meter, filter chips, Botsson-nudge).
- `docs/design/day-handoff/source/day/mobile-day.jsx` + `source/components/primitives.jsx` — mobile-day surface.
- `docs/design/design_handoff_calendar/source/shiftlist.jsx` — shift-list reference.
Adapt hex → `@smartout/design-tokens` `native.ts` (ADR-0366); RN adaptation (SectionList, Reanimated, a11y). Existing `HomeShiftCard`/`DuringShiftView` align to these, not diverge.

## 6. Reconciliation with GAPS-AND-DEBT
This finding **overturns GAPS G2** ("No query/UI renders the shift→tasks chain"): mobile DOES render it (`use-shift-session` + `useDayLineItems` → `HomeShiftCard`). G2 is now: *web has no per-employee shift-tasks view; mobile renders it but (a) cron tasks lack day_line_id [Gap 1], (b) no status gate [Gap 2]*. GAPS-AND-DEBT updated accordingly.
