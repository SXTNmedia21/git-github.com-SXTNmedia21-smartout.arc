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

### `shift` — flat worktime cache (no JSON snapshot in practice)

Live probe confirmed `shift.Json` field is declared in Bubble meta but
empty on 0/20 sampled Wrightegaarden shifts. Bubble instead denormalizes
worktime summary as flat columns on the shift row:
`worktime.start/end/hours/salary`, `baseSalary`, `shift.Salary`,
`shift.durationSeconds`, plus FK lists (`list of 🗓️ records`,
`list of 🗓️ salaryDetails`).

**Decision:** v3 does NOT add these flat cache columns to `schedule_shift`.
Cost data lives on the existing `shift_cost_snapshot` (C3 Commercial
plane, already in `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql`).
Historical Bubble cost data flows into `payroll_ledger_archive`, then is
aggregated into `shift_cost_snapshot` via M10. This respects the
D6 Production vs C3 Commercial cascade separation instead of denormalizing
onto the shift row the way Bubble did.

Migration order for cost data:
1. `schedule_shift` (D6) — operational shift without cost
2. `timesheet.time_entry` — punch-clock evidence from `🗓️record` workTime rows
3. `payroll_ledger_archive` — all 17 607 salary_transaction rows as ground truth
4. `shift_cost_snapshot` — derived via M10 from the ledger

## Tasks

### Phase 1 — Migration additions

- [ ] M1: create `public.employee_type` K1a platform-level reference table + seed 3 rows as platform data
  - Columns: `employee_type_id uuid PK`, `workspace_id uuid NULL` (nullable — K1a pattern, matches `tariff_rate_table`), `title text`, `employment_form_derived text` (permanent/temporary/NULL), `fixed_salary boolean`, `max_hours_week numeric`, `accounting_account_code text`, `color_pallet text`, `max_vacation_days int`, `days_trial_period int`, `created_at`, `updated_at`
  - RLS: read-to-all-authenticated; write-platform-admin-only
  - Seed the 3 rows (Månedslønn, Timelønn sesongmedarbeider, Frivillig) as platform rows with `workspace_id = NULL` — strike-mcp resolves FK per profile at migration time; workspace-overrides allowed via future INSERT
  - NO `source` column (employee_type is not in the 12-table discriminator set)
- [ ] M2: extend `public.employment_contract` with Tripletex-required columns
  - `occupation_code text` (STYRK-08, 7-digit, nullable — validated at sync time, not here)
  - `employment_form text` with CHECK `IN ('permanent','temporary') OR IS NULL` (NULL = volunteer)
  - `remuneration_type text` with CHECK `IN ('monthly','hourly','commission') OR IS NULL` (NULL = unpaid/volunteer)
  - `working_hours_scheme text` (Tripletex lookup: dagtid/skift/turnus/…)
  - `fte_percentage numeric` (stillingsprosent)
  - `employee_type_id uuid REFERENCES public.employee_type`
- [ ] M2a: `ALTER TYPE public.contract_status ADD VALUE 'migration_incomplete'` — isolated migration (PG tx rule: new enum value unusable in same tx)
- [ ] M3: add `public.employment_contract_detail` table (versioned contract state)
  - Tripletex expects append-only history per `effective_date`
  - Columns mirror M2 additions + `effective_date date NOT NULL`
  - Unique index `(employment_contract_id, effective_date)`
- [ ] M4: extend `public.profile` with `external_employee_number text` + `UNIQUE(workspace_id, external_employee_number) WHERE external_employee_number IS NOT NULL`
- [ ] M5: add `public.payroll_ledger_archive` table — receives 17 607 ⏱️salary_transaction rows
  - Columns: `payroll_ledger_id uuid PK`, `workspace_id uuid FK`, `schedule_shift_id uuid FK`, `profile_id uuid FK`, `department_id uuid FK`, `team_id uuid FK`, `transaction_date date`, `work_date date`, `start_time text`, `stop_time text`, `hours numeric`, `base_salary numeric`, `total_salary numeric`, `is_worktime boolean`, `salary_category text`, `salary_type_name text`, `a_melding_code text`, `accounting_account_code text`, `bubble_record_id text UNIQUE`, `source text DEFAULT 'bubble_migration'`, `raw_json jsonb`, `comment text`, `created_at`
  - RLS workspace-scoped read + admin-only INSERT; explicit `USING (false)` for UPDATE + DELETE (archive immutability — ADR-0110)
