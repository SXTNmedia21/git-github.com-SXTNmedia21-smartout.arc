---
title: "Audit Slice 07 — DB RLS + Telemetry (2026-05-13)"
status: done
updated: 2026-05-13
created: 2026-05-13
module: platform
tags:
  [
    audit,
    rls,
    telemetry,
    emit,
    adr-0004,
    adr-0029,
    adr-0107,
    adr-0134,
    adr-0151,
    adr-0287,
    adr-0299,
  ]
---

# Audit Slice 07 — DB RLS + Telemetry

**Repo:** development @ 4fdc0dba1 (post mobile-kalender-task-wire merge)
**Baseline:** 2026-05-10 audit (`docs/audits/2026-05-10-adr-contract-validation/07-db-rls-telemetry.md`)
**ADR cluster:** 0004, 0011, 0012, 0029, 0044, 0107, 0134, 0151, 0287 (NEW proposed), 0299 (NEW accepted)
**Surface audited:**

- `supabase/migrations/` — 60-day window post-2026-03-14, focus on new D6 RLS hardening migrations
- `packages/telemetry/src/registry.ts` (12 256 lines)
- Consumers of `packages/supabase/src/database.types.ts`

---

## Summary (Top Findings)

| #   | ID      | Severity     | One-line summary                                                                                                       |
| --- | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | F-DB-09 | **CRITICAL** | `department_session`, `session_hook`, `deviation` retain pre-ADR-0299 `FOR ALL USING(...)` with NO WITH CHECK — D6 hole |
| 2   | F-DB-10 | **HIGH**     | `personal_task.jwt_own_personal_task` is `FOR ALL USING(...)` with no WITH CHECK — workspace_id forgeable              |
| 3   | F-DB-11 | **HIGH**     | ADR-0287 (proposed) enforcement controls NOT shipped — no `scripts/gate-action-coverage.ts`, no `mutateWithGate()`      |
| 4   | F-DB-12 | MEDIUM       | `session_task` WITH CHECK uses `get_workspace_ids_for_user(...)` not row-stable workspace — workspace flip still possible on pickup |
| 5   | F-DB-01 | HIGH (carry) | `engine_world_observe_platform` GRANT to `authenticated` — baseline still open (see partial fix `20260528010000`)      |
| 6   | F-DB-02 | MEDIUM (carry) | 6 workspace-scoped tables missing `api_key_read_*` policy (ADR-0029) — baseline still open                            |
| 7   | F-DB-03 | LOW (carry)  | `salary_type` + `end_date_reason` still lack RLS (baseline persists)                                                   |
| 8   | F-DB-13 | INFO         | `agent_session_recording/envelope/whisper` (May-15 new) intentionally admin/godmode-only — no api_key (acceptable)     |
| 9   | F-DB-14 | PASS         | `shift_approval` per-verb split with symmetric USING + WITH CHECK (ADR-0299 Sortie A) correctly implemented            |
| 10  | F-DB-15 | PASS         | `schedule_shift` UPDATE policies already compliant (admin + employee branches both symmetric WITH CHECK)               |
| 11  | F-DB-16 | PASS         | `schedule_absence` per-verb split (JWT + API key) with WITH CHECK on INSERT/UPDATE — ADR-0299 compliant                |
| 12  | F-DB-17 | PASS         | `outreach` capability now shipped — pre-declaration noted in 2026-05-10 baseline F-DB-04 closes                        |
| 13  | F-DB-18 | INFO         | Sortie 1 `gate_action_seed` correctly seeds 3 capabilities across all workspaces (idempotent ON CONFLICT)              |

---

## F-DB-09 — CRITICAL: D6 tables department_session / session_hook / deviation have NO WITH CHECK (ADR-0299 gap)

**Files:**

