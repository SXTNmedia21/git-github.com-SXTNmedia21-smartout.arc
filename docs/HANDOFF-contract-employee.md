---
title: "HANDOFF — Contract Employee Module Phase 0a + Wave 3 (B7) + Wave 5 (J4-5)"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: contracts
tags: [contracts, employment_contract, schema, migration, phase-0a, wave-3, payroll, telemetry]
---

# HANDOFF: Contract Employee Module — Phase 1 (Database Foundation)

## What Was Built

Phase 0a schema rewrite of the Contracts Module database foundation.

**Original migration** (`docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql`) was REJECTED by System Council 2026-04-29 with 9 P0 deploy blockers.

**New migration:** `supabase/migrations/20260519100000_contracts_module_foundation.sql` (572 lines)

### Deliverables

1. Migration file in `supabase/migrations/` with timestamp `20260519100000` (> HEAD max `20260519000000`)
2. Migration parsed and executed against local Supabase — 0 errors
3. pgTAP test file: `supabase/tests/pgtap/contracts_module_foundation.sql` — 31/31 passing
4. `database.types.ts` regenerated — 0 typecheck errors on types file
5. Original migration superseded with banner
6. ADRs 0233, 0234, 0235, 0236 referenced throughout migration

---

## Decisions Made

### ADR-0233: Contract Schema Migration Foundation
- ALTER TYPE additive for `contract_status` (not CREATE — preserves 10 existing values per ADR-0109)
- FK column corrections: all 9 sites use verified PK names from `database.types.ts`
- `field_classification_metadata` table DROPPED from spec (moved to TS const per ADR-0235)
- `workspace_id` denorm on 4 child tables for direct RLS
- Enum structure: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` outside transaction block (Postgres constraint — new enum values cannot be used in same transaction as ADD VALUE)

### ADR-0234: Contract/Payroll Capability Split
- `workspace_id` denorm on `contract_pay_rule`, `contract_tip_rule`, `contract_obligation`, `contract_amendment`
- All 5 new tables have both JWT and API key RLS policies
- payroll capability (Phase 0b) and legal capability (Phase 0c) deferred

### ADR-0235: Obligation Lifecycle + Trigger Semantics
- `compute_obligation_due_at` is `SECURITY DEFINER SET search_path = public, pg_temp`
- Cascade trigger `contract_employment_start_date_cascade` fires on `employment_contract.start_date` UPDATE
- Both functions: `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated`
- `in_progress` obligation requires `started_at IS NOT NULL` (new constraint)

### ADR-0236: Amendment Flow
- `requires_employee_signature boolean NOT NULL` column on `contract_amendment`
- `requires_resigning` retained as GENERATED ALWAYS AS (requires_employee_signature) for backward compat
- Constraint updated: ADMIN amendments accept with employer sig only; MATERIAL require both
- `is_constructive_dismissal_risk boolean NOT NULL DEFAULT false` (Aml. §15-7)
- `acknowledged_constructive_dismissal_risk boolean NOT NULL DEFAULT false`
- No DELETE RLS policy on `contract_amendment` — audit records immutable (Bokføringsloven §13)

### Enum naming decisions
- `rate_type_enum` (not `rate_type`) — avoids collision with `payroll.supplement_rate_type` enum
- `sync_status_enum` (not `sync_status`) — `sync_status` already exists as `pending|synced|failed|conflict`
- `employment_form_enum`, `working_hours_scheme_enum`, `remuneration_type_enum` — parent `employment_contract` columns are still `text` type; Wave 3 (B7) migrates parent columns

### contract_template PK is `template_id` not `id`
Verified against `database.types.ts` — caught during migration dry-run (error: "column id referenced in foreign key constraint does not exist").

### ALTER TYPE outside transaction (Postgres requirement)
`ALTER TYPE ... ADD VALUE` cannot run inside a transaction and have new values used in that same transaction. Pattern used: `COMMIT; ALTER TYPE ... ; BEGIN;` to flush enum values before DDL that references them.

---

## Learnings

### L-new-1: Postgres enum ADD VALUE transaction constraint
`ALTER TYPE ... ADD VALUE IF NOT EXISTS` cannot be used inside a transaction block to add values that are then immediately referenced in the same transaction. Must COMMIT first, then use new values. The migration structure is: `BEGIN; [CREATE new types]; COMMIT; ALTER TYPE [existing type] ADD VALUE; BEGIN; [DDL using new values]; COMMIT;`

### L-new-2: `database.types.ts` regen includes npm warnings in output
`npx supabase gen types typescript --local > file.ts` captures all stdout including npm warnings. Use `2>/dev/null | grep -v "^npm warn\|^WARN:\|^Connecting"` to get clean output.

### L-new-3: FK PK names differ from convention
- `employment_contract.contract_id` (not `id`)
- `workspace.workspace_id` (not `id`)
- `policy.policy_id` (not `id`)
- `protocol.protocol_id` (not `id`)
- `user_identity.user_id` (not `id`)
- `framework_rule.rule_id` (not `id`)
- `contract_template.template_id` (not `id`)
Always verify against `database.types.ts` referencedColumns before writing FKs.

---

## Known Issues / Debt

### Consumer-break — Wave 3 (B7) required
The 10 existing contract capability tools in `packages/ai/src/capabilities/contract/tools.ts` reference the `status` field by existing enum values. The new enum values (`pending_signature`, `active`, `superseded`) are additive and backward compatible — no immediate break. However:

- `employment_form`, `working_hours_scheme`, `remuneration_type` columns on `employment_contract` are still `text` type in production. The migration adds `*_enum` types but does NOT ALTER the existing parent columns.
- Wave 3 (B7) must: (1) migrate parent columns from text to enum with USING cast, (2) update capability tools to use new contract_status enum values where needed.

### ESKALÉR items (arbeidsrettsadvokat-review required before go-live)
1. `overtime_agreement_type` enum (Aml. §10-6 2024-revisjon) — verify §10-6(4) + §10-6(6) reference is current
2. `minimum_guaranteed_amount` constraint for `commissionOnly` (Aml. §14-6 g) — Riksavtalen-tolkning unclear
3. `a_melding_code DEFAULT '111-A'` in `contract_tip_rule` — verify against altinn.no/skjema/a-melding 2024 kodeliste
4. `is_constructive_dismissal_risk` trigger logic (Aml. §15-7) — grenseverdier for endringsoppsigelse skjønnsbasert
5. Riksavtalen `holiday_allowance_pct` trigger — verify detection logic against current Riksavtalen 2024-2026
6. GDPR Art. 9: `trade_union_member` + `trade_union_name` — DPO/personvernrådgiver-review required

### Documented gaps (no schema blocker)
- `exitcertificate_*` migration (Aml. §15-15) — deferred; flagged as gap
- `notice_period_months` dynamic validator — server-side `compute_min_notice_period()` function deferred to Phase 0b
- Permittering (kode 70) in `end_date_reason` — semantically misplaced; separate `permittering` table planned
- Retention column for amendments (Bokføringsloven §13) — `contract_amendment.amendment_date + 5y` wrong basis; correct is `regnskapsår_slutt + 5y`. Phase 0c fixes.
- `apprentice` employment_form UI blocker — application layer only per ADR-0233 §5

### `compute_min_notice_period` — server-side only
`notice_period_months DEFAULT 1` is a legal trap (Aml. §15-3 ansiennitet-trapp requires escalating notice after 5/10/15 years). A server-side validator function `compute_min_notice_period(seniority_start_date, tariff_id)` is deferred to Phase 0b. For Phase 0a: application layer must validate before contract signing.

---

## Next Steps

### Phase 0b (capability work)
1. `packages/ai/src/capabilities/payroll/{tools.ts,index.ts}` — resurrect dead `payroll` capability per ADR-0234
2. `packages/contracts/src/field-classification.ts` — TS const map per ADR-0235
3. `compute_min_notice_period(seniority_start_date, tariff_id)` server-side function
4. Authority seed migration for `payroll` capability (`capability_default_registry`)

### Phase 0c (legal capability)
1. `legal` capability per ADR-0234 Lovsen amendment (validate_aml_14_6, cite_law, classify_amendment)
2. Retention column fix for `contract_amendment`
3. `exit_certificate_*` fields on employment_contract

### Wave 3 / B7 (consumer migration)
1. Migrate `employment_contract.employment_form`, `working_hours_scheme`, `remuneration_type` from text → enum types
2. Update 10 contract capability tools to use new contract_status values
3. pgTAP regression suite for capability tools

---

## Migration File Reference

| File | Lines | Status |
|------|-------|--------|
| `supabase/migrations/20260519100000_contracts_module_foundation.sql` | ~572 | DEPLOYED (local) |
| `supabase/migrations/20260519110000_contract_text_to_enum_cast.sql` | ~197 | Wave 3 Part A |
| `supabase/migrations/20260519120000_payroll_capability_authority_seed.sql` | ~60 | Wave 3 Part B |
| `supabase/migrations/20260519130000_is_employee_blocked_function.sql` | ~50 | Wave 3 Part C |
| `docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql` | 525 | SUPERSEDED |
| `supabase/tests/pgtap/contracts_module_foundation.sql` | ~200 | 31/31 passing |

---

## Wave 3 (B7) — Completed 2026-04-29

### What Was Built

Six implementation parts covering capability, server logic, security, and telemetry.

#### Part A — Text-to-enum migration
`20260519110000_contract_text_to_enum_cast.sql`: alters `employment_contract.employment_form`, `working_hours_scheme`, `remuneration_type` from TEXT to enum types created in Wave 2. Maps unrecognised values to NULL with RAISE NOTICE; adds NOT NULL on `employment_form` with DEFAULT 'full_time'.

#### Part B — Payroll capability
`packages/ai/src/capabilities/payroll/{gate.ts, tools.ts, index.ts}`: 6 tools with full ADR-0099 gate-action pattern, ADR-0078 chat-only channel restriction, ADR-0151 workspace membership guard. Active tools: `updatePayrollProfile`, `queryTaxCard`, `setPensionScheme`. Phase 0c placeholders: `viewPersonalNumber`, `viewBankAccount`, `salaryQuery`. Authority seed in `20260519120000_payroll_capability_authority_seed.sql` (capability_default_registry INSERT + backfill of existing workspaces).

#### Part C — Server-only handlers
- `packages/contracts/` — new server-only TS package:
  - `field-classification.ts`: ColumnKey branded type + FIELD_CLASSIFICATION const (~20 columns as MATERIAL/ADMIN/DERIVED/SYSTEM) + `getFieldClassification()` helper (ADR-0235)
  - `amendment-handler.ts`: `classifyChange()`, `classifyBatch()`, constructive dismissal risk detection (job_title + tariff/hours/salary ≥20% reduction per Aml. §15-7) (ADR-0236)
- `20260519130000_is_employee_blocked_function.sql`: `is_employee_blocked(p_profile_id, p_workspace_id) RETURNS JSONB` — SECURITY DEFINER, reads `contract_obligation` WHERE `is_blocker=true` AND status IN `pending/in_progress/overdue` (L-0172 pattern)
- `supabase/functions/obligation-overdue-cron/index.ts`: Deno Edge Function, daily 02:00 UTC, CRON_SECRET bearer auth, marks pending obligations past `due_at` as `overdue`, batch limit 100 (ADR-0235 Part C)

#### Part D — ADR-0151 forgery defence
`apps/web/src/app/api/contracts/route.ts`: verifies `profile_id` from request body belongs to `workspace_id` from JWT using user-scoped client (RLS). Returns 403 `PROFILE_WORKSPACE_MISMATCH` on mismatch. Comment documents the full security reasoning.

#### Part E — Grep verification
Zero `?? ""` patterns on `actor_id`/`workspace_id` at emit call sites across `packages/ai/src/capabilities/`, `services/contract-service/src/`, and `apps/web/src/app/api/contracts/`. ADR-0193 NonEmptyString discipline confirmed.

#### Part F — Telemetry events
`packages/telemetry/src/registry.ts`: 11 new events registered:
- Payroll mutations (4 destinations): `payroll update_payroll_profile`, `payroll set_pension_scheme`
- Payroll reads (3 destinations, no engine_event per L-0023): `payroll tax_card_queried`, `payroll salary_queried`
- Contract events (4 destinations): `contract obligation_overdue`, `contract obligation_due_soon`, `contract amendment_proposed`, `contract amendment_signed`, `contract amendment_declined`, `contract acknowledgement.block_confirmed`, `contract pii.revealed`

#### Bonus fix — intent-classifier
`packages/ai/src/router/intent-classifier.ts`: `availability` was missing from the Zod enum, making it silently unroutable. Added to both the enum and the system prompt.

### Typecheck Results (verified)
- `@smartout/contracts`: 0 errors
- `@smartout/telemetry`: 0 errors
- `@smartout/ai`: 0 errors

### Commits
- `cce61395` feat(contracts): Part A — text-to-enum cast migration
- `a8a8c93e` feat(payroll): Part B — payroll capability with 6 tools + authority seed
- `e2b274b9` feat(contracts): Part C — server-only handlers, obligation cron, payroll registry
- `38361a61` fix(contracts): Part D — ADR-0151 forgery defence on POST /api/contracts
- `22e61174` feat(contracts): Parts E+F — 11 telemetry events + intent-classifier fix
- `180b5685` chore(deps): update pnpm-lock for @smartout/contracts package

### Updated Next Steps (post Wave 3)
1. `compute_min_notice_period(seniority_start_date, tariff_id)` — server-side validator, Phase 0b
2. `legal` capability — ADR-0234 Phase 0c: `validate_aml_14_6`, `cite_law`, `classify_amendment`
3. Retention column fix for `contract_amendment` (correct basis: regnskapsår_slutt + 5y)
4. `exit_certificate_*` fields on `employment_contract` (Aml. §15-15)
5. pgTAP regression suite for contract capability tools
6. ESKALÉR items listed above — arbeidsrettsadvokat-review before go-live

---

## Wave 5 — Journeys 4-5 (Daily enforcement + Amendment flow) — 2026-04-29

### Workstreams completed

#### WS0: ContractDispatchDrawer wiring
`apps/web/src/app/dashboard/people/[id]/page.tsx`: wired `ContractDispatchDrawer` (2-step mal+preview) inline on people-page "Send kontrakt" button. URL sync: `?compose=open` opens drawer on mount. `targetProfileId` from URL context; `workspaceId` derived server-side via JWT (ADR-0151). Navigation-away pattern replaced.

#### WS1A: Clock-in obligation gate
`packages/ai/src/capabilities/shift-lifecycle/tools.ts`: new `clock_in_check` tool calls `is_employee_blocked(p_profile_id, p_workspace_id)` SECURITY DEFINER RPC. Returns Norwegian message + blockers list when overdue. ADR-0151 (workspace from ctx), ADR-0078 (voice forbidden). Emits `contract.obligation_overdue` per registry schema. Registered in `index.ts`.

#### WS1B: Shift-cost calculation (existing `settle_shift` tool)
The existing `settle_shift` tool in Wave 3 calls `snapshot_shift_cost` RPC which already reads `contract_pay_rule` and writes `shift_cost_snapshot`. No additional work required for WS1B base functionality.

#### WS1C: `salary_query` implementation
`packages/ai/src/capabilities/payroll/tools.ts`: `salaryQuery` fully implemented (was placeholder). Reads `shift_cost_snapshot` for the period + `contract_pay_rule` for citation (`source_text` = "Riksavtalen §3.2"). Returns breakdown per shift + period total. Graceful degradation when snapshots unavailable. `allowedChannels: ["chat"]` per ADR-0078. Emits `payroll.salary_queried`.

#### WS1D: `obligation-due-soon-cron`
- `supabase/functions/obligation-due-soon-cron/index.ts`: reads pending obligations with `due_at <= NOW() + 3 days`, updates `notified_at` (idempotency), emits `contract.obligation_due_soon`. Daily 03:00 UTC, CRON_SECRET auth.
- `supabase/migrations/20260519140000_contract_obligation_notified_at.sql`: adds `notified_at` column + cron-optimized index.
- `supabase/config.toml`: `[functions.obligation-due-soon-cron]` registered, `cron = "0 3 * * *"`.

#### WS2E: Amendment API
`apps/web/src/app/api/contracts/[id]/amend/route.ts`: POST endpoint. Classifies field changes via `classifyBatch` (server-only, `@smartout/contracts`). Inserts `contract_amendment` row using correct DB schema (`contract_id`, `field_changes: Json`, `change_summary: string`, `created_by_user_id` required). Status = `pending_employee_signature` or `pending` per classification. ADR-0151, ADR-0236. Emits `contract.amendment_proposed`.

Also: `classify/route.ts` (dry-run only, no DB write) + `[amendmentId]/accept/route.ts` + `[amendmentId]/decline/route.ts` (uses `rejected` status + `rejected_at`/`rejection_reason` per DB enum).

#### WS2F: People-page amendment UI
`apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx`: `AmendmentSection` component added. Opens collapsed panel with 4 MATERIAL field inputs (position_title, hourly_rate, monthly_salary, agreed_weekly_hours). "Forhåndsvis endringer" calls `/classify` dry-run → renders `ContractAmendmentDiff` side-by-side. If `is_constructive_dismissal_risk=true`: shows Aml. §15-7 banner + `acknowledged_constructive_dismissal_risk` checkbox (blocks submit until checked). Wired into `HrTabSections`.

#### WS2G: My-contract amendment banner + accept/decline
`apps/web/src/app/dashboard/my-contract/page.tsx`: loads `contract_amendment` with status `proposed`/`pending_employee_signature` for active contract. Banner shows diff via `ContractAmendmentDiff` + two action buttons. Accept → `/accept` API (sets `signed_by_employee_at`). Decline → `/decline` API (sets `rejected_at`, `rejection_reason`). Emits `contract.amendment_signed` / `contract.amendment_declined`.

#### WS2H: Bulk amendment for tariff-version-changed (scaffolded, deferred)
- `supabase/functions/tariff-amendment-sweep/index.ts`: detects `workspace_framework_binding` changes, creates `contract_amendment` per affected contract, emits `contract.tariff_version_changed`. NOT scheduled in `config.toml` per mission notes ("deferred to separate sortie post-go-live").
- `apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx`: `pendingTariffAmendmentCount?: number` prop + amber banner when > 0. Downstream wiring (count query from contracts hub page) deferred.

#### ContractAmendmentDiff + ObligationBlocker (implemented from scaffold)
- `ContractAmendmentDiff`: side-by-side / stacked layout with framer-motion row entrance, `useReducedMotion` guard, `bg-rose-500/10` (from) + `bg-emerald-500/10` (to) (WCAG AAA per ADR-0236). Exported `DiffField` type.
- `ObligationBlocker`: 3 variants (banner, sheet, botsson-card) with `role="alert"`, `useReducedMotion`, Norwegian UI strings. `obligation_blocker_shown` telemetry deferred (not yet in registry).

### DB schema notes (caught during implementation)
- `contract_amendment` uses `contract_id` (not `parent_contract_id`) — FK to `employment_contract.contract_id`
- `amendment_status` enum: `pending | pending_employee_signature | accepted | rejected | expired`
- No `proposed` status — use `pending` or `pending_employee_signature`
- Decline = `rejected` (not `declined`). Columns: `rejected_at`, `rejection_reason`
- `field_changes: Json` (not `change_summary: JSONB`) — `change_summary: string`
- `created_by_user_id: string` required on insert

### `@smartout/contracts` web dependency
Added to `apps/web/package.json` dependencies (required for server-side `classifyBatch` in API routes). `pnpm-lock.yaml` updated accordingly.

### Typecheck results (Wave 5)
- `@smartout/ai`: 0 errors
- `web`: 0 errors
- `@smartout/mobile`: pre-existing error in `use-request-absence.ts` (not Wave 5)

### Telemetry events used (Wave 5)
- `contract.obligation_overdue` — clock_in_check (WS1A)
- `payroll.salary_queried` — salary_query (WS1C)
- `contract.amendment_proposed` — amend POST (WS2E)
- `contract.amendment_signed` — accept route (WS2G)
- `contract.amendment_declined` — decline route (WS2G)
- `contract.amendment_initiated` — AmendmentSection open (WS2F, fire-and-forget fetch)

### ADR-0151 forgery defence (Wave 5 endpoints)
- `/api/contracts/[id]/amend`: workspace from `supabase.auth.getUser()` → profile → workspace_id; contract_id from URL
- `/api/contracts/[id]/amend/[amendmentId]/accept`: same
- `/api/contracts/[id]/amend/[amendmentId]/decline`: same
- `clock_in_check` tool: workspace from `ctx.workspaceId` (JWT); profile from `ctx.profileId`

### Mobile parity (Wave 5)
- `ObligationBlocker`: `"sheet"` variant exists for mobile bottom-sheet. `MobileObligationBlocker` export available.
- `ContractAmendmentDiff`: `layout="stacked"` for mobile.
- `apps/mobile/src/screens/MyContract.tsx` does not exist — documented gap, not a blocker (ADR-0133: employee re-sign is a mobile-native witness verb and should be built in mobile, but the web flow is complete for parity).

### Known gaps / next sortie
1. `tariff-amendment-sweep` cron — activate in `config.toml` after tariff version flip validation
2. `pendingTariffAmendmentCount` query wiring in contracts hub page
3. `obligation_blocker_shown` telemetry event — register in registry.ts
4. Mobile `MyContract` screen — basic amendment banner + accept/decline
5. DocuSeal re-sign integration for `requires_employee_signature=true` amendments (accept route triggers DocuSeal, but wiring is placeholder)
6. `contract_pay_rule.source_text` population — currently read by `salary_query` but rules must be created with citations during contract composition
