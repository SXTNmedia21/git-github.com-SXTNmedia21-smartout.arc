---
title: "Contract Schema Migration Foundation — FK fixes, enum migration, RLS, trigger SECURITY"
id: ADR_0233
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0233: Contract Schema Migration Foundation

## Context and Problem Statement

Contract Module Phase 0a draft (`docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql`) was rejected by System Council 2026-04-29 with 9 P0 deploy blockers. ADR-0001-contract-service (proposed in same folder) collides with global ADR-0001 (Turborepo, accepted 2026-02-24) and is not registered in `docs/decisions/0000-decision-log.md`. This ADR re-grounds the schema migration in current code reality.

## Decision Drivers

- Migration cannot parse on clean Postgres as written (FK columns wrong, `\i` psql meta-command, enum collision)
- ADR-0182 reserved `contract_status` enum for `employment_contract` lifecycle; ADR-0001-contract-service silently redefines
- ADR-0109 explicitly registered `migration_incomplete` value for block-and-supersede invariant; redefinition drops it
- 4 child tables lack `workspace_id` denorm — RLS via JOIN is feasible but error-prone (Steward + Harness convergent)
- Existing 10 contract capability tools at `packages/ai/src/capabilities/contract/tools.ts` consume current `status` field name + 4 enum values still in active use (Coord blast-radius trace)

## Considered Options

1. **Hard rewrite + redeploy** — drop + recreate enums, force migrate all consumers in same wave. Fast but breaks production data.
2. **ALTER TYPE additive + value-mapping migration** — preserve existing enum values, add 3 new (`pending_signature`, `active`, `superseded`), explicit `UPDATE` mapping for existing rows + tool migrations same wave.
3. **Defer schema entirely; ship spec only** — write ADRs without code. Avoids deploy risk but blocks Phase 0a indefinitely.

## Decision Outcome

Chosen option: **Option 2 — ALTER TYPE additive + value-mapping migration**, because it preserves ADR-0109 invariant and existing capability tool functionality while landing the new lifecycle states required by D2 (parallel contracts).

### Required migration changes

1. **File path**: move to `supabase/migrations/<YYYYMMDDHHMMSS>_contracts_module_foundation.sql`. Timestamp > current `development` HEAD max.
2. **FK column fixes** (all 9 sites): `policy(policy_id)`, `protocol(protocol_id)`, `workspace(workspace_id)`, `employment_contract(contract_id)`, `user_identity(user_id)` — never `"user"(id)`.
3. **Enum migration**:
   ```sql
   ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_signature';
   ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'active';
   ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'superseded';
   -- Existing values preserved (sent, viewed, signed, pending_data, declined, ready_to_send, migration_incomplete)
   -- Application-layer state machine maps semantically; no UPDATE-rewrite of historical values.
   ```
4. **`employment_form` enum cast**: separate sub-step. Create enum, backfill text → enum mapping, `ALTER TABLE … TYPE employment_form USING …::employment_form`. Same for `working_hours_scheme`, `remuneration_type`.
5. **Inline `99-seed-classifications.sql`** — drop `\i` directive. (But see ADR-0235 — field_classification table is removed entirely; classification moves to TS const.)
6. **Denorm `workspace_id`** onto `contract_pay_rule`, `contract_tip_rule`, `contract_obligation`, `contract_amendment`. Backfill via `contract_id → employment_contract.workspace_id` trigger or migration step.
7. **RLS on all 5 new tables** (denormed `workspace_id` enables direct policy without JOIN cost). Both JWT and API key paths.
8. **Trigger SECURITY DEFINER** explicit on `compute_obligation_due_at`. Add `SET search_path = public, pg_temp`. Add second trigger on `employment_contract.start_date` UPDATE → recompute children.
9. **Idempotency**: `ON CONFLICT (code) DO NOTHING` on `salary_type` + `end_date_reason` seeds.
10. **Drop `tariff_id` index** (column doesn't exist on `employment_contract`); tariff resolution lives in `contract_template_binding` per existing migration `20260422120000_*`.
11. **Resolve constraint conflicts**:
    - `tip_share` range — pick 0.00–1.50 (matches ARCH §3.5 spec) OR document why 5.00 cap intentional.
    - `holiday_allowance_pct` — raise floor to 12.00 to match default OR document 10.20 absolute legal floor.
    - `employment_contract_temporary_requires_end_date` extend to `(temporary, apprentice, practice)`.
    - `commissionOnly` NULL salary — add follow-up ADR for shape, OR reject `commissionOnly` until follow-up.
    - `contract_amendment_accepted_requires_signatures` — see ADR-0234 capability split + ADR-0236 amendment flow; requires `requires_employee_signature` boolean column.

## Rules & Consequences

- **Good, because** existing 10 contract tools continue to work; ADR-0109 + ADR-0182 invariants preserved; RLS denorm eliminates JOIN-RLS error class.
- **Bad, because** larger migration footprint (12+ ALTERs, 4 backfills); longer transaction window; existing 10-value enum is now superset of intended 6-state model — application-layer state machine becomes load-bearing.
- **Agent Impact:** Build agents implementing this migration MUST: (a) verify FK PK columns against `database.types.ts` before authoring; (b) use `ALTER TYPE … ADD VALUE` never `CREATE TYPE` for existing enums; (c) include RLS in same migration as `CREATE TABLE`; (d) specify trigger SECURITY mode explicitly.

## References

- Council 2026-04-29 Contract Module Phase 0a — REJECT verdict
- Supersedes: `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` (proposed, never registered globally)
- ADR-0024, 0076, 0079, 0082, 0109, 0111, 0181, 0182 (existing contract architecture)
- ADR-0234 (capability split — paired)
- ADR-0235 (obligation lifecycle)
- ADR-0236 (amendment flow)
- L-0169 (capability registry co-migration), L-0170 (role enum assumption), L-0171 (`status` rename blast radius), L-0172 (trigger SECURITY bypass), L-0173 (DB-classification anti-pattern), L-0174 (compose vs author verb collision)

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-04-29.
