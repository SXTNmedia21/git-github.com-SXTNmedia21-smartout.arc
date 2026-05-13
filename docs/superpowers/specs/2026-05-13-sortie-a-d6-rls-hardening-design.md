---
title: Sortie A — D6 RLS WITH CHECK Hardening (Design Spec)
status: draft
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-a, defense, rls, schedule_shift, shift_approval, ADR-0298, ADR-0151, ADR-0299]
---

# Sortie A — D6 RLS WITH CHECK Hardening — Design Spec

## 1. Goal

Close the forgeable-actor gap (L-0177 + ADR-0151) on the two D6 sibling tables Sortie 1 deferred (§R6): `shift_approval` and `schedule_shift`. Mirror the `session_task` WITH CHECK pattern shipped in `20260604120000_session_task_rls_with_check.sql`. Defense-in-depth: today nearly every production write to these tables uses the service_role admin client (which bypasses RLS), so this sortie does NOT fix a live exploit — it removes the JWT/anon escape hatch that future code paths (or an exfiltrated token) could ride through PostgREST direct.

## 2. Out of scope

- No new app code; no edits to capability tools, server actions, or BFF routes
- No new capability registrations
- No new tables, columns, or enums
- No ontology expansion (ADR-0298 Sortie B handles that)
- No `personal_task` / `emma_task` policy work (separate Sortie A.2 if Pontus elects)
- No new helper functions UNLESS pre-flight Phase 1 confirms `is_manager_in_team` is required by writer enumeration

## 3. Canonical reality (pre-flight, verified 2026-05-13)

### 3.1 `schedule_shift` UPDATE policies (already compliant)

Two PERMISSIVE policies stack via OR:

**`jwt_update_schedule_shift`** — `supabase/migrations/20260301300000_schedule_shift_table.sql:98-102`
```
USING      ( is_admin_in_workspace(auth.uid(), workspace_id) )
WITH CHECK ( is_admin_in_workspace(auth.uid(), workspace_id) )
```

**`jwt_employee_confirm_own_shift`** — `supabase/migrations/20260418100300_mobile_schema_additions.sql:15-28`
```
USING      ( employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid()) )
WITH CHECK ( employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid()) )
```

Both already carry WITH CHECK. The PERMISSIVE-OR composition mirrors session_task's (admin OR own-row OR pickup) shape, minus the pickup branch (schedule_shift has no NULL-tolerant transition — `employee_id` is set at INSERT by the admin who creates the shift). **No migration needed** — only an explicit pgTAP regression test that locks today's invariant.

### 3.2 `shift_approval` UPDATE policy (THE gap)

**`jwt_manage_shift_approval`** — `supabase/migrations/20260304200200_deviation_shift_approval.sql:155-164`
```
FOR ALL
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid()
      AND workspace_id = shift_approval.workspace_id
      AND role IN ('admin', 'owner', 'manager')
  )
)
```

`FOR ALL` covers UPDATE but ships **no `WITH CHECK`** — UPDATEs that pass USING can then flip `workspace_id` to a foreign workspace or `approved_by` to any profile. Identical class of bug to the pre-Sortie-1 `session_task` policy. No subsequent migration adds a `WITH CHECK` (verified: only `20260407100001_api_key_shift_approval.sql` touches the table policy-wise, and it only adds an api_key read policy).

### 3.3 Helper functions available

`supabase/migrations/00004_rls_policies.sql:28-42`:
- `get_workspace_ids_for_user(uid uuid) RETURNS SETOF uuid` — workspace membership lookup, `is_active = true` filter
- `is_admin_in_workspace(uid uuid, wid uuid) RETURNS boolean` — role IN ('admin','owner'), `is_active = true`

**`is_manager_in_team` does NOT exist.** Manager role check requires inline profile JOIN.

### 3.4 `shift_approval` writers (must not break after migration)

