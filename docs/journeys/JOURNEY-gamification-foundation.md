---
title: "Journey — gamification-foundation"
status: done
updated: 2026-03-28
created: 2026-03-28
module: operations
tags: [journey, season, session, operations]
---

# Journey — gamification-foundation (WS-1: Season & Operations Loop)

## Journey: Admin Activates a Season

**Precondition:** Admin has created a season with budget, day factors, and hour factors configured.

1. Admin navigates to `/dashboard/season` → System shows season selector, tabs, and status bar
2. Admin selects a draft season → System shows "Klar for drift" in status bar with green "Aktiver sesong" button
3. Admin clicks "Aktiver sesong" → System validates:
   - Budget exists with total_target_revenue > 0
   - Day factors exist (at least 1 row)
   - Hour factors exist (at least 1 row)
4. Validation passes → System archives any currently active season in the workspace
5. System sets selected season status to `active` → Toast: "{name} er nå aktiv!"
6. Telemetry: `season activated` emitted to posthog, logger, activity_trail, engine_event
7. Postgres trigger fires → `engine_event` row created with `season.activated`
8. Engine dispatch processes event → Creates `department_session` rows for operational/hybrid departments for the next 7 days
9. Status bar updates: shows "Aktiv" badge, "Arkiver sesong" button replaces PLAY

**Postcondition:** Season is active. Department sessions exist for the planning window. Operations dashboard shows sessions.

**Error paths:**

- Missing budget → Toast: "Sesong mangler budsjett"
- Budget has no revenue target → Toast: "Budsjett mangler omsetningsmål"
- Missing day factors → Toast: "Sesong mangler dagfaktorer"
- Missing hour factors → Toast: "Sesong mangler timefaktorer"

---

## Journey: Admin Archives a Season

**Precondition:** Season is currently active.

1. Admin clicks "Arkiver sesong" in the status bar → System sets status to `archived`
2. Toast: "{name} er arkivert"
3. Telemetry: `season archived` emitted
4. Status bar updates: shows "ARCHIVED" badge

**Postcondition:** Season is archived. No active season in workspace (until another is activated).

---

## Journey: System Creates Sessions Daily (Automated)

**Precondition:** Active season exists with operational departments configured.

1. pg_cron fires `daily-session-replenish` at 02:00 UTC daily
2. Edge Function queries all workspaces with active seasons
3. For each workspace: gets operational/hybrid departments
4. Calculates planning window: today → min(season end, today + 7 days)
5. Resolves operating hours from `department_operating_hours` per department per weekday
6. Upserts `department_session` rows (idempotent on workspace_id + department_id + session_date)

**Postcondition:** Department sessions exist for the full 7-day planning window.

**Error paths:**

- No active seasons → Function returns early, no action
- No operational departments → Workspace skipped
- Upsert conflict → Existing sessions preserved (no overwrite of in-progress sessions)

---

## Journey: System Transitions Sessions (Automated)

**Precondition:** Department sessions exist for today with planned_open/planned_close times.

1. pg_cron fires `session-lifecycle` every 15 minutes
2. **upcoming → active:** When current time >= session_date + planned_open → Sets `opened_at`, transitions to `active`
3. **active → pending_signoff:** When current time >= session_date + planned_close → Transitions to `pending_signoff`
4. **upcoming → missed:** When current time > session_date + planned_close + 2 hours (never opened) → Transitions to `missed`
5. On `pending_signoff` transition: Postgres trigger emits `department_session.pending_signoff` engine_event
6. Engine dispatch processes event → Starts `daily_close` process

**Postcondition:** Sessions progress through their lifecycle automatically. Daily close starts when sessions end.

---

## Journey: System Fires Session Hooks (Automated)

**Precondition:** Session hooks configured for department. Sessions exist for today.

1. pg_cron fires `session-hook-executor` every 5 minutes
2. Gets today's upcoming/active sessions
3. For each session: finds matching `session_hook` rows by department
4. Calculates fire time: anchor (planned_open or planned_close) + trigger_offset_min
5. If current time past fire time AND no existing tasks for this hook+session (idempotency):
   - Gets `procedure_step` rows for the hook's linked procedure
   - Creates `session_task` row per step with status `pending`

**Postcondition:** Session tasks materialized from procedure definitions. Visible in operations dashboard.

**Error paths:**

- No hooks configured → Function returns early
- Hook already fired (tasks exist) → Skipped (idempotent)
- No linked procedure/routine → Hook skipped
- No planned_open/close time → Hook skipped (can't calculate fire time)

---

## Journey: Admin Views Operations Dashboard

**Precondition:** Season is active, sessions created, hooks fired.

1. Admin navigates to `/dashboard/operations` → System queries today's data
2. Dashboard shows 4 metric cards: task completion, stress level, overdue count, upcoming tasks
3. Staff present section shows employees currently on shift
4. Hourly revenue chart shows targets vs actuals (from workspace_budget + daily_reconciliation)
5. Department breakdown shows capacity per department
6. All data auto-refreshes every 60 seconds

**Postcondition:** Admin has real-time operational visibility driven by the session lifecycle.
