---
title: "Journey — quota-burn vector closed in audit synthesis"
feature: audit-fef03-intelligence-ef-auth
journey: quota-burn-vector-closed
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: edge-functions
tags: [journey, audit, governance, closure]
---

# Journey: Audit synthesis F-EF-03 marked CLOSED + telemetry alert

**Role:** auditor running next `/audit smoke` after this sortie merges

**Precondition:** This sortie merged to development. Audit 2026-05-13 synthesis updated by T3.

## Happy Path

1. Audit runner reads `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`
2. F-EF-03 row shows "CLOSED 2026-05-13 by feat/audit-fef03-intelligence-ef-auth"
3. Next `/audit smoke` slice 03 (edge-functions) does NOT re-flag F-EF-03
4. Telemetry dashboard (or registry confirmation) shows `edge_function.auth_failure` event live
5. Trend log appended with closure entry

**Postcondition:** Audit baseline 2026-05-13 closed_count incremented. Promote-safety regained on this dimension.

## Error Paths

- **Audit slice 03 re-flags despite synthesis CLOSED** — synthesis update + code drifted. Re-run T5 grep + verify deployment.
- **Telemetry event never fires (production)** — auth perimeter actually accepts everything (logged failure but allowed). Re-test in prod.

## Verification

- [ ] Synthesis F-EF-03 row has CLOSED notation
- [ ] Telemetry registry has `edge_function.auth_failure` (packages/telemetry/src/registry.ts)
- [ ] /audit smoke re-run by E6 verifier returns 0 NEW finding on slice 03

**Mark `status: verified` when all three checked.**