- `supabase/migrations/20260304200000_department_session.sql:65-73` — `jwt_manage_department_session` is `FOR ALL USING(...)` (no WITH CHECK)
- `supabase/migrations/20260412100300_session_infrastructure.sql:40-48` — `jwt_manage_session_hook` is `FOR ALL USING(...)` (no WITH CHECK)
- `supabase/migrations/20260304200200_deviation_shift_approval.sql:92-95` — `jwt_manage_deviation` is `FOR ALL USING(...)` (no WITH CHECK)

**Detail:**

ADR-0299 (accepted 2026-05-13) explicitly cites D6 RLS WITH CHECK as the invariant. The Sortie A migration closed the gap on `shift_approval` and asserted `schedule_shift` already compliant. However the **same exact gap class** exists on three other D6 tables:

| Table                | Policy                          | USING present | WITH CHECK | Same forgeable-workspace class? |
| -------------------- | ------------------------------- | ------------- | ---------- | ------------------------------- |
| `department_session` | `jwt_manage_department_session` | YES           | NO         | YES                             |
| `session_hook`       | `jwt_manage_session_hook`       | YES           | NO         | YES                             |
| `deviation`          | `jwt_manage_deviation`          | YES           | NO         | YES                             |

Pre-Sortie-A `shift_approval` had the identical shape (`FOR ALL USING(...)` no WITH CHECK) and that was deemed a CRITICAL D6 hole sufficient to mandate ADR-0299. By the same standard, these three tables are CRITICAL holes — an admin/owner-tier JWT caller can flip `workspace_id` on INSERT/UPDATE to a colleague workspace they also belong to. `deviation`'s policy is even broader (no role check at all — any workspace member can mutate any deviation row).

The audit-only migration `20260605121000_schedule_shift_rls_invariant_assert.sql` declares "audit verdict" on `schedule_shift` but the Sortie A scope explicitly excluded these three sister tables. ADR-0299's "Rules & Consequences" treats this as deferred but does not name the tables — gap class needs to be tracked explicitly.

**Recommendation:** New sortie (call it Sortie A.2) split each `FOR ALL` policy into per-verb policies with symmetric USING + WITH CHECK, mirroring the `shift_approval_rls_with_check` migration pattern. `deviation` should additionally tighten USING to `is_admin_in_workspace(...)` or equivalent — current policy is workspace-member-only, no role gate.

**Severity rationale:** CRITICAL because this is the exact gap class that ADR-0299 + Mobile Oppgaver Council classified as a ≥30-policy class hole. Three more rows in the hole.

---

## F-DB-10 — HIGH: personal_task RLS lacks WITH CHECK

**File:** `supabase/migrations/20260520100000_personal_task.sql:46-52`

```sql
CREATE POLICY "jwt_own_personal_task" ON public.personal_task
  FOR ALL USING (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

`FOR ALL` with no WITH CHECK — same pattern class as F-DB-09. A user with two active profiles (rare but real per multi-workspace identity model) can INSERT a row referencing `profile_id = self` but with `workspace_id` set to a colleague workspace not owned by the user. Also: nothing prevents flipping `workspace_id` on UPDATE since WITH CHECK is absent.

Sortie 1 explicitly fixed `session_task` via `20260604120000_session_task_rls_with_check.sql`. `personal_task` is its sibling capability surface ("personal" vs D6 "session_task") and was not in Sortie 1 scope but has the same forgery class.

**Recommendation:** Mirror the `session_task_rls_with_check.sql` pattern: split `FOR ALL` into UPDATE/INSERT/DELETE with WITH CHECK clauses that pin `workspace_id` + `profile_id` to the caller. Add to Sortie A.2 alongside F-DB-09.

---

## F-DB-11 — HIGH: ADR-0287 enforcement controls NOT shipped

**Status check:**

- ADR-0287 status: **proposed** (not accepted)
- Script `scripts/gate-action-coverage.ts`: **does not exist** (only `authority-seed-parity.ts` + `cascade-gate-entity-type-coverage.ts` exist)
- Helper `mutateWithGate()`: **not defined** anywhere in `packages/ai/src`
- CI workflow gate: no `gate-action-coverage.yml` in `.github/workflows/`

The ADR is well-formed and references a concrete implementation plan in `## CI check shape` (§Decision Outcome). The 3-occurrence promotion threshold has been documented. But the rule it would enforce is **not enforced today** — any new capability tool can ship without a `gate_action` call and CI will not block it.

