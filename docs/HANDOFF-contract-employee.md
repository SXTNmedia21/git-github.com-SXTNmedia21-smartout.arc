---
title: "HANDOFF — Contract Employee Module Phase 1 (Database Foundation)"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: contracts
tags: [contracts, employment_contract, schema, migration, phase-0a]
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
| `docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql` | 525 | SUPERSEDED |
| `supabase/tests/pgtap/contracts_module_foundation.sql` | ~200 | 31/31 passing |
