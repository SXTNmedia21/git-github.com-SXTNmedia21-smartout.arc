---
title: J-33 Contracts hub + bindings + send + sign + composition + drift + reverse + workspace-fork
status: BLOCKED (cascade in initial run, rerun in flight)
journey_docs:
  - JOURNEY-client-contract.md
  - JOURNEY-contract-module.md
  - JOURNEY-contract-preview-editor.md
  - JOURNEY-contract-binding-auto-seed.md
  - JOURNEY-contract-enhancements.md
  - JOURNEY-contract-composition-engine.md
  - JOURNEY-contract-signed-active-cascade.md
  - JOURNEY-cascade-drift-observability.md
  - JOURNEY-dashboard-redesign.md (contract hub)
spec: apps/e2e/tests/contracts/ (10 spec files, 26 tests)
result_initial: 0 passed / 21 failed / 2 skipped / 3 did not run (cascade — web died at first test)
result_rerun: pending (run-37)
evidence: ../evidence/run-33-contracts-tests.log + run-37-contracts-rerun.log
---

# J-33 Contracts (extended) — RERUN IN FLIGHT

Largest single batch in sweep — 26 tests across 10 specs. Initial run failed wholesale (web OOM mid-batch, ERR_NETWORK_CHANGED first test). Rerun underway.

## Specs covered
- bindings-tab — admin manages bindings matrix + CRUD
- bulk-send — bulk envelope + zod gates
- cascade-drift-observability — MalerTab amber chip → DriftDiffDrawer
- composition-drawer — Lag kontrakt CTA + ESC close
- employee-contract-cancel — admin cancels with confirm dialog
- employee-contract-create — composition flow
- employee-contract-send — POST /api/employment-contracts/[id]/send
- employee-contract-sign — DocuSeal webhook → signed
- hub-redesign — single-pane bucket sub-tabs + chip + telemetry
- preview-editor — Bekreft step (step 4) bundle load
- reverse-flow — /people/[id] → /contracts?open=compose
- workspace-template-fork — POST /api/contract-templates/copy

## Action
Pending rerun result.