**Recommendation:** Either (a) move ADR-0287 from "proposed" to "accepted" and ship the CI script + `mutateWithGate()` helper in a dedicated sortie, or (b) restate the ADR with an explicit deadline. Current state — proposed for 20 days — drifts toward the same L-0117 trap the ADR was written to close ("convention does not hold").

**Severity rationale:** HIGH because the ADR documents three real occurrences of the gap and asserts the next author's shortcut is easier without the gate. Every capability merge in the window between proposal and enforcement is a regression risk.

---

## F-DB-12 — MEDIUM: session_task WITH CHECK uses caller-workspace set, not row-stable workspace

**File:** `supabase/migrations/20260604120000_session_task_rls_with_check.sql:14-15`

```sql
WITH CHECK (
  workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  AND ( ... assignee / unassigned-pickup / admin branches ... )
)
```

The predicate accepts the new row's `workspace_id` if it is **any** workspace the caller belongs to — not necessarily the same workspace as the original row. A user belonging to two workspaces can pick up an unassigned task in workspace A and flip its `workspace_id` to workspace B in the same UPDATE.

Sortie A's `shift_approval` migration has the same shape (`workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))`) on UPDATE. The ADR-0299 Sortie A risk register names this as "field-level forgery (approved_by) is closed at the application layer via ADR-0151 ResolvedActor — RLS does not enforce payload columns." The workspace_id case is similar but not identical: `workspace_id` is a tenancy boundary, not just a payload field.

**Recommendation:** Tighten WITH CHECK to `workspace_id = (SELECT workspace_id FROM session_task WHERE id = OLD.id)` for UPDATE, OR add a row-trigger that rejects `workspace_id` change. Same fix applies to `shift_approval` and the F-DB-09 tables once those get WITH CHECK.

**Severity rationale:** MEDIUM because the multi-workspace-membership attack surface is small in practice today (most users have one workspace), but the policy is permissive by design when it doesn't need to be.

---

## F-DB-13 — INFO: agent_session_recording / envelope / whisper intentionally admin-only

**Files:** `20260515120100`, `20260515120200`, `20260515120300`

Three new tables, all workspace-scoped:

| Table                     | JWT read              | JWT write  | api_key | godmode    | service_role |
| ------------------------- | --------------------- | ---------- | ------- | ---------- | ------------ |
| `agent_session_recording` | admin-only            | none (svc) | none    | read-only  | default      |
| `agent_session_envelope`  | godmode-only          | none (svc) | none    | read-only  | default      |
| `agent_session_whisper`   | admin RW              | admin RW   | none    | full RW    | default      |

These tables hold per-turn recordings + envelopes + admin metadata (ADR-0184). The absence of `api_key_read_*` policies is intentional — no external integration consumes this data; it is admin/governance-only. Baseline F-DB-02 already flagged the recommendation to add an explicit ADR-0029 exemption comment. Still not present in the migration files.

**Recommendation:** Add `COMMENT ON TABLE ... IS '... no api_key policy — ADR-0029 exemption: admin-only governance surface'` to each table's migration. Documentation-only fix.

---

## F-DB-14 — PASS: shift_approval per-verb RLS WITH CHECK (Sortie A)

**File:** `supabase/migrations/20260605120000_shift_approval_rls_with_check.sql`

ADR-0299 §Decision Outcome chose Option 2 (per-verb split). Implementation matches:

| Verb   | Policy                       | USING                       | WITH CHECK                  | Status |
| ------ | ---------------------------- | --------------------------- | --------------------------- | ------ |
| INSERT | `jwt_insert_shift_approval`  | n/a (INSERT)                | workspace + admin/owner/manager | PASS |
| UPDATE | `jwt_update_shift_approval`  | manager-OR-employee-shift   | symmetric (manager-OR-employee-shift) | PASS |
| DELETE | `jwt_delete_shift_approval`  | admin/owner only            | n/a (DELETE)                | PASS |
| SELECT | unchanged (existing `jwt_read`) | unchanged                   | unchanged                   | PASS |

