---
title: "Sortie A.2 D6 RLS WITH CHECK — T4 Verification Report"
status: complete
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, rls, sortie-a2, verification, pgTAP, idempotency]
---

# Sortie A.2 — T4 (Verifier) Report

**Branch:** `feat/sortie-a2-d6-rls-with-check`
**Working dir:** `/home/sxtnl/dev/smartout.ai-wt-6`
**Migration:** `supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql`
**Date:** 2026-05-13

**Overall verdict:** **PASS** — all 10 acceptance criteria (S1-S10) met. Migration ships with WITH CHECK + role gate (deviation only) on 4 D6 sister tables. 1 known follow-up regression surface documented in S7 for future Server Action migration (does not block close).

---

## Verification protocol results

### Step 1 — Local migration apply

- Supabase local already running on `127.0.0.1:54322`.
- `npx supabase migration up --local` applied `20260608120000_sortie_a2_d6_rls_with_check.sql` cleanly.
- 4 NOTICE messages on `DROP POLICY IF EXISTS` for `jwt_manage_*` and `jwt_own_personal_task` — expected on fresh DB where prior policies did not exist (idempotency-safe drops).
- Post-apply: 23 policies on 4 target tables (department_session 6, deviation 6, personal_task 6, session_hook 5). Confirms 4 jwt_* per-verb + service_role + api_key_read (where present).

**Step 1: PASS.**

### Step 2 — pgTAP tests (15 assertions, 4 files)

Installed `pgtap` extension. Ran each test file via `docker exec ... psql -f`.

| File | Assertions | Result |
|---|---|---|
| `sortie_a2_department_session.sql` | 3 | 3/3 PASS |
| `sortie_a2_session_hook.sql` | 3 | 3/3 PASS |
| `sortie_a2_deviation.sql` | 5 | 5/5 PASS |
| `sortie_a2_personal_task.sql` | 4 | 4/4 PASS |
| **Total** | **15** | **15/15 PASS** |

T2's flagged unknowns (policy-name array mismatch) were a non-issue — T1's actual policy names exactly match T2's expected arrays (incl. `personal_task` correctly using `jwt_select_personal_task`).

**Step 2: PASS.**

### Step 3 — Idempotency (S6)

Re-applied `20260608120000_sortie_a2_d6_rls_with_check.sql` manually after initial Step 1 apply.

- Exit code 0, no ERROR/FATAL output.
- NOTICEs only on `DROP POLICY IF EXISTS` for policies that don't exist (expected — those are no-op DROPs of historical pre-A.2 policy names like `jwt_manage_deviation`).
- Post re-apply: 16 JWT policies across 4 tables × 4 verbs = 16. No drift.

**Step 3: PASS.**

### Step 4 — Acceptance criteria S1-S10

#### S1: No `FOR ALL` `jwt_manage_*` remains

```sql
SELECT polname, polcmd FROM pg_policy
WHERE polrelid::regclass::text IN
  ('department_session','session_hook','deviation','personal_task')
  AND polcmd = '*'
  AND polname NOT LIKE 'service_role_%';
-- → 0 rows
```

**S1: PASS.**

#### S2: pgTAP `policies_are` PASS on 4 tables

All 4 `policies_are` assertions PASS (one per test file). Confirms exact policy set per table matches Sortie A naming convention. **S2: PASS.**

#### S3: deviation role gate (employee blocked, manager allowed)

- `sortie_a2_deviation.sql` test #1: employee INSERT throws 42501 — PASS
- `sortie_a2_deviation.sql` test #2: manager INSERT lives — PASS

**S3: PASS.**

#### S4: forge `throws_ok` PASS

- department_session: forge throws 42501 — PASS
- session_hook: forge throws 42501 — PASS
- deviation: forge throws 42501 — PASS
- personal_task: forge throws 42501 — PASS

**S4: PASS** (4 forge tests).

#### S5: happy-path `lives_ok` PASS

- department_session: admin UPDATE own row lives — PASS
- session_hook: admin UPDATE own row lives — PASS
- deviation: manager UPDATE own row lives — PASS
- personal_task: owner UPDATE own row lives (via JWT-direct, ADR-0301 path) — PASS
- personal_task: RPC `fn_list_my_tasks` returns owner's row (ADR-0300 readpath) — PASS

**S5: PASS** (5 happy-path tests across 4 tables).

#### S6: Idempotency — see Step 3 above. **S6: PASS.**

#### S7: Regression sweep — direct table writers

Enumerated all `.insert/.update/.delete` callers across `apps/web/src`, `apps/mobile/src`, `packages/ai/src`, `services/`, `supabase/functions/`.

| Table | Caller class | Verdict |
|---|---|---|
| `personal_task` | 0 direct app writes — all via capability `ctx.supabaseAdmin` (service_role) OR RPC `fn_list_my_tasks` (SECURITY DEFINER). | **SAFE** |
| `department_session` | DailyNoteSheet UPSERT, OversiktTab UPDATE, InlineTaskCreator INSERT — all client `createClient()`. Plus many `_actions/*.ts` Server Actions (admin client). | **SAFE** — new policy only requires workspace membership (no role gate), and all client paths are inside Day Control / Operations / cockpit (workspace members only). |
| `session_hook` | `use-maintenance-procedures.ts` client INSERT/DELETE in HMS Governance route. Capability tools = service_role. | **SAFE** — new policy is workspace-membership only (no role gate). Existing HMS Governance access pattern is admin-by-UX-convention but not gated programmatically — RLS now safer. |
| `deviation` | **client-side direct writes (likely regression risk):** 1) `DeviationDialog.tsx` (Operations page) INSERT; 2) `EventDetailPanel.tsx:DeviationForm` UPDATE (resolve/acknowledge) in Day Control event drawer; 3) `useUpdateDeviation` hook (HMS deviations list); 4) `DeviationDetailTab.tsx` (entity drawer) UPDATE; 5) `useReconciliation.ts` UPDATE. **Server-side admin writes (safe):** `report-deviation-action.ts` (Server Action via `createAdminClient()` + `gate_action()` ADR-0099). | **EXPECTED PER JOURNEY** — new role gate `admin/owner/manager` will reject employee-tier callers on these 5 client paths. Journey `employee-cannot-mutate-deviation.md` documents this exact outcome. The migration intent IS to enforce manager-tier role on deviation mutations. Pre-A.2 these client paths inherited a no-role-gate `FOR ALL` policy — they were silently allowing employee mutations, an ADR-0114 violation. Sortie A.2 closes the gap. |