- [x] ~~M6: extend `public.schedule_shift` with `source_snapshot_json jsonb`~~ — **DROPPED 2026-04-15.** Live inspection: `shift.Json` is declared in Bubble meta but empty on 0/20 sampled Wrightegaarden shifts. The field is unused in practice. No JSONB archive column needed on schedule_shift.
- [ ] M7: add `source text DEFAULT 'operational'` column + CHECK (`'operational' | 'bubble_migration' | 'v3_engine'`) to: workspace, company, location, department, team, profile, employment_contract, employment_contract_detail, employee_type, schedule_shift, timesheet.time_entry, invitation (12 tables)
- [ ] M8: enumerate every `AFTER INSERT/UPDATE` trigger on the 12 source-column tables; add `WHERE source = 'operational'` (whitelist) filter where applicable. Enumeration table lives in ADR-0150 before migration authoring (per ADR-0150)
- [ ] M9: regenerate `packages/supabase/src/database.types.ts`
- [ ] M10: seed `public.shift_cost_snapshot` (existing C3 Commercial table, `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:379`) from `payroll_ledger_archive` — derivation query aggregates ledger rows per `schedule_shift_id` after M5 lands. Keeps cost data on cascade C3 plane instead of denormalizing onto `schedule_shift` (D6). Bubble duplicated `worktime.hours/salary/baseSalary` flat on its shift row for performance; v3 relies on Postgres index + join instead.

### Phase 2 — ADRs

ADR numbering verified 2026-04-15: highest existing = 0106. Range 0080-0084 is taken (0080 compliance-drift, 0081 admin-pii-bypass, 0082 contract-drafts-not-versions, 0083 strike-mcp-registration, 0084 telemetry-conditional-exports). Final assignment:

- [ ] **ADR-0149**: strike-mcp telemetry boundary — **extends ADR-0083** (registration). No `emit()`, no `engine_event`, no `activity_trail`; provenance via `source` column only. Bypasses ADR-0076 composition derivation for historical imports.
- [ ] **ADR-0150**: `source` discriminator pattern across migration-targeted tables + `engine_process` trigger filters. **Whitelist semantics** (`source = 'operational'`), not blacklist. Enumerates concrete triggers affected in a table.
- [ ] **ADR-0109**: migrated profile contract shell — zero-contract profile handling with `status='migration_incomplete'` + Tripletex-optional fields nullable + volunteer null-semantics. **Explicitly declares ADR-0076 composition bypass** as bounded historical exception for `source='bubble_migration'` rows; re-entry semantics for post-migration mutation.
- [ ] **ADR-0110**: `payroll_ledger_archive` semantics — read-only Bubble historical ledger (archive-only). v3 framework engine writes new rows to a SEPARATE operational payroll table (NOT this archive). RLS explicit `USING (false)` for UPDATE/DELETE.
- [ ] **ADR-0111**: `employment_contract_detail` append-only versioning matching Tripletex EmploymentDetails. **Reconciles with ADR-0082** — detail rows are intra-contract state snapshots (effective_date), NOT pre-send drafts; parent_contract_id lineage (0082) remains for inter-contract versioning.

### Council verdict conditions (2026-04-15 scope-lock)

Council APPROVED WITH CHANGES. Binding conditions carried into ADR/migration authoring:

1. **M1 employee_type as K1a platform-level** (nullable `workspace_id`, read-to-all-authenticated, write-platform-admin-only). Matches `tariff_rate_table` pattern. Seed 3 Wrightegaarden rows as platform data. `source` column omitted (not in 12-table discriminator set).
2. **M2a separation:** `ALTER TYPE public.contract_status ADD VALUE 'migration_incomplete'` in dedicated migration file, isolated from any migration using the new value (PG tx rule).
3. **M5 nomenclature resolved:** `payroll_ledger_archive` is Bubble historical archive only. v3 writes new payroll data to a separate operational table (out of scope here — future work).
4. **M7 cross-schema:** include `timesheet.time_entry` (INSERT-time metadata; no ADR-0097 immutability conflict).
5. **M8 whitelist:** `WHERE source = 'operational'` (or explicit list), not `WHERE source != 'bubble_migration'`. Enumerate trigger targets in ADR-0150 before writing migration.
6. **Every migration must qualify `public.contract_status`** (ADR-0079 naming collision with text column in 20260228140000).

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
