---
title: "Harness Coverage Top-3 Batch 6 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, communication, business-intelligence, journey]
---

# Harness Coverage Top-3 Batch 6 — HANDOFF

## What was built

Three new E2E harness specs.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/communication-harness-e2e.spec.ts` | 8 tools incl. send_message | 35 tests, 1 voice skip + conditional |
| `apps/e2e/tests/business-intelligence-harness-e2e.spec.ts` | 6 tools across readOnly + suggest tiers | 27 tests, 69 expects, 1 voice skip |
| `apps/e2e/tests/journey-harness-e2e.spec.ts` | 4 runtime journey tools | 20 tests, 3 skip-by-design + 2 soft-skip |

## Decisions

### D1: Coverage matrix tool count drift
Communication actually has 8 tools registered, not 5 (coverage matrix v2 had 5). Refresh matrix during post-merge sync.

### D2: gate_action NEVER called by BI tools
business-intelligence tools never invoke gate_action — they are pure data fetch (BRREG, scrapling). M1 assertion verifies absence. Different pattern from helpdesk/shift-lifecycle (which DO call gate_action).

### D3: ADR-0194 Gate blocks happy-path mission run_guided
publish_mission creates engine_missions row with is_active=false. run_guided requires active mission. Happy path needs separate activateMissionAction call. Spec asserts graceful no_active_mission path instead — correct CI behaviour.

### D4: communication compile tools require active department
compile_day_brief + compile_preclose_summary skip if seed workspace has no active department session. Documented condition.

## Known issues / debt

1. Coverage matrix tool counts drift over time — needs periodic refresh.
2. ADR-0194 Gate — publish_mission + activateMissionAction split means happy-path E2E requires two-step orchestration not covered by spec.
3. Voice channel guard tests universally skipped across all 3 specs.
4. Scrapling unreachable tolerated — assertions check pipe not data quality.

## Next steps

1. Merge to development.
2. Refresh coverage matrix v3:
   - communication: 8 tools (not 5)
   - business-intelligence + journey: 🟡
3. Coverage post-batch-6: 16/29 capabilities = 55%, 74/124 tools = 60%
4. Next top-3: guardian (3), kb_query (1), journey-authoring (4). Or jump to last bucket (availability, contract-intake, operations-intelligence, ui).

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md through -batch5.md
- ADR-0078, ADR-0099, ADR-0151, ADR-0116, ADR-0194 (journey publish gate)