**S7 follow-up for HANDOFF:** Five client-side `deviation` mutation paths inherit the same ADR-0114 violation pattern that `report-deviation-action.ts` already migrated away from. Recommend follow-up sortie to migrate:
1. `apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx` (INSERT) → reuse `reportDeviationAction`
2. `apps/web/src/components/day/EventDetailPanel.tsx` deviation UPDATE → new Server Action `resolveDeviationAction`
3. `apps/web/src/app/dashboard/hms/_hooks/use-update-deviation.ts` → wrap with Server Action
4. `apps/web/src/components/dashboard/entity-drawer/tabs/deviation/DeviationDetailTab.tsx` UPDATE → wrap with Server Action
5. `apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts` UPDATE → wrap with Server Action (likely already manager-tier UX, lower priority)

Until that follow-up ships, **production behavior is**: only `role IN ('admin','owner','manager')` profiles can use these 5 paths. Employee/trainee profiles will see 42501 toast errors. This matches ADR-0299 intent + the `employee-cannot-mutate-deviation` journey.

**S7: PASS** (regression flag is by-design, not a defect).

#### S8: Documentation in place

- `docs/decisions/0299-sortie-a-d6-rls-with-check.md` contains "Sister-Table Closure" section (T3 amendment) ✅
- `docs/decisions/0303-sister-table-sweep-rule.md` exists, `status: proposed` ✅
- `docs/decisions/0000-decision-log.md` row for ADR-0303 present ✅

**S8: PASS.**

#### S9: Typecheck

`npx turbo typecheck --filter=web --force` ran fresh (cache bypass): **11/11 tasks successful, 0 errors, 4m32s**. Migration is SQL-only — no TS surface affected. **S9: PASS.**

#### S10: Journey frontmatter flipped to `verified`

All 4 journey files updated `status: draft → verified`, `verified_at: null → 2026-05-13`:

- `JOURNEY-sortie-a2-d6-rls-with-check-attacker-forges-workspace-id-rejected.md` ✅
- `JOURNEY-sortie-a2-d6-rls-with-check-employee-cannot-mutate-deviation.md` ✅
- `JOURNEY-sortie-a2-d6-rls-with-check-manager-updates-own-deviation.md` ✅
- `JOURNEY-sortie-a2-d6-rls-with-check-personal-task-rpc-still-works.md` ✅

**S10: PASS.**

---

## Summary table

| ID | Criterion | Result |
|---|---|---|
| S1 | No `FOR ALL` `jwt_manage_*` policies remain on 4 tables | **PASS** |
| S2 | pgTAP `policies_are` PASS on all 4 tables | **PASS** |
| S3 | deviation role gate: employee throws, manager lives | **PASS** |
| S4 | Forge `throws_ok` PASS on all 4 tables | **PASS** |
| S5 | Happy-path `lives_ok` PASS on all 4 tables (+ personal_task RPC) | **PASS** |
| S6 | Migration is idempotent | **PASS** |
| S7 | App-tier regression sweep | **PASS** (follow-up documented) |
| S8 | ADR docs landed (0299 amendment + 0303 new + decision-log) | **PASS** |
| S9 | Typecheck 0 errors | **PASS** |
| S10 | Journey frontmatter flipped to verified | **PASS** |

**Total: 10/10 PASS. Sortie A.2 ready for close-feature.**

---

## Follow-up sortie (recommended, not blocking)

**Title:** Sortie A.2.1 — Migrate client-side deviation mutations to Server Actions
**Scope:** 5 client paths listed in S7 follow-up
**Rationale:** Eliminates ADR-0114 violation surface for deviation domain. Mirrors `report-deviation-action.ts` pattern (Server Action + admin client + `gate_action()` + awaited `emit()`).
**Risk if deferred:** Employee/trainee users will see 42501 toast errors when interacting with deviation UI surfaces (Operations dialog, Day Control event drawer, HMS deviations list, entity drawer). For most production workspaces this is unlikely to surface because the affected UI surfaces are admin/manager-tier by UX convention, but no programmatic gate exists today.

---

## Files modified by T4

- `docs/journeys/JOURNEY-sortie-a2-d6-rls-with-check-attacker-forges-workspace-id-rejected.md` (frontmatter flip)
- `docs/journeys/JOURNEY-sortie-a2-d6-rls-with-check-employee-cannot-mutate-deviation.md` (frontmatter flip)
- `docs/journeys/JOURNEY-sortie-a2-d6-rls-with-check-manager-updates-own-deviation.md` (frontmatter flip)
- `docs/journeys/JOURNEY-sortie-a2-d6-rls-with-check-personal-task-rpc-still-works.md` (frontmatter flip)
- `docs/audits/2026-05-13-sortie-a2-verification.md` (this report)

No code/migration/test files modified by T4. No fix patches were needed.
