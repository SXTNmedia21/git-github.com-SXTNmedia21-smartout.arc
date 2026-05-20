---
title: "Audit Slice 07 — DB RLS + Telemetry (2026-05-15)"
status: done
updated: 2026-05-15
created: 2026-05-15
module: platform
tags:
  [
    audit,
    database,
    rls,
    telemetry,
    adr-0004,
    adr-0011,
    adr-0012,
    adr-0029,
    adr-0044,
    adr-0107,
    adr-0151,
    adr-0287,
    adr-0296,
    adr-0299,
  ]
---

# Audit Slice 07 — DB RLS + Telemetry

**Repo:** development HEAD (2026-05-15)
**Baseline:** 2026-05-13 audit (`docs/audits/2026-05-13-adr-contract-validation/07-db-rls-telemetry.md`)
**ADR cluster:** 0004, 0011, 0012, 0029, 0044, 0107, 0151, 0287, 0296, 0299
**Surfaces audited:**
- `supabase/migrations/` — all migrations, focus on D6 sister tables, new tables since 2026-05-13
- `packages/telemetry/src/registry.ts` (12 986 lines)
- `packages/supabase/src/database.types.ts` (775 KB, last modified 2026-05-14)
- `services/stage-engine/src/routes/agent/chat.ts` — ADR-0151 profile_id derivation

---

## Summary

| # | ID | Severity | One-line summary |
|---|---|---|---|
| 1 | F-DB-09 | **CLOSED** | Sortie A.2 migration `20260608120000` closes all 4 sister D6 tables — PASS |
| 2 | F-DB-10 | **CLOSED** | `personal_task` per-verb split with WITH CHECK shipped in Sortie A.2 — PASS |
| 3 | F-DB-11 | **CLOSED** | ADR-0287 enforcement shipped: `mutateWithGate()`, `scripts/gate-action-coverage.ts`, CI workflow — PASS |
| 4 | F-WH-04 | **CLOSED** | `call_log.call_session_id` UNIQUE constraint added via `20260611100000` — PASS |
| 5 | F-DB-12-NEW | HIGH | `staff_event` + `staff_event_attendee` previously had FOR ALL (F-DB-12 in 2026-05-13-02 smoke). Closed by `20260609120000` — PASS |
| 6 | F-DB-20 | MEDIUM | `engine_sessions` + `engine_inbox` retain `workspace_isolation_*` FOR ALL USING without WITH CHECK — JWT INSERT/UPDATE forgery class open |
| 7 | F-DB-21 | MEDIUM | Governance content tables in `00004_rls_policies.sql` (policy, protocol, procedure, team_member, etc.) carry `FOR ALL USING(is_admin_in_workspace)` without WITH CHECK — 14 tables |
| 8 | F-DB-22 | MEDIUM | `engine_authority_config.admin_manage_authority` is `FOR ALL USING(...)` with no WITH CHECK — C4 governance table |
| 9 | F-DB-23 | LOW | `season_budget`, `day_factor`, `hour_factor` (D4) carry `jwt_write_*` as `FOR ALL USING(is_admin_in_workspace)` with no WITH CHECK |
| 10 | F-TL-01 | INFO | `outreach sms_sent` / `call_initiated` still no producer — carry from baseline |
| 11 | F-TL-02 | INFO | `database.types.ts` has no auto-generation header comment; no manual edits detected |
| 12 | F-DB-01 | INFO (carry) | `engine_world_observe_platform` GRANT baseline — not re-verified this pass |

---

## Findings

### F-DB-09/10/11 — CLOSED (Sortie A.2 + ADR-0287 enforcement)

**Migration:** `supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql`

All four D6 sister tables now have correct per-verb split with symmetric USING + WITH CHECK:

