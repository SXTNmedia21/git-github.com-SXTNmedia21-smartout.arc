---
title: "User Journeys — Tripletex-Ready Schema"
status: done
updated: 2026-04-16
created: 2026-04-16
module: tripletex-migration
tags: [journey, tripletex, migration, bubble]
---

# User Journeys — Tripletex-Ready Schema

> Feature: `feat/tripletex-ready-schema` | Worktree: wt-3 | ADRs: 0107–0111
>
> This feature extends the v3 schema — it has no direct UI surface. The
> journeys here are infrastructure-level: what strike-mcp does against
> the new schema, what a Tripletex-sync consumer reads, and what an
> admin experiences post-migration.

---

## Journey 1: Strike-mcp imports Wrightegaarden Bubble workspace

**Actor:** Strike-mcp (dev-only MCP tool, ADR-0083), driven by Claude Code during migration session.

**Precondition:**
- Local Supabase running with all migrations applied through M9
- Strike-mcp connected with service_role token
- Wrightegaarden Bubble workspace reachable (BUBBLE_API_TOKEN set)

**Flow:**

1. Strike-mcp reads Wrightegaarden workspace data (135 profiles, 2 750 shifts, 5 434 time records, 17 607 salary_transactions)
   → System: workspace-filtered discovery per strike-mcp ADR-0003
   → User sees (in strike-mcp CLI): row counts per entity table with freshness timestamps
2. Strike-mcp generates migration SQL with `source='bubble_migration'` on every row
   → System: auto_align attestation gate blocks any ambiguous mapping; user must approve
   → User sees: decision log entries for each entity class
3. Strike-mcp INSERTs rows into v3 tables via service role
   → System: (a) M7 `source='bubble_migration'` column on every target table preserves provenance; (b) M8 trigger filters (ADR-0108 Clause B) prevent phantom protocol_assignments, ghost channels, real push notifications, and audit spam; (c) RLS `service_role` policies allow INSERTs
   → User sees: per-table row counts + any orphan reports (shifts without deparment, etc.)
4. Strike-mcp writes initial `employment_contract_detail` rows per contract per Bubble effective_date (ADR-0111 Clause D backfill rule)
   → System: UNIQUE(contract_id, effective_date) enforces idempotency on re-run
   → User sees: detail row count = sum of distinct Bubble effective_date combinations across 5 canonical Tripletex columns
5. Strike-mcp writes `payroll_ledger_archive` rows (17 607 for Wrightegaarden)
   → System: `raw_json` preserves complete Bubble row; typed columns cover Tripletex sync + indexed query paths; nullable FKs tolerate orphans
   → User sees: orphan counts per FK column in strike-mcp post-migration report
6. Strike-mcp writes final summary to repo-local log (ADR-0107 Clause E observability substitute)
   → System: no `activity_trail`, `engine_event`, `notification_outbox`, or `schedule_audit_log` rows produced (ADR-0107 Clause A forbidden side-channels)

**Postcondition:**
- All target tables have Wrightegaarden data with `source='bubble_migration'`
- 3 platform-level `employee_type` rows visible in all workspaces (Månedslønn / Timelønn sesongmedarbeider / Frivillig)
- No phantom assignments, channels, push events, or audit rows
- Strike-mcp decision log + local log contain the migration audit trail
- 14 pending swaprecords dropped (Bubble cutover notice delivered to workspace admins: "Re-initiate pending shift swaps in v3")

**Error paths:**
- **Ambiguous mapping:** auto_align gate blocks; user runs review_mapping interactively; migration re-runs.
- **Orphan FK:** schedule_shift_id / department_id / team_id = NULL; row preserved (ADR-0110 Clause E), orphan count reported.
- **Duplicate bubble_record_id within workspace:** UNIQUE constraint blocks second INSERT; strike-mcp logs conflict; retry with ON CONFLICT strategy (strike-mcp ADR-0003).
- **Missing employment_contract columns for Tripletex:** status set to `migration_incomplete` (M2a enum value); admin sees "import incomplete" label in UI (mobile statusLabel updated).

---

## Journey 2: Tripletex-sync worker reads archive + detail for a-melding export

**Actor:** Future Tripletex-sync service (out-of-scope here; journey documents the consumer contract the schema must satisfy).

**Precondition:**
- Wrightegaarden migration complete (Journey 1)
- Tripletex API credentials configured
- Sync worker authenticated with service_role

