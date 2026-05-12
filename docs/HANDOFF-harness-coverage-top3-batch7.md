---
title: "Harness Coverage Top-3 Batch 7 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, availability, contract-intake, guardian]
---

# Harness Coverage Top-3 Batch 7 — HANDOFF

## What was built

Three new E2E harness specs covering 3 capabilities × 3 tools each = +9 tools, 58 new test() calls.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/availability-harness-e2e.spec.ts` | 3 tools (set_own, clear_own, query_others) | 21 tests · 2 voice skip |
| `apps/e2e/tests/contract-intake-harness-e2e.spec.ts` | 3 tools (submit_field_group, decline_intake, get_intake_progress) | 17 tests · 0 hard skip · PII-echo invariant enforced |
| `apps/e2e/tests/guardian-harness-e2e.spec.ts` | 3 tools (get_signals, acknowledge_signal, get_workspace_health) | 20 tests · 1 voice skip · gate gap documented |

Coverage now 19/29 capabilities (65%), 83/127 tools (65%).

## Decisions

### D1: Pre-seed guard on availability A5
Availability `set_own_availability` allows LLM to choose `preference_type` ∈ {`unavailable`, `preferred`, `not_preferred`}. A4-DB captures the created `availability_id` only if LLM chose `unavailable`. If LLM chose another preference_type, A4-DB capture fails but A5 (clear_own) still needs a target. Pre-seed guard inserts an `unavailable` row directly if capture failed. Prevents cascade.

### D2: contract-intake dual-path tolerance
`defaultAuthority='read_only'` for write tools (`submit_field_group`, `decline_intake`). Gate may block writes unless `engine_authority_config` row grants `autonomous`/`suggest`. Tests accept BOTH gate-blocked structured JSON path AND success path — what matters is the pipe reached L4 + tool_call recording row written.

### D3: PII non-echo invariant for contract-intake
`assertNoPiiInIntakeResponse` runs on every contract-intake response (I1–I3, N2, N3, M1). Asserts banking group `bank_account` value NEVER appears in assistant text response. Sharpest unique risk for this capability per ADR-0163.

### D4: Guardian `acknowledge_signal` gate gap
`acknowledge_signal` lacks `gate_action` call (G3 pattern observed in other capabilities). Spec exercises pipe end-to-end regardless and flags gap in header. Out of scope for E2E sortie — separate capability-fix sortie required.

### D5: Guardian dual workspace_health state
A9–A12 verifies aggregate response when signals exist. A13–A16 verifies `overall='healthy'` when no signals. Both paths must work.

### D6: Lint-staged stash bundled guardian into contract-intake commit
Guardian files (`guardian-harness-e2e.spec.ts` + `guardian-harness.ts`) committed in SHA `c96db4f4d` alongside contract-intake files. Commit message misleading but git history sound — both files present + tracked. Not splitting.

## Learnings

### L-B7-1: Dotted capability authority granularity
Availability uses dotted capability names (`availability.set_own`, `availability.clear_own`, `availability.query_others`) in `engine_authority_config`, NOT just `availability`. Migration seeds at exact granularity. Tests must assert `engine_authority_config` row exists at dotted slug, not parent capability.

### L-B7-2: `availability.queried` routes to activity_trail only (no engine_event)
Per L-0023, read-only `query_others_availability` emits `availability.queried` to 3 destinations including activity_trail but NOT engine_event. Test asserts on activity_trail only.

### L-B7-3: 10s/500ms recorder-flush polling for DELETE assertions
`clear_own_availability` DELETE assertion can race with recorder flush. Use poll pattern: 10s timeout, 500ms interval. Consistent with base harness pattern.

## Known issues / debt

1. `acknowledge_signal` lacks `gate_action` — separate capability-fix sortie required.
2. Voice channel guard universally skipped across all 3 specs (LiveKit not driveable in Playwright CI).
3. Guardian signal pre-seed depends on service-role permission in CI — A6/A7/A8/S2 conditionally skip if seed fails.
4. Contract-intake `defaultAuthority='read_only'` means happy-path write tests are dual-path — gate-blocked is acceptable. Tightening to mutation-success requires `engine_authority_config` seed update.

## Next steps

1. Merge to development.
2. Refresh coverage matrix v4 → 19/29 = 65% (DONE in `b81c31855`).
3. Coverage post-batch-7: 19/29 capabilities = 65%, 83/127 tools = 65%.
4. Next top-3: journey-authoring (4), shift-swap (5), ui (5). Three left after that: kb_query (1), operations-intelligence (1).
5. Address `acknowledge_signal` gate gap as separate sortie (apply G3 pattern).

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md through -batch6.md
- ADR-0078, ADR-0099, ADR-0116, ADR-0151, ADR-0163 (PII allowedChannels), ADR-0202 (channel guard layers)
- L-0023, L-0097 (channel guard L1+L2)