| Surface | Path | Client | Affected by RLS? |
|---|---|---|---|
| Engine queue_shift_approval | `supabase/functions/engine-dispatch/index.ts:2697-2710` | service_role | No (bypass) |
| `confirmHoursAction` (Sortie 1) | `apps/web/src/app/dashboard/_actions/confirm-hours-action.ts:82-85` | admin (service_role) | No (bypass) |
| `approve_shift` agent tool | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:337-351` | callerClient (JWT) | **Yes** — must pass new WITH CHECK |
| Reports handler | `supabase/functions/workspace-api/handlers/reports.ts:114` | SELECT only | n/a |

Backward-compat predicate: the `approve_shift` tool sets `status='approved'`, `approved_by=$caller_profile_id`, `approved_hours=...`. Caller is gated by `capability='shift.approve_shift'` (admin/manager level). The new WITH CHECK must allow this branch.

### 3.5 `schedule_shift` writers (must not break)

| Surface | Path | Client | Branch |
|---|---|---|---|
| Schedule grid mutations | `packages/schedule/src/use-grid-mutations.ts:117` | anon (JWT) | admin (jwt_update) |
| `use-shifts.ts` create/update/move/delete | `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts:83,162,244,321` | anon (JWT) | admin |
| `confirmShiftAction` (Sortie 1) | `apps/web/src/app/dashboard/_actions/confirm-shift-action.ts:70-73` | admin (service_role) | bypass |
| Shift clock | `apps/web/src/hooks/shift-clock/useShiftClock.ts:225+` | anon (JWT) | employee self (jwt_employee_confirm_own_shift) |
| Engine triggers | `supabase/functions/engine-dispatch/index.ts` | service_role | bypass |
| Payroll snapshot etc. | `apps/web/src/app/api/payroll/**` | admin/service | bypass |

All JWT-path writers already fit the existing admin-OR-employee_id predicate. No new migration needed for schedule_shift.

### 3.6 Latest migration timestamp

`20260604121000_sortie_1_gate_action_seed.sql`. Sortie A uses `20260605120000+`.

## 4. Scope items

### 4.1 `shift_approval` UPDATE policy — REPLACE

Drop the broad `FOR ALL` policy and re-create as 4 separate per-verb policies, mirroring `schedule_shift`'s shape: explicit SELECT/INSERT/UPDATE/DELETE with USING and WITH CHECK.

Splitting `FOR ALL` is safer than ALTER'ing it because Postgres has no `ALTER POLICY ... ADD WITH CHECK` syntax that preserves the existing USING. Recreate fully.

**New `jwt_update_shift_approval` predicate:**

```
USING (
  workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  AND (
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = shift_approval.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.schedule_shift s
      JOIN public.profile p ON p.profile_id = s.employee_id
      WHERE s.schedule_shift_id = shift_approval.shift_id
        AND p.user_id = auth.uid()
        AND p.is_active = true
    )
  )
)
WITH CHECK (
  workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  AND (
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = shift_approval.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.schedule_shift s
      JOIN public.profile p ON p.profile_id = s.employee_id
      WHERE s.schedule_shift_id = shift_approval.shift_id
        AND p.user_id = auth.uid()
        AND p.is_active = true
    )
  )
)
```

Separate `jwt_read_shift_approval` (unchanged — read remains workspace-wide), `jwt_insert_shift_approval` (admin-only — match current INSERT reality), `jwt_delete_shift_approval` (admin-only). `service_role_shift_approval` and `api_key_read_shift_approval` remain untouched.

**Note on transition:** the predicate is identical for USING and WITH CHECK. This is correct because both submitter (employee) and approver (manager) need symmetric pass/fail — there is no row-state transition mid-flow that flips which actor is allowed; the row enters as `pending` and the manager updates it to `approved`. The employee branch matters only for pre-Sortie-1 historical paths (mobile spec line 535) and any future "edit my submitted hours" feature — keeping it preserves forward compat.

### 4.2 `schedule_shift` UPDATE policy — NO CHANGE, ADD REGRESSION TEST

Both existing policies already carry symmetric USING + WITH CHECK. Sortie A produces only a pgTAP test asserting:

1. Admin can update any row in their workspace (positive)
2. Employee can update only own `employee_id` rows (positive)
3. Employee cannot flip `employee_id` to another profile_id (negative — already blocked by `jwt_employee_confirm_own_shift` WITH CHECK)
4. Employee cannot flip `workspace_id` to foreign workspace (negative)
5. Non-member cannot update anything (negative)

If the audit reveals an unexpected drift (e.g., a third policy added between investigation and sortie start), council escalation per §9.

### 4.3 Backward-compat assertions

| Writer | Branch hit | Verified |
|---|---|---|
| `engine-dispatch.queue_shift_approval` INSERT | service_role bypass | trivially |
| `confirmHoursAction` UPDATE | service_role bypass | trivially |
| `approve_shift` agent tool UPDATE | manager-in-workspace EXISTS branch | pgTAP positive case |
| Hypothetical employee self-edit | own-shift EXISTS branch | pgTAP positive case |
| Forgery: flip `approved_by` to victim | RLS does NOT enforce this (payload column) | covered by app-layer (Sortie 1 ADR-0151) |

**Important nuance:** RLS WITH CHECK does NOT block `approved_by = forged_uuid` because `approved_by` is a payload column, not a predicate-target. The forgeable-actor gap RLS closes is workspace/row-ownership: a JWT-anon caller cannot UPDATE a row that doesn't belong to a workspace they're a member of, and cannot flip a row INTO a workspace they don't belong to. Field-level actor forgery (e.g., setting `approved_by = $other_profile_id`) is closed at the application layer (Sortie 1 server actions resolve `approved_by` from `ResolvedActor`, not from request body — ADR-0151). Spec explicitly documents this dual-layer.

## 5. Migration plan

Two-file plan reflecting the audit reality:

1. `supabase/migrations/20260605120000_shift_approval_rls_with_check.sql` — drop+recreate split policies per §4.1
2. `supabase/migrations/20260605121000_schedule_shift_rls_invariant_assert.sql` — comment-only migration documenting the audit verdict

Single git commit titled: `fix(rls): WITH CHECK on shift_approval UPDATE (Sortie A defense)`.

## 6. pgTAP test plan

`supabase/tests/sortie-a-shift-approval-rls.spec.sql` — uses Sortie 1 pgTAP harness pattern:

- **Positive cases** (must PASS RLS check):
  - P1: admin user updates pending → approved
  - P2: manager user updates pending → approved
  - P3: shift owner (employee) updates pending → edited (forward-compat)
- **Negative cases** (must trigger RLS violation):
  - N1: non-workspace-member updates row → reject
  - N2: workspace member with role='employee' AND not shift owner → reject
  - N3: caller tries to flip `workspace_id` to foreign workspace → reject
  - N4: caller tries to UPDATE a row from another workspace → reject

`supabase/tests/sortie-a-schedule-shift-rls.spec.sql` — regression-locks the existing two-policy composition:

- **Positive cases:**
  - P1: admin updates any field
  - P2: employee updates own row `confirmed_at`
- **Negative cases:**
  - N1: employee tries to UPDATE a row where `employee_id != self`
  - N2: employee tries to flip `workspace_id` to foreign workspace (already blocked by WITH CHECK)
  - N3: employee tries to flip `employee_id` to colleague's profile_id (must be blocked)
  - N4: non-member updates → reject

## 7. E2E test

`apps/e2e/tests/sortie-a-d6-forgery-rejection.spec.ts` — extends the Sortie 1 mobile-hours-confirm shape.

Scenario: direct PostgREST call with anon-key + employee JWT, attempting to UPDATE a `shift_approval` row in a workspace the JWT does not belong to. Expect HTTP 4xx (PostgREST surfaces RLS violation as `42501` → 403 or `204 No Content` on no-rows-affected when USING fails — verify which against local stack and assert on the visible signal).

Single test file; two scenarios (shift_approval + schedule_shift). Skip-gate the test with `test.skip(!process.env.LOCAL_SUPABASE)` because it requires the local stack and direct PostgREST access.

## 8. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | `approve_shift` agent tool uses `callerClient` but the tool runs under stage-engine which may inject service_role; if so, RLS is moot for this path and pgTAP P2 must be re-cast as "no-bypass JWT path" simulation | Phase 1 grep verifies callerClient identity; if service_role, document and adjust test to direct PostgREST simulation |
| R2 | `is_active = true` filter in helper functions excludes recently-deactivated users mid-flow | Pre-existing behavior in `get_workspace_ids_for_user`; no change in Sortie A |
| R3 | Splitting `FOR ALL` into per-verb policies subtly changes SELECT behavior if anyone relied on the role-gate inside `jwt_manage_shift_approval` for reads | Old `jwt_read_shift_approval` (line 150-154) already covers SELECT with workspace-only predicate. Verified: split is read-equivalent. |
| R4 | Future migration drops `jwt_employee_confirm_own_shift` thinking it's redundant with `jwt_update_schedule_shift` | Comment the policy at recreate time + reference Sortie A in the migration header |
| R5 | A writer that today uses service_role is later moved to anon JWT and breaks against new WITH CHECK | Documented in HANDOFF + add to L-0238 if it surfaces; defense-in-depth means writers SHOULD hit RLS, not bypass it |

## 9. Council escalation triggers

1. Phase 1 audit finds a third undocumented policy on `shift_approval` or `schedule_shift` (drift since 2026-05-13 investigation)
2. `approve_shift` tool turns out to write via service_role — invalidates pgTAP P2 design, council to reshape test
3. A new writer surfaces in `grep` that doesn't fit admin-OR-owner predicate (e.g., a cron that updates `shift_approval` under JWT identity)
4. Splitting `FOR ALL` reveals a hidden read-path dependency

## 10. Acceptance criteria

- [ ] 1 migration lands changing `shift_approval` policies (split + WITH CHECK)
- [ ] 1 comment-only migration documenting `schedule_shift` audit verdict
- [ ] 2 pgTAP spec files, all positive + negative cases PASS
- [ ] 1 E2E forgery-rejection test PASSES against local Supabase
- [ ] Zero app code changes
- [ ] `pnpm turbo typecheck` clean on `feat/sortie-a-d6-rls-hardening`
- [ ] HANDOFF + JOURNEY written
- [ ] ADR-0299 (reserved by Sortie 1) registered in `0000-decision-log.md`
- [ ] L-0238 slot reserved for any field-level forgery learning discovered during work
