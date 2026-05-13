---
title: "Journey — OversiktTab duty_leader change via Server Action"
feature: audit-fsc04-day-control-server-actions
journey: oversikt-tab-duty-leader-via-server-action
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, adr-0156, adr-0204, department-session, server-action]
---

# Journey: Manager picks duty_leader in OversiktTab — gated via Server Action

**Role:** manager in day-control overview tab

**Precondition:** Refactor shipped. `updateDepartmentSessionDutyLeaderAction` exists.

## Happy Path

1. Manager selects duty leader from `<select>` dropdown
2. onChange fires → TanStack mutation → calls `updateDepartmentSessionDutyLeaderAction({ session_id, duty_leader_profile_id })`
3. Server Action: gate_action → allowed
4. UPDATE `department_session` with new duty_leader_id
5. Action emits `session.duty_leader.updated` event
6. TanStack query invalidates → UI shows new leader

**Postcondition:** D6 mutation tracked. NO direct `.update()` from OversiktTab.

## Verification

- [ ] `OversiktTab.tsx` zero direct `.from("department_session").update`
- [ ] `updateDepartmentSessionDutyLeaderAction` ships with gate + emit
- [ ] Vitest coverage
- [ ] Manual smoke: pick new leader → state updates

**Mark verified when all checked.**
