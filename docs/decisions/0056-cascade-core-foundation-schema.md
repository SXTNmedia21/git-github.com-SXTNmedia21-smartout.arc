---
title: "ADR-0056: Cascade Core Foundation Schema"
status: accepted
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, architecture, schema, migration, adr]
---

# ADR-0056: Cascade Core Foundation Schema

## Context

The Cascade Core Foundation is the canonical domain model, framework resolution engine, and proposal/enforcement pipeline for scheduling, payroll sync, compliance, and workforce intelligence. The foundation spec (I1 + 6D + 4C + K1a/K1b) was locked on 2026-03-21.

Implementation required decisions about migration strategy, legacy compatibility, and the relationship between the new cascade pipeline and the existing event engine.

## Decisions

### 1. A1/A2/A3 Migration Tiers

Schema is split into three independent migration tiers:

- **A1** (domain): 11 tables + 10 enums + alterations to 7 existing tables
- **A2** (framework): 6 tables + 6 enums
- **A3** (integration): 3 tables — deferred until Phase D integration work begins

**Why:** Schema is a commitment signal. Agents see tables and try to wire them up. A3 stays out until integration work is real — not because DDL is dangerous, but because it's noise until then.

### 2. Cascade Operates as Independent Layer (Not Inside Event Engine)

The cascade proposal pipeline (preview -> persist -> freshness check -> framework gate -> apply) does NOT run inside `engine_process` / `engine_state`. On successful apply, `apply_cascade()` emits domain events via `emit()` which flow through `engine_dispatch` like any other mutation. Cascade is the producer; the event engine is a consumer.

**Why:** Different lifecycle semantics. Preview/apply with staleness detection and framework gating is not the same pattern as linear step execution through `engine_state_step`. Forcing cascade into the event engine would create impedance mismatch.

### 3. season.is_active Boolean Dropped

The spec originally included `is_active BOOLEAN` on the season table. This was dropped because season already has a `status` enum (draft/active/archived). Adding a boolean would create dual-truth.

**Why:** Use `status = 'active'` instead. One source of truth for season lifecycle.

### 4. schedule_template_shift Gets workspace_id + Timestamps

The existing `schedule_template_shift` table was missing `workspace_id`, `created_at`, `updated_at` — standard columns in this codebase. These were added alongside the cascade fields.

**Why:** Codebase convention. All workspace-scoped tables need `workspace_id` for RLS. Existing rows may remain with null `workspace_id` until a dedicated backfill migration.

### 5. schedule_template.department TEXT Preserved

The existing `schedule_template.department` TEXT column is preserved alongside the new `department_id` UUID FK. The TEXT column is NOT dropped.

**Why:** Backwards compatibility. Existing data uses the TEXT column. A backfill migration will map TEXT values to department UUIDs. Drop criteria defined in `docs/cascade-backfill-plan.md`.

### 6. SHA-256 for State Hashing

Proposal freshness detection uses SHA-256 via Web Crypto API with deep key canonicalization. Not a weaker custom hash.

**Why:** Foundation contract. Staleness detection and audit trails depend on this hash. The hash format (`sha256:` + 64 hex chars) is part of the public API.

### 7. Integration Enums Predeclared in A2

Three integration enums (`external_provider`, `sync_direction`, `sync_status`) are created in the A2 migration even though their tables are deferred to A3.

**Why:** Stabilize enum ordering and avoid cross-phase enum migrations later.

### 8. Legacy Truth Containment

Legacy structures (`company_opening_hours`, `operating_hours`, `season.opening_hours`, `schedule_template.department`) are annotated as non-authoritative via SQL COMMENTs but NOT dropped. Runtime cutover checklist and legacy usage inventory created.

**Why:** Additive migration without reckless drops. Cleanup is an auditable program, not tribal knowledge. Drop criteria require: zero runtime reads/writes, backfill complete, smoke test passes, telemetry shows no access for one release window.

## Consequences

- 17 new tables + 16 new enums in the database
- 7 existing tables modified with new fields
- 4 Phase B pure functions with 29 tests
- Legacy structures classified and inventoried (6 must-refactor files identified)
- Docker/Supabase reset needed to validate all migrations run cleanly
- `derive_impacts()`, `compute_cascade_preview()`, `persist_change_proposal()`, `apply_cascade()` are NOT yet implemented

## References

- Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Plan: `docs/superpowers/plans/2026-03-21-cascade-core-foundation.md`
- STATE.md: Section 4.5
- Cutover checklist: `docs/cascade-runtime-cutover-checklist.md`
- Legacy inventory: `docs/cascade-legacy-usage-inventory.md`
- Backfill plan: `docs/cascade-backfill-plan.md`
