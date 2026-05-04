---
title: "`status` Column Rename Blast Radius — Single Most-Renamed Column"
id: LEARNING_0171
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [migration, enum, capability-tools, blast-radius, contract-module]
---

# Learning-0171: `status` Column Rename Blast Radius

## Context

Council 2026-04-29 reviewing Contract Module Phase 0a foundation. Coord Layer 4 code-trace at `packages/ai/src/capabilities/contract/tools.ts:54-58, 80-87, 152-156` showed 4+ existing capability tools BREAK on `status` → `contract_status` rename. Additionally `packages/ai/src/capabilities/contract-intake/tools.ts:225` filters `.eq("status", "pending_data")` — would break on enum value migration. Plus 4 follow-up migrations reference dropped values (`pending_data`, `ready_to_send`, `migration_incomplete`, `declined`).

`status` is a generic column name reused across 12+ tables in the schema (`employment_contract`, `contract_template`, `engine_state`, `engine_session`, `schedule_shift`, etc.). Each rename or enum-change touches every consumer. ADR-0001-contract-service proposed to drop existing values + rename column without consumer migration plan.

## Discovery

Three patterns make `status` renames especially dangerous:

1. **Generic column name** — `status` appears across many tables, so grep returns false positives. Hard to scope blast-radius without table-qualifier.

2. **Enum values are LLM-readable strings** — capabilities use enum values directly in `.eq()` filters and prompts (e.g. `"sent"`, `"pending_data"`). Drop = silent zero-row return, not type error.

3. **Cross-migration constraint combinations** — multiple migrations have added values (`migration_incomplete` per ADR-0109, `pending_data` per Tripletex bootstrap). Each value has a consumer somewhere. Dropping = breaking those consumers.

Pattern signature:
- ADR proposes `CREATE TYPE` (not `ALTER TYPE`) on existing enum
- Spec lists "new" values, doesn't enumerate existing values to keep/drop/migrate
- No grep audit of consumer code paths
- No `UPDATE table SET status = new_value WHERE status = old_value` mapping

## Impact

**Phase 2.5 fact-check for ADRs touching `status` enum MUST:**
1. Grep all `.eq("status",` and `.eq("contract_status",` etc. across `packages/ai/src/capabilities/`, `apps/web/src/`, `services/`
2. List existing enum values from `database.types.ts`
3. Compare proposed enum values to existing — flag every value being dropped
4. For each dropped value, list consumer code paths

**Council Phase 5 Trust Gate:** ADR proposing enum value drop without consumer migration map = REJECT.

**Migration policy:** Always prefer `ALTER TYPE ... ADD VALUE` over `CREATE TYPE`. Existing values are load-bearing for existing consumers.

**ADR-0233 enforces:** explicit value migration map in ADR before schema migration deploys. Existing values preserved unless ALL consumers migrated in same wave.

## References

- ADR-0233 (contract schema migration foundation — enforces this learning)
- ADR-0109 (`migration_incomplete` value) — existing consumer
- ADR-0182 (contract_status reserved for contract lifecycle)
- L-0103 (status column rename) — referenced in chair Phase 3
- Council 2026-04-29 Contract Module Phase 0a

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
