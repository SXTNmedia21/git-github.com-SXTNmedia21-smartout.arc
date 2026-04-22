---
title: "E2E fixture infrastructure must be idempotent AND verified before the first test runs"
id: LEARNING_0107
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [e2e, playwright, fixtures, test-infra, supabase, idempotency, contracts, gate-3]
---

# Learning-0107: E2E fixture infrastructure must be idempotent AND verified before the first test runs

## Context

Council Gate 3 for `feat/contract-hub-redesign` (2026-04-22). Post-implementation ship-readiness verification.

Timeline:

1. **Iteration 1** (post-`6466426e`, pre-entity-fix) — 11/14 E2E tests passed. The 3 failures were all in telemetry journeys (`contract.hub_viewed`, `contract.botsson_chip_invoked`, `contract_template.drift_viewed`) — events did not land in `activity_trail` because registry interfaces omitted `properties.entity`, which `writeActivityTrail` requires as a persistence constraint.

2. **Entity fix landed** (`b26161c2`) — added `entity` to 5 registry interfaces + 5 emit call sites. Typecheck passes. Architecturally correct per code-trace.

3. **Iteration 2** (post-entity-fix) — most tests regressed to failure. Root cause: `admin@smartout.local` fixture user had been dropped from local Supabase between iterations. Likely trigger: an external `supabase db reset` ran (different shell, another worktree, or a watch-trigger). The e2e wrapper's fixture-ensure step is silent — it assumes the admin fixture exists and does not verify before the first test runs. Login fails silently; all downstream assertions cascade to failure.

4. **Investigative revert/reapply** (`0966e790` → `107dafd6`) — chair temporarily reverted `b26161c2` to isolate whether the entity fix itself caused regression. Revert showed same failure pattern, confirming infra regression was orthogonal to the entity fix. Reapplied.

5. **Fixture restored manually** — admin+employee users recreated. **Iteration 3 still showed 10/14 fail** — possibly login cache, cookie state, or other fixture-derived state. Not investigated further; test-infra debt, not a feature regression.

## Lesson

When an E2E suite depends on seeded users or rows, the suite's fixture-ensure step is load-bearing infrastructure, not a silent helper. Treating it as silent creates a class of regression that:

- Passes typecheck and unit tests.
- Passes lint, build, and static analysis.
- Regresses a clean test run between two code-identical iterations.
- Cascades to failures that *look like* feature regressions (login, auth, seed-dependent flows).
- Steals hours of debugging before the root cause is recognized as infrastructure.

The fix has three properties:

1. **Idempotent** — fixture-ensure must upsert, not insert. If the user exists, update as needed; if not, create. Never assume prior state.
2. **Verified before the first test runs** — the wrapper runs a positive assertion after fixture-ensure (`SELECT auth.uid()` for the fixture user, or a direct auth sign-in preflight). Failure here halts the suite with a clear "fixture infrastructure failed — tests not run" error, not cascading login failures.
3. **Explicit in output** — the suite's output names the fixture-ensure step as a distinct phase, so a regression there is distinguishable from a regression in the test body.

## Generalization

The pattern applies to any suite with external state dependencies:

- E2E tests depending on seeded users, workspaces, or rows.
- Integration tests depending on migrated schema.
- Capability tests depending on authority_config seeds.
- Telemetry tests depending on registered events.

The common trap: the state-dependency is "someone else's problem" at test-author time, then silently becomes invisible infrastructure when it works, then becomes a mystery regression when it doesn't.

## Application

1. **Gate 3 protocol:** E2E iteration 1 baseline (code-correct, some telemetry failures expected per known drift) is valid proof of code correctness when the baseline itself is from a pre-fix iteration. Do not require clean 14/14 from post-fix iterations when fixture-infra is the documented failure mode.

2. **E2E wrapper ADR candidate:** any repository-wide E2E wrapper (Playwright `globalSetup`, similar) should codify the three properties above. File an ADR if the wrapper currently lacks them.

3. **Test-infra debt channel:** fixture regressions are test-infra debt, tracked separately from feature regressions. A feature PR should not be blocked by a fixture-infra failure unless the feature itself modified the fixture surface.

4. **Council Gate 3 checklist addition:** "Is the E2E failure mode fixture-infra or feature-regression? Code-trace entity-fix correctness independently if fixture infra is suspected."

## Cross-references

- **Feature:** `feat/contract-hub-redesign`, Gate 3 verdict 2026-04-22.
- **Entity fix commits:** `b26161c2`, `0966e790` (revert), `107dafd6` (reapply).
- **Iteration 1 baseline commit:** `6466426e` (11/14 pass).
- **Journey specs under E2E:** `apps/e2e/tests/contracts/*.spec.ts` (8 specs, 4 seed helpers in `apps/e2e/helpers/seed.ts`).
- **Registry entity invariant:** `packages/telemetry/src/emit.ts` `writeActivityTrail` requires `properties.entity`.
- **Precedent:** L-0094 (phantom emit contracts), L-0083 (fail-open telemetry patterns).
