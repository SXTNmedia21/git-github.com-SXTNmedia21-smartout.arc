---
title: Plan — D6 RLS WITH CHECK Enforcement (T4 / Sortie A.2)
feature: sortie-a2-d6-rls-with-check
spec: ../superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md
status: draft
created: 2026-05-13
updated: 2026-05-14
module: schedule
scope: sortie
tags: [sortie-a2, rls, with-check, d6, schedule, deviation, session, workspace-forgery, adr-0151, adr-0303]
---

# Plan: D6 RLS WITH CHECK Enforcement (T4)

**Sortie:** `feat/sortie-a2-d6-rls-with-check` | Worktree: `~/dev/smartout.ai-wt-6` | Linear: **SMA-361**
**ADR slot:** 0313 — re-evaluated below (ADR-0299 + ADR-0303 already accepted; 0313 may be redundant or implementation-counterpart)

## ⚠️ CRITICAL FINDING — Scope May Be Already Shipped

Plan agent discovery (verified):
- `supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql` ALREADY EXISTS in main repo on `development`
- ADR-0299 (`0299-sortie-a-d6-rls-with-check.md`) already accepted
- ADR-0303 (`0303-sister-table-sweep-rule.md`) already accepted (proposed)
- Predicate decisions already made by whoever shipped the migration

**Sortie scope collapses to verification:**
1. Confirm migration content matches the chosen Option A symmetric-USING-WITH-CHECK strategy
2. Add pgTAP tests for 4 declared journeys
3. Verify journey-frontmatter `status: verified` on close
4. Decide ADR-0313 — keep as implementation-counterpart, or supersede with ADR-0299/0303

---

## 1. Tables in Scope — Current Policy State

**schedule_shift** (`20260301300000_schedule_shift_table.sql:98-108`) — COMPLIANT
- INSERT: `jwt_insert_schedule_shift WITH CHECK (is_admin_in_workspace(...))` — PRESENT
- UPDATE: `jwt_update_schedule_shift USING(...) WITH CHECK (...)` symmetric — PRESENT
- Audit verdict `20260605121000`: COMPLIANT. **NOT in A.2 scope.**

The actual 4 tables remediated by `20260608120000`:

| Table | Pre-A.2 Policy | WITH CHECK Status | Role Gate |
|---|---|---|---|
| `department_session` | `jwt_manage_*` FOR ALL USING (workspace_id + admin/owner) | **MISSING** | admin/owner in USING, not enforced on write |
| `session_hook` | `jwt_manage_*` FOR ALL USING (workspace_id + admin/owner) | **MISSING** | admin/owner in USING, not enforced on write |
| `deviation` | `jwt_manage_*` FOR ALL USING (workspace_id only) | **MISSING** | NONE — any workspace member can INSERT/UPDATE/DELETE |
| `personal_task` | `jwt_own_*` FOR ALL USING (profile_id in caller profiles) | **MISSING** | Owner-only in USING, not enforced on write |

Origin files:
- `department_session`: `20260304200000_department_session.sql:65-73`
- `session_hook`: `20260412100300_session_infrastructure.sql:40-48`
- `deviation`: `20260304200200_deviation_shift_approval.sql:92-95`
- `personal_task`: `20260520100000_personal_task.sql:45-52`

`session_task` UPDATE already has WITH CHECK from Sortie 1 (`20260604120000_session_task_rls_with_check.sql:9-28`). Its INSERT not JWT-exposed. **Out of scope.** Council Q3 covers session_task INSERT gap.

---

## 2. Predicate Strategy

**Chosen: Option A (symmetric USING = WITH CHECK) for all 4 tables**, with role-gate addition on `deviation`.

Option C (OLD.workspace_id equality via trigger) **rejected** — WITH CHECK has no OLD access; trigger path is outside RLS policy chain (harder to audit).

Option B (JWT workspace context helper) **rejected** — no `current_workspace_id_from_jwt()` helper exists; building one = new trust surface.

Option A reasoning: "same user manager in both workspaces" boundary acceptable. Attack class closed = unauthenticated/cross-tenant forgery. Legitimate workspace transfer = service_role + `gatedMutation` (ADR-0204).

**Per-table SQL fragments:**

**department_session** (admin/owner role gate preserved):
```sql
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.profile p
    WHERE p.user_id = auth.uid()
      AND p.workspace_id = department_session.workspace_id
      AND p.role IN ('admin', 'owner')
      AND p.is_active = true
  )
);
-- UPDATE: identical USING + WITH CHECK
-- DELETE: is_admin_in_workspace(auth.uid(), workspace_id)
```

