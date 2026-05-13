---
title: "Journey — Capability without gate_action blocked by CI"
feature: audit-fdb11-adr-0287-enforcement
journey: capability-without-gate-blocked-by-ci
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: cross-cutting
tags: [journey, adr-0287, ci, lint, enforcement]
---

# Journey: Developer ships capability tool without gate — CI blocks

**Role:** developer authoring new capability tool in `packages/ai/src/capabilities/`

**Precondition:** ADR-0287 enforcement shipped. `scripts/gate-action-coverage.ts` + workflow active.

## Happy Path

1. Developer writes tool with `.insert()` / `.update()` / `.delete()` in execute body, no `mutateWithGate(` or `callGateAction(` call
2. PR opens
3. CI runs `scripts/gate-action-coverage.ts`
4. Script finds tool body has mutation without gate wrapper
5. Exits 1 with: `ADR-0287: tool <name> at <file>:<line> mutates without gate. Wrap in mutateWithGate() or add // @gate-action-exempt: ADR-NNNN`
6. PR blocked. Developer rewires.

**Postcondition:** No new capability tool can ship without gate_action.

## Verification

- [ ] `scripts/gate-action-coverage.ts` exists + CLI-runnable
- [ ] Bad fixture → exit 1
- [ ] Override annotation respected
- [ ] Current capabilities baseline pass/warn count documented

**Mark verified when all checked.**
