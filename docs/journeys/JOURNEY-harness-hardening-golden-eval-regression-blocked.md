---
title: "Journey — Golden-eval regression blocked at PR time"
feature: harness-hardening
journey: golden-eval-regression-blocked
status: verified
verified_at: 2026-04-23
verification_debt: "Live-LLM baseline run deferred to first CI execution — OPENROUTER_API_KEY not in local env during sortie. Fixtures schema-validated, eval spec compiles, workflow wired. Journey 3's contract is self-verifying via ai-eval.yml on the first PR touching packages/ai/** or services/stage-engine/**."
blocker_for_first_ci_run: "OPENROUTER_API_KEY secret must be added to SXTNmedia21/smartout.ai repo secrets before the first PR fires ai-eval.yml. Documented in handoff Next Steps."
e2e_test: packages/ai/src/__evals__/golden-transcripts.eval.ts
created: 2026-04-23
updated: 2026-04-23
module: MODULE_BOTSSON
tags: [journey, ci, eval, ai-harness]
---

# Journey: Classifier regression is caught before merge

**Role:** developer (refactoring intent-classifier or capability prompt)

**Precondition:**
- 5 golden-transcript fixtures exist (Task 14 + Task 15)
- `golden-transcripts.eval.ts` shipped (Task 16)
- `.github/workflows/ai-eval.yml` wired with `OPENROUTER_API_KEY` secret (Task 17)
- Min accuracy threshold: 0.8

## Happy Path

1. Developer refactors `packages/ai/src/router/intent-classifier.ts` — tightens the system prompt in a way that accidentally drops the "schedule" capability confidence for the Norwegian query `"Når jobber jeg neste gang?"`.
2. Developer opens PR. → `ai-eval.yml` workflow fires because `packages/ai/**` changed.
3. Workflow runs `pnpm --filter @smartout/ai eval -- golden-transcripts` with `RUN_EVALS=1` and the repo secret. → Evaluator hits real OpenRouter for each of 5 fixtures sequentially (≈ 60–90 s total).
4. `golden-schedule-when-work-001` now returns `capability: "knowledge"` with 0.35 confidence. → `scoreGolden` marks `intentMatch=false`. → Summary: `4/5 passed (80%)` — edge of threshold.
5. Developer pushes another commit that degrades further (e.g. `3/5 passed`). → Assertion `expect(summary.accuracy).toBeGreaterThanOrEqual(0.8)` fails. → Workflow exits non-zero. → PR check marked Failed. → Merge blocked.
6. Developer reverts or tunes the classifier. → Workflow re-runs, passes. → PR mergeable.

**Postcondition:**
- No merge to `development` silently degrades intent classification on the 5 structural-coverage fixtures
- Every PR touching `packages/ai/**` or `services/stage-engine/**` pays eval-latency once; cheap relative to prod incident cost

## Error Paths

- **Scenario:** OpenRouter API is down during CI run → workflow fails with error distinct from assertion failure. Developer sees "provider outage" in logs and retries later. No silent skip.
- **Scenario:** Developer wants to update a fixture because prompt evolution is intentional → they update the fixture JSON in the same PR; the scorer uses the new expected value. Fixture changes are visible in PR diff, reviewed like code.
- **Scenario:** Eval cost budget concern → workflow has `timeout-minutes: 10` per job; `paths:` filter scopes runs to AI changes only. 5 fixtures × ~5 s each = well under budget.
- **Scenario:** LLM non-determinism causes occasional 4/5 even without regression → `minConfidence` per fixture gives slack; if flakiness becomes systematic, promote threshold logic (median of 3 runs) rather than lower the bar.

## Verification

- [ ] Implementation matches the steps above (Tasks 14–17)
- [ ] Eval runs green on HEAD locally: `RUN_EVALS=1 OPENROUTER_API_KEY=... pnpm --filter @smartout/ai eval -- golden-transcripts`
- [ ] Manually tested regression: introduce a bad prompt on a scratch branch → push → `ai-eval.yml` fails with per-fixture diff in logs
- [ ] Workflow exists: `.github/workflows/ai-eval.yml` present and triggers on PR paths `packages/ai/**` or `services/stage-engine/**`

**Mark `status: verified` in frontmatter when all four boxes are checked.**