**Flow:**

1. Worker queries `employment_contract` JOIN `employment_contract_detail` ordered by `effective_date DESC` per profile
   → System: returns full Tripletex EmploymentDetails history (intra-contract versioning, ADR-0111)
   → User (Tripletex integration admin): sees per-employee employment timeline with effective_date, occupation_code, employment_form, remuneration_type, working_hours_scheme
2. Worker queries `payroll_ledger_archive` ordered by `profile_id, transaction_date`
   → System: returns Bubble historical ledger with a_melding_code + accounting_account_code per row
   → User: sees complete pre-cutover payroll history for a-melding
3. Worker filters out volunteer rows: `WHERE employment_form IS NOT NULL` (Frivillig excluded)
   → System: ADR-0109 Clause B volunteer null-semantics — Frivillig contracts not synced to Tripletex
   → User: sees expected row count (paid employees only)

**Postcondition:**
- Tripletex receives complete historical + current employment + payroll data
- Volunteer contracts cleanly excluded
- No "migration_incomplete" rows synced (Tripletex-optional fields that are NULL block sync per standard integration policy)

**Error paths:**
- **NULL occupation_code on migrated contract:** status = `migration_incomplete`; admin must backfill STYRK-08 code before sync; UI surfaces "missing occupation code" warning.
- **`migration_incomplete` contract status:** Tripletex sync skips this row and logs; admin must complete data and transition status.

---

## Journey 3: Admin corrects a migrated contract (ADR-0109 block-and-supersede)

**Actor:** Admin in v3 dashboard, post-migration.

**Precondition:**
- Anna's contract migrated with `source='bubble_migration'`, `status='signed'`, `hourly_rate=175`

**Flow:**

1. Admin clicks "Edit contract" on Anna's card
   → System: UI routes to composition flow (ADR-0076), NOT direct UPDATE
   → Admin sees: composition wizard prefilled with Anna's current terms
2. Admin changes `hourly_rate` from 175 to 185
   → System: composition engine validates against framework + tariff, builds change_proposal
   → Admin sees: blocker/warning list (any tariff-minimum violations flagged)
3. Admin approves proposal
   → System: INSERTs NEW `employment_contract` row with `source='operational'`, `parent_contract_id = Anna's migrated row ID`, full framework_snapshot; DocuSeal envelope created
   → Admin sees: "New contract v2 created, sent to Anna for signing"
4. Anna signs in mobile app
   → System: new contract status transitions to `signed`; migrated parent row marked `terminated` (superseded)
   → Anna sees (mobile): "Utkast" → "v1 — sendt" → "Signert" per ADR-0082 UI copy rules

**Postcondition:**
- Anna's active contract is the cascade-derived v2 row
- Migrated v1 row preserved as historical artifact (source='bubble_migration', status='terminated')
- parent_contract_id lineage chain intact
- Tripletex sync on next run reads v2 as current, v1 as historical

**Error paths:**
- **Admin tries direct UPDATE (e.g., via Supabase Studio or unscoped API call):** Raises exception "Cannot edit a migrated contract directly. Issue a new contract via the composition flow to supersede the migrated record." (per ADR-0109 Clause C)
- **Composition blocked by tariff violation:** Admin sees compliance_overrides required field (ADR-0076); must justify + approve; otherwise composition fails and no new row created.
- **Migrated row has missing Tripletex data:** New composition row backfills those fields; old row stays `migration_incomplete` but superseded.

---

## Acceptance against plan

- [x] All 4 missing Tier 1 structures present: employee_type, payroll_ledger_archive, schedule_shift source column (via M7, not source_snapshot_json per M6 drop), source column on 10 tables
- [x] All 5 Tripletex-required employment_contract columns present (fte_percentage dropped — existing employment_percentage is canonical)
- [x] employment_contract_detail versioning table present
- [x] profile.external_employee_number unique per workspace (partial index)
- [x] 5 ADRs (0107–0111) registered in decision log
- [x] Typecheck passes: 31/31 tasks successful
- [x] Decision log updated
- [x] `database.types.ts` regenerated
- [x] RLS on all new tables (workspace-scoped read, service-role INSERT, `USING(false)` UPDATE/DELETE on archive)
- [x] Journey 1 validates acceptance: "Strike-mcp migrates Wrightegaarden workspace end-to-end against local Supabase with zero schema-imposed data loss, pending swaps excluded"
