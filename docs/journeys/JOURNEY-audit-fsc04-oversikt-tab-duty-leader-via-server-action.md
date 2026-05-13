---
title: "Journey — OversiktTab duty_leader change via Server Action"
feature: audit-fsc04-day-control-server-actions
journey: oversikt-tab-duty-leader-via-server-action
status: verified
verified_at: 2026-06-10
e2e_test: null
created: 2026-05-13
updated: 2026-06-10
module: schedule
tags: [journey, adr-0156, adr-0204, department-session, server-action]
---

# Journey: Manager picks duty_leader in OversiktTab — gated via Server Action

**Role:** manager in day-control overview tab

**Precondition:** Refactor shipped. `updateDepartmentSessionDutyLeaderAction` exists.

## Happy Path

1. Manager selects duty leader (or "Ingen") from `<select>` dropdown
2. onChange fires → TanStack mutation → optimistic `setDutyLeaderId(newLeader)` → calls `updateDepartmentSessionDutyLeaderAction({ department_session_id, duty_leader_profile_id })`
3. Server Action loads row, fails-fast on missing/wrong-workspace (L-0177)
4. Server Action: gate_action(capability="session.update_duty_leader", action="update", entityId=session_id) → allowed (manager role floor)
5. UPDATE `department_session.duty_leader_id` with new value
6. Action emits `session duty_leader_updated` carrying `previous_duty_leader_id` + `new_duty_leader_id` → posthog + logger + activity_trail + engine_event
7. TanStack invalidates `["active-session-duty", departmentId, dateId]` → re-fetch confirms

**Error path:** mutation `onError` rolls back optimistic state to previous leader; toast shows server error message.

**Idempotency:** if `previous_duty_leader_id == new_duty_leader_id`, action short-circuits before gate/UPDATE/emit. Prevents phantom-emit on no-op re-selection.

**Postcondition:** D6 mutation tracked. NO direct `.update()` from OversiktTab.

## Verification

- [x] `OversiktTab.tsx` zero direct `.from("department_session").update`
- [x] `updateDepartmentSessionDutyLeaderAction` ships with gate + emit
- [x] Vitest coverage — 8 tests (auth, validation, null leader, missing row, wrong workspace, idempotent, gate denial, happy path)
- [ ] Manual smoke: pick new leader → state updates (deferred — code-path proven by unit tests)

**Verified 2026-06-10 by sortie feat/audit-fsc04-day-control-server-actions.**
