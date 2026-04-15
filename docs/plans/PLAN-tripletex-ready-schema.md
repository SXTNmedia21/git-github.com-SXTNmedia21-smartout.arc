---
title: "Plan — tripletex-ready-schema"
status: in_progress
updated: 2026-04-15
created: 2026-04-15
module: tripletex-migration
tags: [plan, tripletex, schema, migration, bubble]
---

# Plan — tripletex-ready-schema

> Branch: `feat/tripletex-ready-schema` | Worktree: wt-3 | Module: tripletex-migration | Started: 2026-04-15

## Goal

Extend v3 Supabase schema so we can (a) import Bubble workspaces lossless
via strike-mcp, and (b) sync employee + payroll data to Tripletex without
schema-imposed gaps.

## Context

Strike-mcp (separate repo, ~/dev/strike-mcp) is ready to migrate one Bubble
workspace (Wrightegaarden pilot: 135 profiles, 2 750 shifts, 5 434 time
records, 17 607 salary transactions, 18 swaprecords, 3 employee_types).
Two upstream gaps block the first cutover:

1. **v3 schema is missing tables/columns** that Bubble source data requires
   (employee_type taxonomy, employment_contract versioning, payroll archive,
   source='bubble_migration' discriminator).
2. **Tripletex integration requires fields v3 does not expose** (STYRK-08
   occupation code, employment_form, remuneration_type, working_hours_scheme,
   stable external_employee_number).

Council 2026-04-15 verdict rejected the first cutover until these gaps close.
This plan is the smartout.ai-side work. Strike-mcp-side fixes (ADR-0002
amendment, auto_align attestation gate, workspace-filtered discovery) landed
same day.

## Live Bubble findings (2026-04-15 — ground truth for seed data)

### `⏱️employee_type` — 3 rows in Wrightegaarden

Live inspection confirmed these rows map directly to Tripletex concepts:

| Title                            | `_employementCategory` | `Fixed salary?` | `max_hours_week` | `Accounting_Account_Code` |
|----------------------------------|------------------------|-----------------|------------------|---------------------------|
| Månedslønn                       | Full time              | true            | 37.5             | 2000                      |
| Timelønn sesongmedarbeider       | Temporary              | false           | 37.5             | 2001                      |
| Frivillig                        | (null)                 | false           | (null)           | (null)                    |

Derived Tripletex mapping:
- `_employementCategory: 'Full time' | 'Temporary'` → `employment_form: permanent | temporary`
- `Fixed salary?: true | false` → `remuneration_type: monthly | hourly`
- `max_hours_week: 37.5` → `fte_percentage` basis (37.5h = 100%)
- `Accounting_Account_Code: 2000/2001` → carries through to payroll_ledger_archive

**Frivillig (volunteer) gets both `employment_form = NULL` and
`remuneration_type = NULL`** — signaling "do not sync to Tripletex" at
integration time.

### `⏱️salary_transaction(salary_detail)` — 17 607 rows in Wrightegaarden

Sample analysis shows the ledger is roughly 50/50 base-workTime vs
supplement rows. Both must be preserved in `payroll_ledger_archive`.

100% of sampled rows have: Start time, Stop time, Hours, Date,
`a_melding_code`, `Accounting_Account_Code`, Related_Shift. This is the
**minimal a-melding dataset** — archive is directly Tripletex-sync-able.
49/100 carry a salary_type FK (supplements); the remaining ~51/100 are
base rows (no FK). `⏱️ _salaryCategory` is sparse — only populated for
supplements.

### `⏱️swaprecord` — 18 rows in Wrightegaarden, 14 PENDING

Status distribution from live sample:

- 14 `_marketStatus = 'Pending'`
- 2 `_marketStatus = 'Approved'`
- 1 `_marketStatus = 'Started'`
- 1 other

**Decision (approved 2026-04-15):** drop all 14 pending swaprecords at
migration time. v3 models swaps as `engine_process='shift_swap'` instances
(not tables); synthesizing engine_state rows at import would require brittle
state-machine knowledge and breaks strike-mcp's dry-run-only safety model.

Cutover notice: "All pending shift swaps must be re-initiated in v3 after
migration." Documented in HANDOFF.

## Tasks

### Phase 1 — Migration additions

- [ ] M1: create `public.employee_type` reference table + seed 3 rows from Wrightegaarden
  - Columns: `employee_type_id uuid PK`, `workspace_id uuid FK`, `title text`, `employment_form_derived text` (permanent/temporary/NULL), `fixed_salary boolean`, `max_hours_week numeric`, `accounting_account_code text`, `color_pallet text`, `max_vacation_days int`, `days_trial_period int`, `created_at`, `updated_at`
  - Seed the 3 Wrightegaarden rows verbatim (Månedslønn, Timelønn sesongmedarbeider, Frivillig) — strike-mcp transform resolves employee_type_id FK per employment_profile
- [ ] M2: extend `public.employment_contract` with Tripletex-required columns
  - `occupation_code text` (STYRK-08, 7-digit, nullable — validated at sync time, not here)
  - `employment_form text` with CHECK `IN ('permanent','temporary') OR IS NULL` (NULL = volunteer)
  - `remuneration_type text` with CHECK `IN ('monthly','hourly','commission') OR IS NULL` (NULL = unpaid/volunteer)
  - `working_hours_scheme text` (Tripletex lookup: dagtid/skift/turnus/…)
  - `fte_percentage numeric` (stillingsprosent)
  - `employee_type_id uuid REFERENCES public.employee_type`
