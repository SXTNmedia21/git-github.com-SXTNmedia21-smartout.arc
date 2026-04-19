---
title: "Phase Enum UI-vs-DB Drift — Use Named Derivation Helpers"
id: LEARNING_0064
status: canonical
layer: learning
created: 2026-04-19
updated: 2026-04-19
tags: [cascade, enum, ui, database, derivation, orphan-state]
---

# Learning-0064: Phase Enum UI-vs-DB Drift

## Context

Council 2026-04-19 reviewed the WebDayControl panel spec. The design prototype rendered **six** phase states: `upcoming | active | pending_signoff | closed | missed | locked`. The DB enum `department_session_status` has **five**: `upcoming | active | pending_signoff | closed | missed`.

`locked` does not exist in the DB. It represents "reconciliation has been finalized and the day cannot be re-opened" — a combined state of `department_session.status = 'closed'` + `daily_reconciliation.locked = true`.

This is a classic orphan-state pattern: the UI enriches a DB enum with states the DB doesn't know about. If rendered inline inside widget code (e.g., `status === "closed" && recon.locked ? "locked" : status`), the enrichment rule leaks into every widget, drifts across call sites, and becomes un-testable.

## Discovery

UI-vs-DB enum drift is **acceptable** when:
- The UI state is genuinely a derivation of persisted state from multiple sources.
- The derivation lives in ONE named helper, not inline.
- Every widget consumes the derived type, never the raw DB type.

UI-vs-DB enum drift is **orphan state** when:
- The UI invents a state the DB cannot reconstruct (e.g., "highlighted", "selected-today") and leaks it across components.
- Inline ternaries reproduce the derivation rule in multiple files.
- Storage layer tries to persist the UI-only value (e.g., "locked" gets written to `session.status`).

The Steward's rule: every datum has exactly one role. A derivation is fine if named; it's orphan state if inlined or persisted.

## Impact

When a UI component consumes a richer enum than its underlying DB enum:

1. **Create a helper** in a shared location (`packages/utils/src/cascade/` for Smartout).
2. **Export a derived TypeScript type** (e.g., `UiPhase`) — never export the raw DB type to UI code.
3. **Components accept only the derived type** as a prop. No component takes raw `session.status`.
4. **Tests for the helper** cover every input state combination.
5. **Never persist the derived value.** Lock is computed at read time, not stored.

Applied to WebDayControl (ADR-0156):
- Helper: `derivePhase(session, recon) => UiPhase` in `packages/utils/src/cascade/derive-phase.ts`
- Widgets consume `phase: UiPhase`
- No migration for `department_session_status` enum

Applied broadly: whenever a widget library needs a richer state space than the DB provides, treat the enrichment as derivation. If the derivation cannot be expressed as a pure function of persisted state from identified sources, the design has an orphan — go back to the DB and add the state there.

## References

- ADR-0156 — Day-Control Panel as Canonical D6 Admin Surface
- ADR-0157 — Server Actions Scope Amendment
- SPEC_WEB_DAY_CONTROL_IMPL_2026_04_19 §3 — Phase derivation rule
- Cascade invariant: "every datum has exactly one role" — `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Council session 2026-04-19 — `docs/council/COUNCIL-LOG.md`