| Table | Pre-state | Post-state | Verdict |
|---|---|---|---|
| `department_session` | `jwt_manage_department_session` FOR ALL — no WITH CHECK | 3 per-verb policies (INSERT/UPDATE/DELETE), admin/owner, symmetric WITH CHECK | **PASS** |
| `session_hook` | `jwt_manage_session_hook` FOR ALL — no WITH CHECK | 3 per-verb policies, admin/owner, symmetric WITH CHECK | **PASS** |
| `deviation` | `jwt_manage_deviation` FOR ALL — any member, no role gate, no WITH CHECK | 3 per-verb policies, manager+ role gate, symmetric WITH CHECK | **PASS** |
| `personal_task` | `jwt_own_personal_task` FOR ALL — no WITH CHECK | 4 per-verb policies (SELECT/INSERT/UPDATE/DELETE), owner-only, WITH CHECK pins profile_id + workspace_id via EXISTS join | **PASS** |

ADR-0287 enforcement also confirmed shipped:
- `packages/ai/src/capabilities/_shared/mutate-with-gate.ts` — typed wrapper with L-0177 fail-fast guards
- `scripts/gate-action-coverage.ts` — AST CI lint (baseline mode: 43 passing, 0 violating)
- `.github/workflows/gate-action-coverage.yml` — wired into CI

**CLOSED. No action required.**

### F-DB-12-NEW — CLOSED (Sortie A.3)

**Migration:** `supabase/migrations/20260609120000_audit_fdb12_staff_event_rls_with_check.sql`

`staff_event` and `staff_event_attendee` previously carried `jwt_write_*` as `FOR ALL USING(...)` without WITH CHECK (F-DB-12 from 2026-05-13-02 smoke audit). Sortie A.3 applied per-verb split with manager+/admin/owner role gate and symmetric WITH CHECK. `staff_event_attendee` uses EXISTS join through parent `staff_event` for workspace scoping (no direct `workspace_id` column). **PASS.**

### F-WH-04 — CLOSED

**Migration:** `supabase/migrations/20260611100000_call_log_unique_session.sql`

`call_log.call_session_id` now has `UNIQUE` constraint (`call_log_call_session_id_key`). Pre-migration dedup guard (DELETE by min-id) makes migration safe on production. **PASS.**

---

### F-DB-20 — MEDIUM: engine_sessions + engine_inbox FOR ALL USING without WITH CHECK

**File:** `supabase/migrations/20260301200000_engine_tables.sql:135-136, 174-175`

```sql
CREATE POLICY "workspace_isolation_sessions" ON engine_sessions
FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.profile WHERE user_id = auth.uid() ...)
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
-- same shape on engine_inbox
```

Both policies use `FOR ALL USING(...)` with no `WITH CHECK`. A JWT caller who belongs to two workspaces could INSERT a session or inbox row with a forged `workspace_id`. In practice, `engine_sessions` writes come from stage-engine via service_role (which bypasses JWT RLS), and the `FOR ALL` service_role policy (`workspace_isolation_sessions` is NOT service-role-only — it is JWT path). The risk is the dual-AND branch: if a user JWT has access to two workspaces via the GUC `app.workspace_id` fallback, the INSERT CHECK is absent.

**However:** `engine_sessions` channel is constrained to `('voice', 'sms', 'chat', 'email', 'autonomous')` via CHECK — no `'mobile'` or device-label risk (ADR-0107 compliant). The forgery class is workspace-boundary, not channel. Mitigation: `engine_sessions` has no active JWT-path writers today (stage-engine always uses service_role). Risk is deferred JWT path.

**Recommendation:** Per ADR-0303 sister-sweep mandate, split `workspace_isolation_sessions` and `workspace_isolation_inbox` into per-verb with WITH CHECK. Low urgency (no JWT writer today) but aligns with the rule.

**Severity: MEDIUM** — structural gap class but no active JWT writer.

---

### F-DB-21 — MEDIUM: 14 governance content tables carry FOR ALL without WITH CHECK

**File:** `supabase/migrations/00004_rls_policies.sql:79-175`

Tables affected: `department`, `location`, `zone`, `asset`, `position`, `team`, `season`, `policy`, `protocol`, `team_member`, `procedure`, `procedure_step`, `control_list`, `routine`, `runbook`, `runbook_step`, `knowledge_test`, `confirmation`, `protocol_assignment`