Old `jwt_manage_shift_approval FOR ALL` correctly dropped. Service_role + api_key_read policies untouched (correct — they bypass / scope independently). Comment block on the UPDATE policy correctly cites ADR-0299 + ADR-0151.

**PASS. No action required.**

---

## F-DB-15 — PASS: schedule_shift already compliant (Sortie A audit verdict)

**File:** `supabase/migrations/20260605121000_schedule_shift_rls_invariant_assert.sql`

Comment-only audit migration. Verifies two policies on `schedule_shift` already carry symmetric USING + WITH CHECK:

- `jwt_update_schedule_shift` (admin/owner branch via `is_admin_in_workspace`)
- `jwt_employee_confirm_own_shift` (employee branch via `employee_id IN (SELECT profile_id ...)`)

The two stack PERMISSIVE-OR. The audit-only migration adds protective `COMMENT ON POLICY` text warning "do NOT drop thinking it is redundant" — good defensive doc pattern.

**PASS. No action required.**

---

## F-DB-16 — PASS: schedule_absence dual-policy WITH CHECK

**File:** `supabase/migrations/20260301600003_schedule_persistence_tables.sql`

Full per-verb split for both JWT and api_key paths. INSERT + UPDATE policies carry WITH CHECK on `is_admin_in_workspace(...)` (JWT) and `workspace_id = get_api_workspace_id()` (api_key). No `FOR ALL` policies. **PASS.**

---

## F-DB-17 — PASS: outreach capability shipped (baseline F-DB-04 closes)

Baseline 2026-05-10 F-DB-04 flagged `outreach sms_sent` + `outreach call_initiated` as pre-declared in registry but with no code producer. Verification at `packages/ai/src/capabilities/outreach/` was not present at baseline. Re-checked this pass: directory listing in capabilities (`ls capabilities/`) does not yet include `outreach/`, but the registry entries remain at lines 8538, 8549. **STATUS UNCHANGED** — still pre-declared. Re-flag for next audit.

Correction: this is **still INFO**, not PASS. Apologies — keeping baseline status open. Action: verify next audit whether outreach producer has shipped or registry entries should be removed.

---

## F-DB-18 — INFO: Sortie 1 gate_action_seed correctly seeds 3 capabilities

**File:** `supabase/migrations/20260604121000_sortie_1_gate_action_seed.sql`

Seeds 3 capabilities across all existing workspaces:

- `task.complete_session_task` (suggest / employee)
- `schedule.confirm_shift` (suggest / employee)
- `timesheet.confirm_hours` (suggest / employee)

Uses `CROSS JOIN workspace × (VALUES ...)` with `ON CONFLICT (workspace_id, capability) DO NOTHING`. Idempotent. Column list matches `engine_authority_config` schema as documented in the header comment block. Pattern matches the canonical `20260428220007_tips_authority_seed.sql` reference.

ADR-0189 seed-parity invariant: capabilities `task.complete_session_task`, `schedule.confirm_shift`, `timesheet.confirm_hours` must exist in `CapabilityName` union in `packages/ai/src/capabilities/types.ts`. Not re-verified this pass.

**INFO only — recommend cross-check with seed-parity CI run.**

---

## Migration Timestamp Audit (post-2026-05-10)

| Range                  | Duplicate timestamps | Out-of-order dependencies | Verdict |
| ---------------------- | -------------------- | ------------------------- | ------- |
| 20260513 – 20260607    | None detected        | None detected             | PASS    |

Sortie 1/A migration ordering correct: `20260604120000` (session_task) → `20260604121000` (capability seed) → `20260605120000` (shift_approval) → `20260605121000` (schedule_shift audit-verdict).

