---
title: "Harness Coverage Top-3 Batch 2 — HANDOFF"
status: done
updated: 2026-05-11
created: 2026-05-11
module: ai
tags: [e2e, harness, coverage, contract, onboarding, shift-lifecycle]
---

# Harness Coverage Top-3 Batch 2 — HANDOFF

## What was built

Three new E2E harness specs covering the next-three-leverage capabilities.

| Spec | Tools (read-side) | Tests / Skips | Notes |
|------|-------------------|---------------|-------|
| `apps/e2e/tests/contract-harness-e2e.spec.ts` | list_employee_templates, list_employee_contracts, check_contract_status, explain_contract_clause, get_compliance_drift_for_contract | 20 positive + 3 negative + 3 skip-by-design | DocuSeal mutation tools tracked as gaps |
| `apps/e2e/tests/onboarding-harness-e2e.spec.ts` | update_business, update_season, add_departments, add_locations, add_procedures | 7 tests, 39 expects | Workspace snapshot/restore pattern. Scrapling/BRREG tools skipped (infra) |
| `apps/e2e/tests/shift-lifecycle-harness-e2e.spec.ts` | publish_shift, approve_shift, get_shift_lifecycle | 13 tests across 4 describe blocks | Two-level gate verified (router + tool). interpret_shift + settle_shift system-channel-only |

## Decisions

### D1: Parallel dispatch reuse — three agents, one worktree
Same pattern as batch 1 (wt-8). Each agent owns one spec + one helper file. No file collisions. Total wall-clock ~17 min for three full specs.

### D2: PII non-leak assertions are first-class
Contract spec adds explicit `contract.pii.revealed` activity_trail check with `revealed=false` for view_personal_number / view_bank_account class. Pattern carried forward from payroll spec.

### D3: Workspace snapshot/restore for onboarding mutations
Onboarding tests mutate workspace.name + workspace.niche. Spec snapshots in beforeAll, restores in afterAll. Cleanup is non-destructive of the seed row itself.

### D4: System-channel tools require dedicated routing
interpret_shift + settle_shift are `channel: "system"` only. BFF chat route hardcodes `channel: "chat"`. Cannot exercise via current BFF without either:
1. Admin system-channel API route
2. Phase 4 engine-dispatch support in test harness

Both tools tracked as SL-SKIP-1 + SL-SKIP-2 with remediation paths.

### D5: Gate verification is two-level
Per architectural fact from batch 1: `gate_action` fires at router level for every turn. Shift-lifecycle spec verifies:
- Router-level: ≥1 `gate_evaluation` row per turn for `capability='shift_lifecycle'`
- Tool-level: row with specific `action_type` ('publish_shift', 'approve_shift')

Soft-skip when LLM doesn't call the expected tool (clarification path is valid). Hard-fail when row exists but `allow=false` or wrong actor.

## Known issues / debt

1. DocuSeal mutation tools (create_employee_contract, send_employee_contract) not covered. Existing `journey-employee-contract-e2e.spec.ts` uses mocked service. Gap: contract-create-e2e-docuseal-mock.
2. Template lifecycle tools (fork_template, publish_workspace_template, deprecate_workspace_template) covered in `e2e-contract-template-maler.spec.ts`. Reconcile naming with harness pattern in next sortie.
3. Onboarding scrapling/BRREG tools require service availability + auth token. Gap: onboarding-scrapling-e2e (mock service).
4. shift-lifecycle system-channel tools — design decision needed before E2E (D4).
5. Coverage matrix needs refresh after merge. Will update `apps/e2e/coverage.md` post-merge.

## Next steps

1. Merge to development.
2. Refresh `apps/e2e/coverage.md`: status flips for contract/onboarding/shift-lifecycle.
3. Next top-3 (suggested): mission (2 tools), profile (4 tools), operations (5 tools). Mission + profile are high-frequency invocations.
4. Future: mock DocuSeal service for contract write-tools.
5. Future: heartbeat job that scans capability registry vs `apps/e2e/tests/*-harness-e2e.spec.ts` filenames → alert on drift.

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Shared helper: `apps/e2e/helpers/botsson-harness.ts`
- Batch 1 HANDOFF: `docs/HANDOFF-harness-coverage-top3.md`
- ADR-0078 — channel guard layers
- ADR-0099 — capability authority gate (router + tool levels)
- ADR-0116 — `botsson.tool_invoked` telemetry contract
- ADR-0151 — server-derive workspace_id + profile_id