**session_hook** — identical to department_session.

**deviation** (manager+ role gate ADDED — was ANY member):
```sql
-- INSERT/UPDATE/DELETE: role IN ('admin','owner','manager')
-- SELECT: unchanged (jwt_read_deviation, any workspace member)
```
Writer enumeration (migration COMMENT): DeviationDialog (manager+ JWT — satisfies), EntityDrawer DeviationDetailTab (manager+ JWT — satisfies), HMS `use-create-deviation` Server Action (service_role bypass), payroll `run-deviation-checks` (writes `payroll.deviation` separate schema — unaffected). All 4 paths verified safe.

**personal_task** (owner-only — WITH CHECK pins BOTH profile_id AND workspace_id):
```sql
-- INSERT WITH CHECK:
EXISTS (
  SELECT 1 FROM public.profile p
  WHERE p.user_id = auth.uid()
    AND p.profile_id = personal_task.profile_id
    AND p.workspace_id = personal_task.workspace_id
    AND p.is_active = true
)
-- UPDATE USING: profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
-- UPDATE WITH CHECK: identical EXISTS join — blocks profile_id swap + workspace_id flip
-- DELETE USING: same profile_id subquery
```

Single EXISTS join stronger than two independent subqueries (prevents cross-workspace forgery where caller passes `profile_id` from A but `workspace_id` of B).

---

## 3. Migration Spec

**Already shipped:** `20260608120000_sortie_a2_d6_rls_with_check.sql` exists. Verify contents match Section 2 strategy. Any deviations = Council Q.

If migration content differs from plan: open follow-up migration `20260614120000_sortie_a2_d6_rls_corrections.sql` to bring policies into compliance with this plan. Do NOT edit shipped migration.

Service-role policies (`service_role_*`, `api_key_read_*`) left untouched. Stage-engine writes via `ctx.supabaseAdmin` bypass JWT policies; `gatedMutation` provides upstream C4 gate.

No trigger needed (Option A).

---

## 4. Performance Check

**Hot path:** `department_session` UPDATE during session open/close (1-10 ops/day/workspace) — per-row predicate cost negligible.

**Index coverage:**
- `department_session.workspace_id` ✓ covered by `idx_dept_session_date` + `idx_dept_session_status`
- `session_hook.workspace_id` — covered by `idx_session_hook_dept_type`; few rows per workspace = seq scan fine
- `deviation.workspace_id` ✓ covered by `idx_deviation_status` + `idx_deviation_session`
- `personal_task.workspace_id` ✓ covered by `idx_personal_task_workspace(workspace_id, profile_id)`
- **`profile.user_id`** — `get_workspace_ids_for_user` is SECURITY DEFINER STABLE. May benefit from `CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id)` for personal_task WITH CHECK EXISTS join at scale (200+ profiles/workspace). **Council Q2.**

---

## 5. Personal-Task Carve-Out (Journey 4)

`fn_list_my_tasks` RPC is SECURITY DEFINER (ADR-0300, `20260606120100_fn_list_my_tasks.sql`). Bypasses JWT RLS entirely. Per-verb split on `personal_task` has **zero impact on read path.**

`task` capability tools (ADR-0301) write via `ctx.supabaseAdmin` (service_role). `service_role_personal_task` policy untouched. Write path unaffected.

JWT split matters only for direct PostgREST. Defense-in-depth: if future direct JWT writer appears (e.g. mobile REST direct), per-verb WITH CHECK enforces owner invariant.

**Regression proof:**
1. `SELECT fn_list_my_tasks('<workspace_id>')` as seed employee → returns rows
2. `task.complete` via stage-engine service_role → succeeds
3. pgTAP `lives_ok` JWT UPDATE where `profile_id = caller` → passes

---

## 6. Journey-to-Test Mapping

**Journey 1 — attacker-forges-workspace-id-rejected** (department_session, session_hook, personal_task; deviation via Journey 2):
- SQL probe: two-workspace user → `UPDATE department_session SET workspace_id = '<workspace_B>' WHERE department_session_id = '<workspace_A_row>'`
- pgTAP: `supabase/tests/rls/sortie_a2_department_session.sql` — `throws_ok(...)` 42501
- Files: `sortie_a2_session_hook.sql`, `sortie_a2_personal_task.sql`

