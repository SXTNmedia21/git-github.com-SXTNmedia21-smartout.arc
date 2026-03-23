## System Steward Memory Index

### Cascade Core

- [cascade-integrity-mandate.md](cascade-integrity-mandate.md) — Core mandate: enforce system ontology and causal integrity, not just compliance. Eight invariants, five meaning layers, six required verification artifacts. Updated 2026-03-22.
- [cascade-enforcement-checklist.md](cascade-enforcement-checklist.md) — Operational checklist for verifying plans against Cascade Core Foundation (I1+6D+4C+K1a/K1b). Terminology table, key references.
- [cascade-review-findings.md](cascade-review-findings.md) — Current implementation status aligned to `docs/STATE.md`: Phase A done, Phase B 4/6, Phase C partial, active conflicts and bootstrap gaps, wrong hospitality rates.
- [cascade-claudemd-rewrite-assessment.md](cascade-claudemd-rewrite-assessment.md) — Block full CLAUDE.md rewrite until Phase C. Concepts that don't map to cascade. Active traps.

### Test Infrastructure

- [test-coverage-map.md](test-coverage-map.md) — Playwright E2E test coverage map: what's tested, what's missing, known fake tests, seed helper gaps.

## Quick Reference: Cascade Red Flags

- **Side logic**: Any plan creating business logic beside cascade → reject unless ADR-justified
- **Ambiguous roles**: Entity that can't declare source/derived/proposal/execution/audit → plan incomplete
- **Hidden derivation**: Derived state depending on UI state or ephemeral services → reject
- **Domain in Event Engine**: Cascade reasoning in event handlers → reject
- **Permission-truth blur**: C4 flags mixed into C1 domain state → reject
- **Orphan concepts**: Helper statuses, temp scores, unclear draft modes → flag for lifecycle justification
- **Bootstrap bypass**: New cascade consumers before I1 bootstrap is wired into workspace creation → flag as incomplete

## Quick Reference: Canonical Control Gate

- **Telemetry truth**: `packages/telemetry/src/registry.ts` + `packages/telemetry/src/emit.ts`
- **AI runtime truth**: `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`
- **Cascade boundary**: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` + `docs/decisions/0056-cascade-core-foundation-schema.md`
- **Phase status / blockers**: `docs/STATE.md`
- **Forward-looking superpowers docs**: useful for intended direction, but not current truth until landed

## Quick Reference: Test Red Flags

- **Fake telemetry test** in `journey-website-factory.spec.ts:368-395` — string truthiness, not real DB check
- **No cascade seed helpers** in `helpers/seed.ts` — blocks cascade journey tests
- **Performance gates are partial** — `performance-gates.spec.ts` covers schedule and season headings, but not deeper cascade interactions like day control open time or season tab switching
- **waitForTimeout abuse** in `cascade-ui.spec.ts` — fragile, replace with element waits