All carry `FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id))` with no `WITH CHECK`. This is the foundational `00004` migration — D1 envelope + governance content layer. The `is_admin_in_workspace()` helper gates the row's existing workspace on SELECT, but an INSERT/UPDATE could supply a different `workspace_id` in the body.

**Context:** These are content-layer tables (policy, protocol, etc.), not D6 production tables. Admin-only write path reduces practical risk. The `check-rls-with-check.ts` CI script scans these if they are in its allow-list — not confirmed whether `00004` tables are enumerated.

**Recommendation:** Add these tables to the `check-rls-with-check.ts` allow-list; then either add WITH CHECK or add `-- @rls-exempt: ADR-NNNN` override with justification (admin-only SECURITY DEFINER RPCs only). A bulk patch migration following the A.2 pattern is the clean fix.

**Severity: MEDIUM** — large surface, but content-layer admin-only, lower operational risk than D6.

---

### F-DB-22 — MEDIUM: engine_authority_config FOR ALL USING without WITH CHECK

**File:** `supabase/migrations/20260302000100_engine_authority_config.sql:21-28`

```sql
CREATE POLICY "admin_manage_authority" ON engine_authority_config
FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.profile
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner'))
);
```

C4 governance table — `engine_authority_config` controls `gate_action` outcomes per capability per workspace. The `FOR ALL` policy carries no `WITH CHECK`, meaning a multi-workspace admin could flip `workspace_id` on INSERT to configure capabilities in a colleague workspace. This has a direct security impact: the capability authority configuration of workspace B could be set by an admin of workspace A if they also hold an admin role in workspace B.

**Recommendation:** Per-verb split with symmetric WITH CHECK matching USING. Priority slightly higher than F-DB-21 because the table governs C4 authority decisions.

**Severity: MEDIUM** (MEDIUM-HIGH by impact, but multi-workspace admin scenario is rare).

---

### F-DB-23 — LOW: D4 planning tables FOR ALL without WITH CHECK

**File:** `supabase/migrations/20260306100000_season_planning_tables.sql:63-64, 109-110, 154-155`

`season_budget`, `day_factor`, `hour_factor` carry `jwt_write_* FOR ALL USING(is_admin_in_workspace)` with no `WITH CHECK`. D4 dimension — planning factors and budgets. Lower risk than D6 production tables (no live operational impact from a forged workspace write here). Same structural class as F-DB-21.

**Severity: LOW** — content/planning layer, admin-only.

---

### F-TL-01 — INFO (carry): outreach capability registry orphans

Registry entries `outreach sms_sent` and `outreach call_initiated` (lines ~8538, 8549) still have no confirmed code producer. `packages/ai/src/capabilities/outreach/` directory not present. Carry from 2026-05-13 baseline.

**Action:** Next audit or outreach capability author should either ship the producer or remove the registry entries. Orphan registry entries generate no runtime error but violate ADR-0004's "single registry" contract (entries exist without the "One Registry" side being the single truth).

---

### F-TL-02 — INFO: database.types.ts no auto-generation marker

`packages/supabase/src/database.types.ts` (775 KB, last modified 2026-05-14) has no `@generated` or `// This file was auto-generated` header comment. No manual edits detected (consistent machine-generated structure). File was modified 2026-05-14, consistent with a regen after recent migrations.

**Risk:** Without a generation marker, a future author editing manually cannot be caught at review time. Convention (CLAUDE.md) says "never edit manually — regenerate." Marker adds enforcement signal.

**Recommendation:** Add `// This file is auto-generated by supabase gen types. DO NOT EDIT.` header in the regen script output, or add a CI check.

---

## Per-ADR Rollup

