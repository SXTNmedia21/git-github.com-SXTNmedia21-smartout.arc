---
title: "Plan — audit-fdb11-adr-0287-enforcement"
feature: audit-fdb11-adr-0287-enforcement
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: cross-cutting
tags: [plan, audit, adr-0287, gate-action, enforcement, ci-lint, f-db-11]
---

# Plan — audit-fdb11-adr-0287-enforcement

> Branch: `feat/audit-fdb11-adr-0287-enforcement` | Worktree: `~/dev/smartout.ai-wt-6` | Module: cross-cutting

**Spec:** F-DB-11 from synthesis — ADR-0287 enforcement gap.

## Background

ADR-0287 (`gate_action mandatory on mutation capability tools`) accepted but enforcement missing for 20+ days:
- `scripts/gate-action-coverage.ts` does not exist
- `mutateWithGate()` helper does not exist
- `.github/workflows/gate-action-coverage.yml` does not exist

Result: every capability merge in the gap window can regress. ADR-0204 D6 mutation backlog grew 7→13 hooks between 2026-05-10 and 2026-05-13 — direct symptom of the missing enforcement.

Sister of ADR-0303 enforcement just shipped (A.3). Same pattern: rule-without-enforcement = recurring regression.

## Journeys

- [JOURNEY-audit-fdb11-adr-0287-enforcement-capability-without-gate-blocked-by-ci](../journeys/JOURNEY-audit-fdb11-adr-0287-enforcement-capability-without-gate-blocked-by-ci.md)
- [JOURNEY-audit-fdb11-adr-0287-enforcement-mutateWithGate-wraps-capability-write](../journeys/JOURNEY-audit-fdb11-adr-0287-enforcement-mutateWithGate-wraps-capability-write.md)
- [JOURNEY-audit-fdb11-adr-0287-enforcement-existing-capabilities-pass-baseline](../journeys/JOURNEY-audit-fdb11-adr-0287-enforcement-existing-capabilities-pass-baseline.md)

## Goal

Ship ADR-0287 enforcement: `mutateWithGate()` helper + `scripts/gate-action-coverage.ts` CI lint + workflow. Stop the bleed on ADR-0204 backlog.

## Tasks

- [ ] T1 Read ADR-0287. Audit existing `callGateAction` + `gatedMutation` patterns in `packages/ai/src/capabilities/`. Determine `mutateWithGate()` helper signature (likely wraps gate_action + emit + write in atomic block).
- [ ] T2 Implement `packages/ai/src/capabilities/_shared/mutate-with-gate.ts`. Vitest coverage.
- [ ] T3 Write `scripts/gate-action-coverage.ts` (TypeScript node script). Parses `packages/ai/src/capabilities/**/tools.ts` for `tool({...})` declarations; for each tool with `execute` body containing `.insert/.update/.delete/.upsert`, check for `mutateWithGate(` or `callGateAction(` call. Exit 1 on violators. Override via `// @gate-action-exempt: ADR-NNNN reason`.
- [ ] T4 Workflow `.github/workflows/gate-action-coverage.yml` on PR.
- [ ] T5 Lint baseline run: identify current capabilities passing/failing. Document in audit synthesis F-DB-11 closure note.
- [ ] T6 Update ADR-0287 frontmatter with enforcement ref + close in synthesis.

## Acceptance Criteria

- [ ] **S1** `packages/ai/src/capabilities/_shared/mutate-with-gate.ts` exists with helper + tests
- [ ] **S2** `scripts/gate-action-coverage.ts` exists, runs from CLI, exit 0 on clean / exit 1 on violation
- [ ] **S3** `.github/workflows/gate-action-coverage.yml` ships
- [ ] **S4** Self-test: insert a deliberately-violating capability tool fixture → script exits 1 with clear message
- [ ] **S5** Baseline run against current capabilities — document violators count (do NOT fail merge if violators exist; CI exits 0 but logs warnings). Strict mode = config flag.
- [ ] **S6** ADR-0287 status updated with enforcement reference
- [ ] **S7** Audit synthesis F-DB-11 → CLOSED
- [ ] **S8** Override mechanism documented in script header
- [ ] **S9** `pnpm turbo typecheck` 0 errors
- [ ] **S10** All 3 journeys verified

## Council triggers

- If ADR-0287 specifies a different helper name/signature than `mutateWithGate()` — match ADR text
- If `callGateAction` already covers the rule — clarify whether helper is new abstraction or rename

## Out of scope

- Migrating all existing capability tools to `mutateWithGate()` (separate sortie per namespace)
- Removing `callGateAction` legacy pattern (kept as transitional)
