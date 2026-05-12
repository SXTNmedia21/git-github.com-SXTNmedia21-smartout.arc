---
title: "Harness Coverage Top-3 Batch 5 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, engine-world, personal, training]
---

# Harness Coverage Top-3 Batch 5 — HANDOFF

## What was built

Three new E2E harness specs.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/engine-world-harness-e2e.spec.ts` | read_surface, read_surface_class, report_observation | 18 blocks, 16 pass + 2 skip (N1 second-workspace, N3 voice) |
| `apps/e2e/tests/personal-harness-e2e.spec.ts` | add_note, create_task, set_reminder, get_history, update_setting | 21 tests, ~40 expects, A16 skip (history routes posthog+logger only) |
| `apps/e2e/tests/training-harness-e2e.spec.ts` | get_my_training_status, get_next_protocol, get_team_readiness | 17 tests across 3 suites, N1 voice skip + A9-A12 conditional |

## Decisions

### D1: Authority lifecycle scoped per-spec
Training spec seeds `get_team_readiness` authority in beforeAll, restores in afterAll. Non-destructive to other tests' authority state.

### D2: Empty-state via SEED_PROFILE_ID natural
SEED_PROFILE_ID (owner) has 0 protocol_assignment rows. Training spec uses this as natural N2 (zero-assignment) subject — no special fixture needed.

### D3: DB sanity independent of LLM
Training spec adds standalone DB sanity suite (S1–S3) verifying seed preconditions BEFORE LLM chain runs. Failures diagnosable without full E2E.

### D4: posthog-logger-only routing is not a bug
personal `get_history` routes telemetry to posthog + logger but NOT activity_trail (per registry). A16 documented as gap, not failure. Same pattern likely on other read-only tools.

## Known issues / debt

1. `personal-history-activity-trail-emit` gap — read-only history queries don't write activity_trail. Decision-of-record needed: is this intentional (read-only no audit) or oversight?
2. Voice channel guard tests universally skipped — Playwright cannot drive LiveKit. Unit tests cover.
3. Cross-workspace tests (N1) skip in single-workspace seed environments.

## Next steps

1. Merge to development.
2. Refresh `apps/e2e/coverage.md`: engine-world/personal/training → 🟡
3. Coverage post-batch-5: 13/29 capabilities = 45%, 56/124 tools = 45%
4. Batch 6 in flight: communication + business-intelligence + journey

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md, -batch2.md, -batch3.md, -batch4.md
- ADR-0078, ADR-0099, ADR-0151, ADR-0116, ADR-0163