- [ ] M3: add `public.employment_contract_detail` table (versioned contract state)
  - Tripletex expects append-only history per `effective_date`
  - Columns mirror M2 additions + `effective_date date NOT NULL`
  - Unique index `(employment_contract_id, effective_date)`
- [ ] M4: extend `public.profile` with `external_employee_number text` + `UNIQUE(workspace_id, external_employee_number) WHERE external_employee_number IS NOT NULL`
- [ ] M5: add `public.payroll_ledger_archive` table — receives 17 607 ⏱️salary_transaction rows
  - Columns: `payroll_ledger_id uuid PK`, `workspace_id uuid FK`, `schedule_shift_id uuid FK`, `profile_id uuid FK`, `department_id uuid FK`, `team_id uuid FK`, `transaction_date date`, `work_date date`, `start_time text`, `stop_time text`, `hours numeric`, `base_salary numeric`, `total_salary numeric`, `is_worktime boolean`, `salary_category text`, `salary_type_name text`, `a_melding_code text`, `accounting_account_code text`, `bubble_record_id text UNIQUE`, `source text DEFAULT 'bubble_migration'`, `raw_json jsonb`, `comment text`, `created_at`
  - RLS workspace-scoped read + admin-only write
  - NO updates post-insert (archive semantics — ADR-0083 enforces)
- [ ] M6: extend `public.schedule_shift` with `source_snapshot_json jsonb` (raw `shift.Json` fallback from Bubble)
- [ ] M7: add `source text DEFAULT 'operational'` column + CHECK (`'operational' | 'bubble_migration' | 'v3_engine'`) to: workspace, company, location, department, team, profile, employment_contract, employment_contract_detail, employee_type, schedule_shift, timesheet.time_entry, invitation (12 tables)
- [ ] M8: audit `engine_process` triggers for reconciliation + lifecycle; add `WHERE source != 'bubble_migration'` filter where applicable (per ADR-0081)
- [ ] M9: regenerate `packages/supabase/src/database.types.ts`

### Phase 2 — ADRs

ADR numbers TBD — verify next available in `docs/decisions/0000-decision-log.md` before authoring. The existing 0080-0082 are already taken; the strike-mcp-side plan references ADR-0080/0081/0082 which must be renumbered.

- [ ] ADR-XXXX: strike-mcp telemetry boundary (no emit(), no engine_event, no activity_trail; provenance via source column only)
- [ ] ADR-XXXX: `source` discriminator pattern across migration-targeted tables + engine_process trigger filters
- [ ] ADR-XXXX: migrated profile contract shell — zero-contract profile handling with `status='migration_incomplete'` + Tripletex-optional fields nullable + volunteer null-semantics
- [ ] ADR-XXXX: payroll_ledger_archive semantics — read-only historical ledger, Tripletex sync source, v3 framework engine writes new rows with `source='v3_engine'` into the operational payroll table (separate from archive)
- [ ] ADR-XXXX: employment_contract_detail versioning — append-only history semantics matching Tripletex EmploymentDetails

### Phase 3 — Verification

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] `database.types.ts` regenerated and committed
- [ ] Seed migration for employee_type verified against local Supabase
- [ ] RLS policies on all new tables (workspace-scoped read, admin-only write for archive tables)
- [ ] Smoke test: strike-mcp emits SQL against new schema; `preview_sql` shows no errors
- [ ] Smoke test: Wrightegaarden 17 607 salary_transaction rows → payroll_ledger_archive insert succeeds on local Supabase, row count matches, FK integrity holds

## Out of scope (explicit)

- Tripletex client/sync code itself (separate workstream; this is schema prep only)
- Strike-mcp code changes (already landed in separate repo)
- Bubble-side field mapping review (blocked on this plan's output + strike-mcp review_mapping.ts)
- Stripe/Komm/contract composition adjustments
- UI surface for new employment_contract fields
- Active swap migration (drop 14 pending per decision above — re-initiation in v3 required)

## Acceptance Criteria

- [ ] All 4 missing Tier 1 structures present: employee_type, payroll_ledger_archive, schedule_shift.source_snapshot_json, source column on 12 tables
- [ ] All 6 Tripletex-required employment_contract columns present (5 nullable for migration tolerance)
- [ ] employment_contract_detail versioning table present
- [ ] profile.external_employee_number unique per workspace (partial index)
- [ ] 5 ADRs registered in `docs/decisions/0000-decision-log.md`
- [ ] Typecheck passes
- [ ] Decision log updated
- [ ] User journey: "Strike-mcp migrates Wrightegaarden workspace end-to-end against local Supabase with zero schema-imposed data loss, pending swaps excluded"

## Council linkage

Verdict 2026-04-15 (Wrightegaarden Tier 1 migration) — full verdict at
`~/dev/strike-mcp/docs/superpowers/plans/2026-04-15-wrightegaarden-tier1-migration.md`.
Mirrored in council log `docs/council/COUNCIL-LOG.md` (to be appended).

Tripletex research (general-purpose subagent, 2026-04-15):
- github.com/Tripletex/tripletex-api2
- Tripletex Ruby SDK (Employee, Employment, EmploymentDetails, TimesheetEntry, SalaryType)
- Tripletex API meetup 2018 best practices
- developer.tripletex.no — openapi docs
