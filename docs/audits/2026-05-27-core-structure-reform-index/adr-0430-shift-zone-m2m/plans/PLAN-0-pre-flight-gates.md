---
title: "PLAN-0 — Pre-flight gates (CF + ADR-0430 §Pre-sortie conditions)"
sortie: adr-0430-shift-zone-m2m
plan: 0
tier: T3
phase: pre-flight
created: 2026-05-28
status: pending
depends_on: []
blocks: [PLAN-1, PLAN-2, PLAN-3, PLAN-4]
estimated_effort_hours: 4-6
---

# PLAN-0 — Pre-flight gates

## Purpose

Close all 4 CF (Council Conditional Fixes from Phase 5 verdict) and all 4 ADR-0430 §Implementation Sequence §Pre-sortie gates BEFORE any migration ships. PLAN-0 is doc/script output only — no production code, no production schema.

## Scope

| Gate | ADR-0430 ref | Activity |
|------|--------------|----------|
| CF-1 | §Council CF | Verify `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` flag state in dev/preview/prod |
| CF-2 | §Council CF | Confirm `ShiftAddedManual` + `ShiftCreated` typing strategy (`zone_ids?: string[]` optional) |
| CF-3 | §Council CF | Template payload Zod schema migration plan (`payload.zone TEXT → payload.zone_ids string[]`) |
| Pre-1 | §Implementation Sequence | Timestamp collision check — verify no in-flight feat/* branch claims `>20260801000000` slots ADR-0427 |
| Pre-2 | §Implementation Sequence | Re-verify `shift_session_day_line` composite PK from migration `20260620120400` |
| Pre-3 | §Implementation Sequence M0.5 | Generate position-orphan reconciliation report (SQL) |
| Pre-4 | §Implementation Sequence M3-prep | Operationalize "default zone per location" definition (lowest sort_order tie-break) |
| Pre-5 | §Implementation Sequence M3.5-prep | pg_depend audit of `schedule_shift.location_id` + `.zone` references; document `ensure_shift_session` trigger rewrite plan |
| Pre-6 | Rule 9 | Verify `engine_authority_config.channel_constraint` column exists (channel pinning enforceable) |
| Pre-7 | Rule 1 | Verify UNIQUE constraint exists on `zone(id, location_id)` AND `day_line(id, location_id)` (composite FK prerequisites) |

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-0.1 | CF-1 flag-state report | Document the flag state in `pre-flight-report.md` for dev / preview / prod (3 rows). Each row: `ENABLED` or `DISABLED` with source-of-truth (env-var manifest path). No "unknown" entries permitted. |
| AC-0.2 | CF-2 typing strategy | `pre-flight-report.md` includes a code snippet showing the proposed `ShiftAddedManual.properties.data.zone_ids?: string[]` TS-interface diff. Decision documented: optional `?:` (not required) so existing call-sites compile. |
| AC-0.3 | CF-3 Zod migration plan | `pre-flight-report.md` lists every template-payload Zod schema (`packages/ai/src/capabilities/timeline-template/schemas.ts` candidate path). For each: before-shape (`zone: z.string()`) → after-shape (`zone_ids: z.array(z.string().uuid())`). |
| AC-0.4 | Pre-1 collision check | `git branch -r | grep "feat/"` cross-checked against migrations folder of each remote branch. Report: 0 conflicting timestamps in `>20260801000000` slots. If conflict found, this AC FAILS and PLAN-0 cannot close. |
| AC-0.5 | Pre-2 composite PK | `psql` query `SELECT conname FROM pg_constraint WHERE conrelid = 'shift_session_day_line'::regclass AND contype = 'p'` returns 1 row with column tuple `(shift_session_id, day_line_id)`. |
| AC-0.6 | Pre-3 M0.5 orphan report | SQL `SELECT s.id, s.position_id FROM schedule_shift s LEFT JOIN position p ON s.position_id = p.id WHERE s.department_id IS NULL AND s.position_id IS NOT NULL AND p.department_id IS NULL` produces 0 rows OR a triage CSV is committed. If non-zero, PLAN-1 M1 is BLOCKED until reconciled. |
| AC-0.7 | Pre-4 default-zone | `pre-flight-report.md` codifies: "default zone per location = single `zone` row with lowest `sort_order` per `(workspace_id, location_id)`. If multiple zones tied on `sort_order`, SKIP backfill (log SKIPPED). If no zones for location, SKIP silently." PLAN-1 M3 backfill SQL must implement this exact rule. |
| AC-0.8 | Pre-5 pg_depend audit | `SELECT ... FROM pg_depend WHERE refobjid = 'schedule_shift'::regclass::oid AND deptype = 'n'` output committed as `pg-depend-audit.txt`. Every row classified: (a) `ensure_shift_session` trigger to rewrite, (b) other-trigger to rewrite, (c) view to rewrite, (d) policy to rewrite, (e) safe-no-action. Each (a)-(d) gets a rewrite plan documented in PLAN-4. |
| AC-0.9 | Pre-6 channel_constraint | `psql` query `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_authority_config' AND column_name = 'channel_constraint'` returns 1 row. If 0 rows → Rule 9 is NOT enforceable; PLAN-0 cannot close until a separate migration adds the column (note: this becomes a blocker; flag immediately to Pontus). |
| AC-0.10 | Pre-7 UNIQUE constraints | `psql` query for `pg_indexes` on `zone` AND `day_line` returns at least one unique index covering `(id, location_id)`. If absent, M2 composite FK in PLAN-1 will fail; add UNIQUE constraint migration to PLAN-1 M2 (additive). |

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| AC-0.6 reveals position-orphans (department_id missing on `position` rows feeding shifts) | HIGH — blocks M1 | Triage script: assign department_id manually OR drop orphan shifts. Document each manual assignment. |
| AC-0.8 reveals unknown triggers/views referencing `schedule_shift.location_id` | HIGH — blocks M4 | Each unknown gets a rewrite plan in PLAN-4. If trigger references `.zone` column via dynamic SQL, may need refactor before M4. |
| AC-0.9 reveals `channel_constraint` column missing | BLOCKER | Stop. Surface to Pontus. Rule 9 is not enforceable without this column; either: (a) add column in PLAN-0 schema-precondition migration, OR (b) defer Rule 9 enforcement to a follow-up ADR. |
| AC-0.10 reveals UNIQUE constraints missing on `zone(id, location_id)` or `day_line(id, location_id)` | MEDIUM — adds work to PLAN-1 M2 | Append `CREATE UNIQUE INDEX CONCURRENTLY ... ` to PLAN-1 M2 migration; idempotent if already present. |

## Dependencies

None. PLAN-0 is the entry point.

## Files to touch

- **Create:** `docs/domains/scheduling/adr-0430-shift-zone-m2m/pre-flight-report.md` (CF-1, CF-2, CF-3, Pre-4 codified rules)
- **Create:** `docs/domains/scheduling/adr-0430-shift-zone-m2m/pg-depend-audit.txt` (Pre-5 raw output)
- **Create:** `docs/domains/scheduling/adr-0430-shift-zone-m2m/m0.5-position-orphan-report.{md,csv}` (Pre-3)
- **Create:** `docs/domains/scheduling/adr-0430-shift-zone-m2m/schema-precondition-checks.sql` (executable queries for AC-0.5, AC-0.7, AC-0.9, AC-0.10)
- **Read-only:** ADR-0430, audit INDEX, current `supabase/migrations/`, `git branch -r`

## Validation gate (must pass before PLAN-1 ships)

All 10 ACs PASS. Pontus sign-off on `pre-flight-report.md` recommended (not mandatory per SDSM v2 council-vetted-auto, but high-stakes schema reform).

## Notes

- PLAN-0 outputs are **read-only artefakter** + a single executable SQL file. No production schema mutations. No application code touched.
- M0.5 SQL must run against PRODUCTION (or a recent prod snapshot) to be valid; running against local-empty DB gives false negative.
- If CF-1 reveals flag is currently DISABLED in prod, document — does not block (zone reform is independent of composition orchestrator), but Phase b must verify no downstream behavior expects the flag.
