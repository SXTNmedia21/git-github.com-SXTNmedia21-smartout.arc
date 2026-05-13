---
title: "Journey — personal_task RPC + capability still works after A.2"
feature: sortie-a2-d6-rls-with-check
journey: personal-task-rpc-still-works
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, rls, personal-task, regression, adr-0300, adr-0301]
---

# Journey: personal_task RPC readpath + task capability mutations unaffected

**Role:** employee (regular user calling `fn_list_my_tasks` + task capability)

**Precondition:** User has `personal_task` rows assigned to them in workspace A. ADR-0300 RPC `fn_list_my_tasks` deployed. ADR-0301 task capability with `gatedMutation` writes deployed. Pre-A.2 state had `FOR ALL USING(...)` on `personal_task` (F-DB-10).

## Happy Path

1. Mobile client calls `fn_list_my_tasks(workspace_id)` RPC (SECURITY DEFINER per ADR-0300 — bypasses RLS read by design)
2. RPC returns user's tasks. **No change after A.2** — SECURITY DEFINER unaffected by per-verb split.
3. User completes task via task capability tool → BFF → `gatedMutation` → UPDATE personal_task
4. Postgres evaluates UPDATE policy → USING passes (assignee or workspace member) → WITH CHECK matches USING for workspace_id → succeeds
5. Telemetry `task.completed` emits. Activity trail updated.

**Postcondition:** Mobile task list still loads. Task completion still works. No 42501 in BFF logs.

## Error Paths

- **Service-role bypass path (cron, system actor)** — verify SECURITY DEFINER functions and service-role inserts still work; per-verb policies must include service_role bypass if the table had it pre-A.2.
- **Cross-workspace assignee** (multi-workspace user assigned to task in B from A) — verify USING passes if assignee matches even when current workspace context is A. Council if behaviour shifts.

## Verification

- [ ] Implementation matches the steps above (per-verb policies on personal_task preserve RPC + capability paths)
- [ ] E2E test exists and passes — pgTAP `supabase/tests/rls/sortie_a2_personal_task.sql` (RPC returns rows; capability UPDATE lives; forge throws)
- [ ] Manual mobile smoke test: load tasks → complete one task after migration applied

**Mark `status: verified` in frontmatter when all three boxes are checked.**