**Journey 2 — employee-cannot-mutate-deviation:**
- SQL probe: employee JWT → INSERT/UPDATE/DELETE on `deviation` workspace_A row
- pgTAP: `throws_ok` for INSERT/UPDATE/DELETE as employee; `lives_ok` for SELECT as employee

**Journey 3 — manager-updates-own-deviation:**
- SQL probe: manager JWT → UPDATE deviation own-workspace row
- pgTAP: `lives_ok` UPDATE as manager

**Journey 4 — personal-task-rpc-still-works:**
- SQL probe: `SELECT fn_list_my_tasks(...)` as seed employee → rows > 0
- pgTAP: `lives_ok` UPDATE where profile_id = caller; `throws_ok` UPDATE where profile_id ≠ caller; `lives_ok` RPC

Fixture pattern: `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...` to simulate JWT context. Seed must provide two workspace memberships.

---

## 7. ADR-0313 Re-evaluation

**ADR-0299** (sortie-a-d6-rls-with-check) already accepted — captures Sortie 1 work.
**ADR-0303** (sister-table-sweep-rule) already accepted (proposed) — codifies the rule that triggered this sortie.

**ADR-0313 decision:** Keep as **implementation-level counterpart** — documents specific predicate shape + per-table role-gate policy. Serves as reference for future D6 table additions.

Skeleton:
```yaml
title: "D6 RLS WITH CHECK invariants — predicate shape and role-gate policy"
id: ADR_0313
status: proposed
layer: decision
module: schedule
bound-by: [ADR_0151, ADR_0299, ADR_0303]
```

Sections: Context (Sortie A.2 closure), Decision (Option A symmetric USING=WITH CHECK; deviation manager+ gate; personal_task single EXISTS join), Rule for future D6 tables (per-verb policies + INSERT/UPDATE WITH CHECK MUST mirror USING + FOR ALL on D6 = merge blocker per ADR-0303), Service-role boundary (JWT-only gates; stage-engine via gatedMutation).

---

## 8. Conflict Surface

| Artifact | Change | Risk |
|---|---|---|
| `supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql` | **ALREADY EXISTS** in dev — no new write | None |
| `supabase/tests/rls/sortie_a2_*.sql` (4 files) | NEW | None |
| `docs/decisions/0000-decision-log.md` | Append ADR-0313 row | Standard merge |
| `docs/decisions/0313-d6-rls-with-check-invariants.md` | NEW | None |
| `database.types.ts` | NO CHANGE | RLS invisible to type generator |

---

## 9. Build Sequence (verification-only)

- [ ] **Phase 1 — Audit** verify migration content matches plan
  - `cat supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql`
  - Compare per-table policies to Section 2 SQL fragments
  - Flag any deviation as Council Q

- [ ] **Phase 2 — pgTAP tests** (4 new files in `supabase/tests/rls/`)
  - `sortie_a2_department_session.sql`
  - `sortie_a2_session_hook.sql`
  - `sortie_a2_deviation.sql`
  - `sortie_a2_personal_task.sql`

- [ ] **Phase 3 — ADR-0313** write + register

- [ ] **Phase 4 — Verify**
  - `supabase db reset` → apply migrations → `pnpm supabase test db`
  - Grep `apps/ packages/ services/` for direct JWT writes to 4 tables — confirm service_role paths
  - Re-apply migration (idempotency)

- [ ] **Phase 5 — Closure**
  - Update `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md` with F-DB-09 closure
  - Mark all 4 journey frontmatter `status: verified`
  - `pnpm turbo typecheck`

---

## 10. Council Questions (3)

**Q1 — Predicate boundary for deviation role gate.** Manager+ gate assumes zero employee-tier JWT writes today. If product roadmap contains employee deviation self-report ("I was late, here's why") in next 90 days, add employee-self-insert branch now (`reported_by IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())`) rather than reverting at feature-time.

**Q2 — `profile.user_id` index coverage.** EXISTS join queries `profile WHERE user_id = auth.uid()`. Verify via `EXPLAIN (ANALYZE, BUFFERS)` on personal_task INSERT in local. If seq scan: `CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id)`.

**Q3 — session_task INSERT gap.** Origin `20260412100300:84-103` has no `jwt_insert_session_task` policy — only SELECT + UPDATE. Sortie 1 fixed UPDATE WITH CHECK. INSERT JWT remains ungated. Pull into A.2 (one extra block, trivial) or separate finding? Recommend pulling — sister-table-sweep principle per ADR-0303.