| ADR | Title | Status | Notes |
|---|---|---|---|
| ADR-0004 | Unified telemetry — every mutation emits | PARTIAL | Registry structure intact. F-TL-01 orphan entries persist. CV-2/CV-3/CV-4 from 2026-05-02 not re-verified. |
| ADR-0011 | user_identity table naming | PASS | No regressions. |
| ADR-0012 | Subscription data on company table | PASS | No regressions. |
| ADR-0029 | Workspace-api gateway + dual RLS policy | PARTIAL | Carry: tables lacking `api_key_read_*` policies. F-DB-21 tables (00004) not covered. |
| ADR-0044 | Invitation table naming | PASS | No regressions. |
| ADR-0107 | BotssonProvider channel derivation | PASS | `engine_sessions.channel` CHECK constraint enforces valid `SessionChannel` values. No `'mobile'` string in DB. |
| ADR-0151 | profile_id derived server-side | PASS | `services/stage-engine/src/routes/agent/chat.ts` confirmed: `profile_id` removed from schema (line 68 comment), `deriveProfileId` helper imported (line 24), voice-path parses from session_id convention with DB verify (lines 337-369). |
| ADR-0287 | gate_action mandatory on mutation tools | **PASS** | `mutateWithGate()`, CI lint, GH Actions workflow shipped. Baseline 43/0/89. |
| ADR-0296 | emma_conversation deprecation | PASS | Migration `20260529000000` drops `emma_conversation` + `emma_transcript`. No references in current codebase. |
| ADR-0299 | Sortie A D6 RLS WITH CHECK hardening | **PASS** | Sortie A.2 + A.3 close all identified sister tables. New gap class (F-DB-20 engine_sessions) is MEDIUM, not same severity as D6 production tables. |

---

## Verified Intentional

| Table | Policy shape | Reason verified |
|---|---|---|
| `engine_missions` + `engine_stages` | `FOR ALL USING (auth.role() = 'service_role')` | Platform-only writes by design — no JWT mutation path |
| `journey`, `journey_step`, `journey_event`, `journey_test_run` | `godmode_*` FOR ALL (godmode check) | Platform admin surface — intentional; workspace read policies separate |
| `shift_hour_interpretation` | `service_role_interpretation` FOR ALL | Derivation-layer table — service_role only |
| `activity_trail actor_kind='platform'` | Nullable workspace_id/actor_id/entity_id | ADR-0290 `20260527000000_activity_trail_platform_actor.sql` adds conditional CHECK: `actor_kind='user' → NOT NULL; actor_kind='platform' → nullable` |

---

## In Progress

- ADR-0303 sister-sweep enforcement (`check-rls-with-check.ts`) exists but allow-list scope needs verification against F-DB-21 (00004 tables). If `00004` tables are in the allow-list, F-DB-21 becomes a CI failure on next PR touching those files.
- `scripts/gate-action-coverage.ts` running in `--baseline` mode (warn-only). Strict-mode flip deferred per ADR-0287 §2026-05-13.

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---|---|---|---|
| F-DB-09 (CRITICAL — D6 sisters) | OPEN | **CLOSED** | Sortie A.2 `20260608120000` |
| F-DB-10 (HIGH — personal_task) | OPEN | **CLOSED** | Sortie A.2 `20260608120000` |
| F-DB-11 (HIGH — ADR-0287) | OPEN | **CLOSED** | Helper + CI + workflow shipped |
| F-DB-12 (HIGH — staff_event) | OPEN (from smoke-02) | **CLOSED** | Sortie A.3 `20260609120000` |
| F-WH-04 (HIGH — call_log UNIQUE) | OPEN | **CLOSED** | `20260611100000` |
| F-DB-20 (NEW MEDIUM — engine_sessions) | NOT PRESENT | **OPEN** | Newly identified |
| F-DB-21 (NEW MEDIUM — 00004 content tables) | NOT PRESENT | **OPEN** | Newly identified (structural carry) |
| F-DB-22 (NEW MEDIUM — engine_authority_config) | NOT PRESENT | **OPEN** | Newly identified |
| F-DB-23 (NEW LOW — D4 planning tables) | NOT PRESENT | **OPEN** | Newly identified (structural carry) |
| F-TL-01 (INFO — outreach orphan) | OPEN | OPEN | No change |

**Net delta:** 5 findings CLOSED (1 CRITICAL, 3 HIGH, 1 HIGH-WH). 4 new findings OPEN (0 CRITICAL, 3 MEDIUM, 1 LOW). Risk posture significantly improved.

**Severity counts (2026-05-15):** 0 CRITICAL | 0 HIGH | 3 MEDIUM | 1 LOW | 2 INFO