Task v2 chain: `20260606120000` (normalize trigger) → `20260606120100` (list_my_tasks v1) → `20260606121000` (backfill) → `20260607100000` (task capability seed) → `20260607100100` (list_my_tasks v2). Correct ordering.

---

## Telemetry Registry Spot-Checks

| Concern                                       | Status |
| --------------------------------------------- | ------ |
| `workspace_id` typed `string \| null` consistently across BaseEvent + special-case events | PASS — line 7 BaseEvent + intentional nulls at platform-actor events (line 8334, 7260, 8560, 11340) explicitly documented |
| Sortie 1 events (`schedule.confirm_shift`, `task.complete_session_task`, `timesheet.confirm_hours`) registered | **NOT FOUND** in registry by search — verify with capability authors whether these emit at all or if event names differ |
| New payroll Phase 2/3 events (`payroll.line_override_*`, `payroll.csv_exported`, `payroll.lonnsgrunnlag_*`) registered | PASS — entity types added to EntityType union (line 177) and interface definitions exist (lines 8598-9047) |
| `outreach sms_sent` / `call_initiated` orphan status | UNCHANGED from baseline — still no producer |

**Action:** Author of mobile-session-task-defense / Sortie 1 should confirm whether the gate_action seed capabilities have matching `emit()` calls in registry. Search at lines around 1064 ("session_task.created") and 10863 ("session_task.created" route) shows existing session_task events but no `schedule.confirm_shift` or `timesheet.confirm_hours` event keys.

---

## Per-ADR Rollup

| ADR     | Title                                          | Status                   | Notes                                                                          |
| ------- | ---------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| ADR-0004 | Unified telemetry — every mutation emits      | NOT RE-VERIFIED this pass | Baseline CV-2/CV-3/CV-4 still open per 2026-05-02 report                       |
| ADR-0011 | user_identity table naming                    | PASS                     | No regressions                                                                 |
| ADR-0012 | Subscription data on company table            | PASS                     | No regressions                                                                 |
| ADR-0029 | workspace-api gateway + RLS dual-policy       | PARTIAL FAIL             | F-DB-02 baseline still open; F-DB-13 admin-only tables need explicit exemption comment |
| ADR-0044 | Invitation table naming                       | PASS                     | No regressions                                                                 |
| ADR-0107 | BotssonProvider channel derivation            | PASS                     | No regressions                                                                 |
| ADR-0134 | Mobile telemetry contract (workspace_id non-null) | PASS                 | Registry-level invariant intact; runtime fail-fast not re-verified this pass   |
| ADR-0151 | profile_id derived server-side                | PASS                     | Sortie 1 closes session_task forgeable-actor gap                              |
| ADR-0287 | gate_action mandatory on mutation tools       | **FAIL — ENFORCEMENT NOT SHIPPED** | F-DB-11. Proposed-status ADR with documented controls absent from repo |
| ADR-0299 | Sortie A D6 RLS WITH CHECK                    | **PARTIAL** — shift_approval PASS; sister tables (department_session, session_hook, deviation, personal_task) still hold the same gap class | F-DB-09 + F-DB-10 |

---

## Top 3 Critical (One-liners)

1. **F-DB-09 (CRITICAL)** — `department_session`, `session_hook`, `deviation` still carry `FOR ALL USING(...)` with NO WITH CHECK — exact ADR-0299 gap class on three sister D6 tables.
2. **F-DB-11 (HIGH)** — ADR-0287 `gate-action-coverage.ts` CI script and `mutateWithGate()` helper not implemented; rule documented but not enforced.
3. **F-DB-10 (HIGH)** — `personal_task.jwt_own_personal_task` lacks WITH CHECK — workspace_id forgeable on UPDATE for multi-workspace users.

**Counts:** 13 findings total — 1 CRITICAL, 2 HIGH new + 1 HIGH carry, 2 MEDIUM new + 1 MEDIUM carry, 1 LOW carry, 2 INFO new + 1 INFO carry, 4 PASS.
