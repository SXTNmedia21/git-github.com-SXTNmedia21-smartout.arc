---
title: "Audit Slice 07 — DB / RLS / Telemetry"
status: done
updated: 2026-05-16
created: 2026-05-16
module: audit
tags: [audit, rls, telemetry, database, adr-0004, adr-0011, adr-0012, adr-0044, adr-0151]
---

# Slice 07 — DB / RLS / Telemetry
**Audit run:** 2026-05-16-adr-contract-validation (smoke)
**Specialist:** db-rls-telemetry
**ADRs in scope:** ADR-0004, ADR-0011, ADR-0012, ADR-0029, ADR-0044, ADR-0107, ADR-0151

---

## Summary

**0 CRITICAL · 0 HIGH · 0 MEDIUM · 0 LOW · 0 INFO**

All freshly-landed migrations and telemetry additions are **COMPLIANT**. The ADR-0012 WITH CHECK sweep (F-DB-14/20/21/22) that was flagged in the 2026-05-15 audit run has been fully remediated by four migrations shipped 2026-05-16.

---

## New Tables Since 2026-05-15 Baseline

| New table | workspace_id? | RLS enabled? | Policies (SELECT / INSERT WITH CHECK / UPDATE WITH CHECK) | Verdict |
|---|---|---|---|---|
| `public.timeline_template` | YES — `NOT NULL REFERENCES workspace(workspace_id)` (migration:31) | YES — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (migration:71) | SELECT `jwt_select_timeline_template` USING workspace membership (migration:74–78); INSERT `jwt_insert_timeline_template` WITH CHECK workspace + role + created_by=uid (migration:89–95); UPDATE `jwt_update_timeline_template` USING workspace+creator/admin, WITH CHECK workspace (migration:100–111); no DELETE policy (intentional soft-delete only, documented) | PASS |

**ADR-0004 (workspace_id required):** `timeline_template.workspace_id` is `NOT NULL` with FK constraint. `supabase/migrations/20260616110000_timeline_template.sql:31`.

**ADR-0011 (RLS coverage):** RLS enabled at line 71. Three explicit JWT policies cover all access verbs intended for users. No uncovered mutating path.

**ADR-0012 (WITH CHECK on INSERT/UPDATE):** INSERT policy is `WITH CHECK`-only (correct for INSERT). UPDATE policy has both USING + WITH CHECK (migration:100–111). Full compliance.

**ADR-0151 (workspace scope on identity fields):** INSERT policy enforces `created_by = auth.uid()` in WITH CHECK (migration:94) — prevents impersonation. No unguarded identity field exposure.

---

## engine_authority_config Parity — ADR-0189

`supabase/migrations/20260616110100_seed_timeline_template_authority.sql`:

- **Part A (line 29–69):** Backfills all existing workspaces with `capability='timeline_template'`, `level='confirm'`, `min_role='admin'`, `requires_four_eyes=false`, `observer_escalation_hours=72`. Uses `ON CONFLICT (workspace_id, capability) DO NOTHING` — idempotent.
- **Part B (line 75–92):** Inserts `capability_default_registry` row so future workspaces auto-seed via trigger. `ON CONFLICT (capability) DO NOTHING` — idempotent.

ADR-0189 authority-seed-parity: **PASS**.

---

## Telemetry Registry — ADR-0044

5 new events declared for `timeline_template` capability.

| New event id | In SmartoutEvent union? | In EVENT_ROUTING? | Interface name pattern? | Verdict |
|---|---|---|---|---|
| `timeline_template.saved` | YES — `TimelineTemplateSaved` at registry.ts:8547,9809 | YES — registry.ts:13245, destinations `[posthog, logger, activity_trail, engine_event]` | Matches `{Domain}{Action}` PascalCase | PASS |
| `timeline_template.applied` | YES — `TimelineTemplateApplied` at registry.ts:8548,9821 | YES — registry.ts:13249, destinations `[posthog, logger, activity_trail, engine_event]` | PASS | PASS |
| `timeline_template.archived` | YES — `TimelineTemplateArchived` at registry.ts:8549,9833 | YES — registry.ts:13253, destinations `[posthog, logger, activity_trail, engine_event]` | PASS | PASS |
| `timeline_template.apply_failed` | YES — `TimelineTemplateApplyFailed` at registry.ts:8550,9842 | YES — registry.ts:13257, destinations `[posthog, logger, activity_trail]` — no engine_event per spec (partial-apply failure must NOT trigger D6 reactions, documented registry.ts:13243) | PASS | PASS |
| `timeline_template.listed` | YES — `TimelineTemplateListed` at registry.ts:8551,9854 | YES — registry.ts:13261, destinations `[logger]` only — read-path debug per spec (registry.ts:13244) | PASS | PASS |

No orphaned events. EVENT_ROUTING is a `Record<SmartoutEvent["event"], EventMeta>` (registry.ts:9866) — TypeScript exhaustiveness check ensures no event in the union can be missing from the map. ADR-0044: **PASS**.

---

## database.types.ts Spot-Check — ADR-0107

**`timeline_template`** Row/Insert/Update types present at `database.types.ts:19135–19197`. All 10 columns from the migration (`id`, `workspace_id`, `name`, `scope_type`, `scope_id`, `items_json`, `notes`, `created_by`, `created_at`, `updated_at`, `is_archived`) are represented with correct nullability. FK relationships to `workspace` and `profile` tables registered. Types in sync with migration.

**`session_note`** (0331/0332/0333 columns): `audience: Json | null`, `notify_at: string | null`, `delivered_at: string | null`, `deleted_at: string | null` all present in Row/Insert/Update at `database.types.ts:17294–17329`. In sync with `20260616100501_session_note_targeted_fanout.sql` which adds these four columns.

---

## Remediated Findings From Previous Audit

The following were flagged in 2026-05-15 slice 07 and are now closed:

- **F-DB-14** (LOW) — `tips_workspace_settings` UPDATE missing WITH CHECK: closed by `20260616100100_tips_workspace_settings_with_check.sql`.
- **F-DB-20** (MEDIUM) — `engine_sessions` / `engine_inbox` FOR ALL with no WITH CHECK: closed by `20260616100600_audit_fdb20_fdb22_engine_rls_with_check.sql` (per-verb policies with symmetric USING + WITH CHECK).
- **F-DB-21** (MEDIUM) — 19 governance content tables FOR ALL with no WITH CHECK: closed by `20260616100700_audit_fdb21_governance_content_rls_with_check.sql` (all 19 tables now have per-verb INSERT/UPDATE/DELETE with WITH CHECK).
- **F-DB-22** (MEDIUM) — `engine_authority_config` admin_manage_authority FOR ALL no WITH CHECK: closed in same migration as F-DB-20.

All four remediations follow the structural pattern established by ADR-0299 and the D6 sweep (`20260608120000_sortie_a2_d6_rls_with_check.sql`).

---

## No Blockers
