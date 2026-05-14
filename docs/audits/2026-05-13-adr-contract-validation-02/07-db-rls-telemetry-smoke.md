---
title: DB/RLS/Telemetry — Smoke Audit Slice 07 (post-wave-1)
status: done
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, smoke, db-rls-telemetry]
---

## Wave-1 closure verification (F-DB-09 + F-DB-10)

Migration `supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql` (18.6 KB, 374 lines) verified at expected path. Mirror of Sortie A pattern (`20260605120000_shift_approval_rls_with_check.sql`). 4 pgTAP test files present at `supabase/tests/rls/sortie_a2_*.sql` (749 LOC total), all containing both `throws_ok` (forge-reject) and `lives_ok` (happy-path) assertions.

Static text scan of migration:

| Table | Legacy `FOR ALL` dropped | Per-verb policies w/ WITH CHECK | Role gate | Verdict |
|---|---|---|---|---|
| `department_session` | `jwt_manage_department_session` (line 62) | INSERT (67), UPDATE (86, symmetric USING+WITH CHECK), DELETE (114) | admin/owner | **PASS** |
| `session_hook` | `jwt_manage_session_hook` (line 133) | INSERT (138), UPDATE (155, symmetric), DELETE (182) | admin/owner | **PASS** |
| `deviation` | `jwt_manage_deviation` (line 206) | INSERT (211), UPDATE (229, symmetric), DELETE (256) | admin/owner/**manager** (council T4 widening, doc'd line 198-203) | **PASS** |
| `personal_task` | `jwt_own_personal_task` (line 288) | SELECT (297, new explicit policy), INSERT (311), UPDATE (332, symmetric), DELETE (357) | profile-owner only (single `EXISTS` join pins `profile_id` + `workspace_id` together — blocks multi-workspace forgery) | **PASS** |

All 4 legacy `FOR ALL` policies dropped (4 `DROP POLICY IF EXISTS` statements for the targets at lines 62, 133, 206, 288). 13 new per-verb policies created (4 + 3 + 3 + 3 — `personal_task` adds a fourth because the prior FOR ALL collapsed SELECT into the same policy). Symmetric `USING + WITH CHECK` confirmed on every UPDATE policy. `service_role_*` and `api_key_read_*` policies left untouched on all 4 tables (preserves stage-engine `ctx.supabaseAdmin` write path, ADR-0287 gates upstream).

**F-DB-09 verdict: PASS (3/3 tables — department_session, session_hook, deviation).**
**F-DB-10 verdict: PASS (1/1 table — personal_task).**

## Baseline F-DB-11 status check (ADR-0287 enforcement)

**Update 2026-05-13 (post-sortie B-W2.1):** F-DB-11 **CLOSED**. The three documented controls shipped:

- `scripts/gate-action-coverage.ts` — brace-parses `defineTool({...})` blocks across `packages/ai/src/capabilities/<cap>/tools.ts`, flags mutations without recognised gate-helper calls. `--baseline` + `--strict` modes; exemption via `// @gate-action-exempt: ADR-NNNN reason`.
- `packages/ai/src/capabilities/_shared/mutate-with-gate.ts` — ergonomic typed wrapper around `gatedMutation()` with L-0177 fail-fast guards + `gate_evaluated` emit + typed deny exceptions.
- `.github/workflows/gate-action-coverage.yml` — PR trigger on `packages/ai/src/capabilities/**` runs `--baseline`.

Baseline scan result: **43 passing | 0 violating | 0 exempt | 89 read-only** across 28 capability namespaces. ADR-0287 promoted `proposed → accepted` (frontmatter `updated: 2026-05-13`, body §"2026-05-13 — Enforcement shipped" appended).

The earlier "ADR-0204 backlog" cited by F-DB-11 has already drained — every existing mutation tool calls one of `mutateWithGate`, `gatedMutation`, `callGateAction`, `gateMutation` (contract), `gateTaskAction` (task), or `gatePayrollAction` (payroll). Strict-mode flip unblocked; gated separately to give downstream campaigns one release cycle to absorb the helper-naming convention.

**F-DB-11 verdict (final): CLOSED (was HIGH).** Closure sortie: `feat/audit-fdb11-adr-0287-enforcement`.

## Recent migration scan (regression of ADR-0303 sister-sweep rule)

Scanned 7-day window (2026-05-06 → 2026-05-13, 18 migrations). Three migrations contain `FOR ALL`:

1. `20260605120000_shift_approval_rls_with_check.sql` — Sortie A. Uses `FOR ALL` only inside `DROP POLICY IF EXISTS` cleanup; CREATE statements are all per-verb with WITH CHECK. CLEAN.
2. `20260608120000_sortie_a2_d6_rls_with_check.sql` — Sortie A.2 itself. Same shape as #1. CLEAN.
3. `20260604000001_staff_event.sql` — **REGRESSION**. Two new `FOR ALL USING(...)` policies created on workspace-scoped tables:
   - `jwt_write_staff_event` ON `public.staff_event` FOR ALL USING(workspace_id + role gate) — **no WITH CHECK** (line 87-98).
   - `jwt_write_staff_event_attendee` ON `public.staff_event_attendee` FOR ALL USING(EXISTS join + role gate) — **no WITH CHECK** (line 124-135).

Same gap class as pre-Sortie-A.2 `jwt_manage_department_session`. A manager who is a member of two workspaces can flip `workspace_id` on UPDATE (or set on INSERT) to a workspace they also manage. The `EXISTS` join on `staff_event_attendee` derives `workspace_id` from the parent row, which softens the attendee case slightly — but still no symmetric WITH CHECK, so INSERT can attach an attendee to an event regardless of profile workspace if the role-gate join is satisfied.

This migration was created 2026-05-13 (same day as Sortie A.2). The author was not following ADR-0303 sister-sweep rule (which Sortie A.2 itself codifies). **NEW finding: F-DB-12 (HIGH)** — `staff_event` + `staff_event_attendee` need the same FOR ALL → per-verb + WITH CHECK conversion. Same fix pattern as Sortie A.2. Adds a sister-sweep test that should catch this class going forward.

No other regressions in the 18-migration window.

## New findings

| ID | Severity | Title | Evidence |
|---|---|---|---|
| F-DB-12 | HIGH | `staff_event` + `staff_event_attendee` ship with `FOR ALL USING(...)` no WITH CHECK | `20260604000001_staff_event.sql` lines 87-98, 124-135 — CLOSED 2026-05-13 by feat/audit-fdb12-staff-event-rls |

NEW CRITICAL: 0
NEW HIGH: 1

## Summary: **FAIL**

Slice 07 fails the post-wave-1 zero-new-finding criterion. F-DB-09 + F-DB-10 closure itself is **clean across all 4 tables** (the wave-1 sortie did its job correctly, pgTAP coverage present), and ADR-0303 captures the rule in writing. But the **rule has already regressed inside the same 7-day window**: `staff_event` migration shipped the exact same FOR ALL no-WITH-CHECK shape on two workspace-scoped tables on the same day Sortie A.2 landed.

This is the load-bearing signal: writing the rule is not enforcing the rule. A migration lint (grep `FOR ALL` + assert WITH CHECK on workspace-scoped tables in CI) would have caught `staff_event` at PR review. Recommend pairing F-DB-12 closure with a lint task (call it F-CI-0X, separate slice).

F-DB-11 (ADR-0287 coverage script) **CLOSED 2026-05-13** via sortie B-W2.1 (see "Baseline F-DB-11 status check" above).
