---
title: "Migration atomicity — type-widen, introduce, tighten (0a/0b/0c pattern)"
id: LEARNING_0075
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [migration, typescript, refactor-discipline, breaking-change, each-commit-green]
---

# Learning-0075: Migration atomicity — type-widen, introduce, tighten (0a/0b/0c pattern)

## Context

Year Wheel Redesign Council (2026-04-20). The original spec's migration step 0 bundled three changes: (1) extend `CreateSeasonInput` type to require new fields, (2) update the INSERT to write them, (3) extend the telemetry event interface. The Supervisor Phase 3 review flagged this as non-atomic — typecheck would fail between step 0 and step 6 because the old `SeasonCreateSheet` callsite hadn't been updated yet to pass the newly-required fields.

## Discovery

When a refactor tightens a type or API, every commit between the tighten and the last callsite update is broken. "Each commit typecheck-clean" (Smartout's `pnpm turbo typecheck` gate) forbids this — but specs often collapse the work into a single "extend the type and all its consumers" step without noting the intermediate failure.

The solution is **three-step atomicity**:

- **Step Na — tolerant widen.** Extend the type with new fields as **optional** (`field?: T`). Every existing callsite keeps compiling without change. New callsites can start passing the new fields immediately.
- **Step Nb — introduce new callsites.** Build the new UI/hook path. It passes the new fields. Old callsites still work.
- **Step Nc — tighten.** Once the old callsite is retired (or rewritten), make the field required. Typecheck now enforces the new contract; no callsite is broken because the retired one is gone.

Each step is typecheck-clean. `git bisect` works across the window. A rebase halfway through doesn't land in a broken tree.

## Impact

### Rule

For any type-widening that will eventually be tightened:

1. **Start optional.** Never land the tighten and the new callsite in the same commit.
2. **Introduce the new caller next.** Let it use the new fields.
3. **Tighten last** — only after the last consumer of the old shape is gone.

### How to apply

- Spec-writing phase: when a migration step says "extend `X` to require `Y`", ask "does the old callsite exist? If yes, split the step."
- Council Phase 3 supervisor review: flag any single migration step that both widens and tightens as non-atomic.
- During execution: if typecheck fails between commits in a migration sequence, the sequence is non-atomic; stop and re-order.

### Why promoted

The Year Wheel council caught this on an otherwise well-structured 8-step migration. The author (me, as orchestrator) collapsed 0a/0b/0c into a single "step 0" because the final state looked clean. Supervisor's discipline forced the split. Promoting as a named pattern so future migration specs inherit the shape without the review round-trip.

### Examples

- 2026-04-20 Year Wheel §11 (corrected): step 0a widens `CreateSeasonInput` with optional `color`, `planningCycleId`; step 0b registers telemetry; step 0c tightens after step 6's new sheet is live.
- Any API payload addition to a shared type should follow the same.
- Counter-example: `CreateSeasonInput` widening is safe because the column is already nullable. When the underlying DB schema changes (NOT NULL drop or add), the pattern still applies but the migration order has to account for the schema rewrite too.

## References

- Spec: `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` §11
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-20 session
- Related: "each commit typecheck-clean" project convention (CLAUDE.md "pnpm turbo typecheck" rule)
