---
title: "L-0293 — Denormalized cache + canonical lifecycle pattern when hot-path-read field is load-bearing for golden-case determinism"
id: LEARNING_0293
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [architecture, cascade, payroll, denormalization, trigger-sync, golden-month, determinism]
related: [ADR-0355, ADR-0341, ADR-0076, L-0147, L-0294]
---

# Learning-0293: Denormalized cache + canonical lifecycle pattern when hot-path-read field is load-bearing for golden-case determinism

## Context

Council 2026-05-17 Phase 7d-followup Gap 4 — `payroll.workspace_settings.is_tariff_bound`
(boolean) vs proposed `active_union_id` (text) redundancy. Three options considered:

- (a) Drop `is_tariff_bound` and derive from `active_union_id`
- (b) Keep both with CHECK constraint preventing invalid state
- (c) Deprecate `is_tariff_bound` with downstream calc-engine refactor

Steward Phase 3 chose (a) on cascade invariant #2 grounds (one role per datum). Phase 5
REVERSED to (b) per code-tracer evidence.

## Discovery

Option (a) — "derive everything from canonical lifecycle table" — breaks the golden-month
determinism contract. Falsifying evidence cited by the payroll-engine code-tracer:

- `golden-month.test.ts:81` casts `workspace_settings.json` fixture to `WorkspaceSettings`
  type with `is_tariff_bound: true`
- `evaluate-supplements.ts:328` reads `workspaceSettings.is_tariff_bound` in the hot calc
  path
- `deviation-checks.ts:458,476,501` — three additional readers

Removing `is_tariff_bound` requires updating the fixture + 4 call sites + every test that
depends on the type shape. Golden-case principle (payroll-engine non-negotiable #4) protects
EXACTLY this kind of determinism — fixture inputs frozen, engine output reproducible
bit-exact.

**Pattern — when to apply denormalized cache + canonical lifecycle:**

When a denormalized field on a hot-read table is load-bearing for fixture determinism AND a
new canonical lifecycle table is needed:

1. Keep the denormalized field on the hot-read table (zero refactor of fixture + engine call
   sites)
2. Add the canonical lifecycle table (provenance, audit, history)
3. Add trigger on lifecycle table INSERT/UPDATE that maintains the denormalized field as a
   TRIGGER-SYNCED CACHE
4. Add table-level CHECK constraint on the hot-read table preventing invalid state
   (e.g. `is_tariff_bound = true AND active_union_id IS NULL`)
5. Document the relationship explicitly: denormalized field is CACHE; canonical lifecycle
   table is TRUTH. Future reads can use either; writes go through delegation tool to lifecycle
   table; cache is auto-maintained by trigger.

**Counter-example — when NOT to apply this pattern:**

If the hot-read field is NOT in a fixture-determinism contract, drop the denormalization.
Single-source-of-truth is the correct default. This pattern is an EXCEPTION for cases where
the golden-case contract gates the change.

**Cascade invariant relationship:**

Cascade invariant #2 (one role per datum) is preserved in PRINCIPLE — the canonical role is
on the lifecycle table; the cache is explicitly typed as derived. The pattern is "denormalized
cache" not "duplicate truth" — semantic distinction matters for future architects reading
schema comments.

**Worked example from this council:**

`payroll.workspace_settings.is_tariff_bound` (cache) + `public.workspace_union_binding`
(canonical lifecycle) per ADR-0355. Trigger on `workspace_union_binding` INSERT/UPDATE
syncs cache. CHECK on `workspace_settings` prevents invalid cache state. Engine + fixtures
unchanged.

## Impact

Document as cascade-integrity addendum. Apply when:

- (a) Introducing a canonical lifecycle table, AND
- (b) An existing hot-read field on a sibling table is in a fixture-determinism contract

When both (a) and (b) are true, use the cache + lifecycle + trigger + CHECK pattern rather
than removing the denormalized field.

If (a) without (b): standard normalization — remove the redundant field and consolidate.

## References

- ADR-0355 (worked example — `workspace_union_binding` lifecycle + cache-trigger pattern)
- ADR-0341 (golden-case test oracle contract — the determinism principle that gates this
  pattern)
- ADR-0076 (cascade snapshot-and-forward — related but different scope: snapshot propagation
  vs cache synchronization)
- L-0147 (chair self-reversal — Gap 4 is the 7th occurrence; option (a) was the Phase 3
  verdict that Phase 5 reversed per code-trace evidence)
- L-0294 (7th L-0147 precedent — documents this Gap 4 reversal in the precedent table)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
