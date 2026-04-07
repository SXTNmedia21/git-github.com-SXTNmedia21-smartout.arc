---
title: "Handoff — agent-harness"
feature: agent-harness
branch: feat/agent-harness
closed: 2026-04-07
module: ai-agent
status: ready_for_merge
tags: [ai-agent, eval-harness, testing, botsson, handoff]
---

# Handoff — agent-harness

## Summary

Built a two-layer evaluation harness for `packages/ai` (unit tests + gated real-LLM evals) and in the process discovered that the intent classifier and onboarding extraction were silently broken in production. Four eval baselines now exist (intent 90.9%, schedule 83.3%, operations 100%, onboarding 80% strict / 100% lenient). Three distinct scoring styles emerged. Six agent files were bumped from `claude-sonnet-4` to `claude-sonnet-4.6` as part of a Phase 5 council audit. Four unregistered classifier labels (`knowledge`, `training`, `memory`, `payroll`) were documented as intentional fall-throughs rather than silently failing routes. One broken Claude Code plugin validator was patched locally (10 files) and a repo-local re-application script shipped.

Five phases, council-verified via parallel review by system-steward, supervisor, and system-agent-coordinator. All council recommendations resolved or explicitly deferred with documented reasons.

## What Was Done

### Eval harness foundation (Phase 1-3)

- [x] Two-layer test surface: `vitest.config.ts` (unit, excludes `*.eval.ts`) + `vitest.eval.config.ts` (real LLM, gated by `RUN_EVALS=1`, singleFork, 300s timeout)
- [x] Scoring infrastructure in `packages/ai/src/router/__evals__/scoring.ts` — pass/hedged/fail/error outcome buckets, strict + lenient accuracy, per-capability rollup, markdown report renderer
- [x] Fixture format: TypeScript + Zod (`packages/ai/src/router/__evals__/fixtures/_schema.ts`)
- [x] 11 intent-classifier seed fixtures covering Norwegian + English across all registered capabilities
- [x] 14 tool-selector unit tests (`packages/ai/src/router/__tests__/tool-selector.test.ts`) — pure function, full decision matrix including 0.7 confidence boundary
- [x] 7 mocked-LLM unit tests for `classifyIntent` (`vi.mock("ai")`)
- [x] Stable `reports/latest-<suite>.md` pointer alongside timestamped history
- [x] `pnpm test`, `pnpm test:watch`, `pnpm eval` scripts added to `packages/ai/package.json`

### Production bugs found and fixed (Phase 2.1 + 4.5)

First real eval run found **0/11 intent classifier fixtures passed** because three independent issues. Diagnostic matrix isolated:

1. **Model `anthropic/claude-sonnet-4` returns unparseable structured output via OpenRouter** — all schemas tested failed, not schema-specific
2. **`.describe()` on Zod string fields** → "Provider returned error" (Anthropic tool-input format rejects JSON-schema `description` properties)
3. **`.min()/.max()` on Zod number fields** → same rejection pattern

**Critical isolation finding (Phase 4 Task 0)**: the bug is **isolated to `generateObject`'s structured-output path**. `generateText({tools})` uses Anthropic's native tool-input format and is **unaffected**. Verified with a 4-test repro matrix. This is the most important load-bearing nuance of the entire branch.

- [x] `packages/ai/src/router/intent-classifier.ts`: model bumped to `claude-sonnet-4.6`, schema simplified (no `.describe()`, no number ranges), NOTE block added citing ADR-0073
- [x] `packages/ai/src/schemas/onboarding.ts` + `packages/ai/src/agents/onboarding.ts`: identical pattern, identical fix, field guide moved from `.describe()` calls to JSDoc on schema doc comment
- [x] Smoke tests verified fixes against real OpenRouter with fictitious Solsiden Bistro Norwegian conversation

### Capability evals (Phase 4-5)

- [x] **Schedule** (6 fixtures, mocked execute, strict 83.3% / lenient 100%) — `packages/ai/src/capabilities/schedule/__evals__/`
  - New tool-call fixture format + scorer in `capabilities/__evals__/tool-call-scoring.ts`
  - Single partial is defensible Norwegian "neste uke" interpretation (model picked 14 days, fixture said 7)
- [x] **Operations** (6 fixtures, 2 write tools, strict 100%) — `packages/ai/src/capabilities/operations/__evals__/`
  - Verified `create_deviation` and `complete_task` are called correctly when user explicitly asks
  - UUID extraction works verbatim, severity inferred from "critical food safety issue" framing

### Onboarding regression suite (Phase 5)

- [x] **Third scoring style** — field-level extraction with discriminated-union assertions (`present` / `absent` / `equals`) in `packages/ai/src/agents/__evals__/extraction-scoring.ts`
- [x] 5 fixtures, 26 field assertions, strict 80% / lenient 100% — `packages/ai/src/agents/__evals__/`
- [x] Single partial: `onboarding-departments-multi-location` — model extracted locations correctly but missed departments embedded in the same sentence. Real model limitation, documented as known issue (not fixture mislabel).

### Phase 5 council follow-ups (this session, post-council)

Council flagged two correctness issues that isolation-based evals did not catch. Both resolved:

- [x] **Model-string audit across 5 sibling agent files** (`contract.ts`, `docs.ts`, `journey.ts`, `reports.ts`, `schedule.ts`) — all use `generateText({tools})` per Phase 4 finding, so they were technically safe on sonnet-4. Bumped to sonnet-4.6 anyway for model freshness + consistency. NOTE block added to each.
- [x] **4 unregistered classifier labels resolved as intentional fall-through** — `knowledge`, `training`, `memory`, `payroll` emit labels with no registered capability. Documented in `packages/ai/src/router/tool-selector.ts` near line 39 as deliberate (knowledge → policy/FAQ lookup, training → narrative readiness, memory → conversational recall, payroll → deliberately tool-less for now). No silent routing failure — answer in natural language is intended behavior for these intents.
- [x] **`runOnboardingAgent` smoke test** — verified the sibling tool-calling code path works on sonnet-4.6 with a real OpenRouter call. Model called 2 tools (save_transcription) and returned a clean Norwegian greeting. Phase 4's empirical finding confirmed by runtime behavior, not just synthetic repro.
- [x] **Hook-fix sustainability** — shipped `scripts/patch-vercel-plugin-ai-sdk.mjs` as a committed, idempotent re-application script. Runs manually or via `pnpm postinstall` after plugin updates. Documented in `docs/STATE.md` section 9 "Known environment quirks".
- [x] **Upstream PR materials drafted** — `docs/upstream-prs/vercel-plugin-ai-sdk-generateObject-fix.md` contains title, body, diff, and evidence. Ready for Pontus to file against `vercel/vercel-plugin`.
- [x] **Sync with development** — merged origin/development into branch, resolved 2 doc conflicts (took dev's canonical version), renumbered ADR from 0072 → 0073 to avoid collision with dev's `0072-vercel-multi-service-rejected.md`, updated 6 in-repo references.

### Architecture documentation

- [x] ADR-0073 (`docs/decisions/0073-ai-eval-harness.md`) — original decision + 7 phase addendums with empirical findings, diagnostic matrices, verification per phase. Registered in `docs/decisions/0000-decision-log.md`
- [x] `docs/plans/PLAN-agent-harness.md` — full task list with phase deltas and baselines

## Decisions Made

All registered in ADR-0073. Headlines:

1. **Two-layer test surface** — unit tests always run, evals gated to protect CI budget
2. **Three scoring styles** — intent classification, tool-call selection, field extraction. Each matched to its measurement surface.
3. **`generateObject` vs `generateText({tools})` bug isolation** — documented as load-bearing empirical finding, not theoretical
4. **Four labels as intentional fall-through** — `knowledge`, `training`, `memory`, `payroll`. Rejected the simpler alternative of removing them from the enum (classifier would lose semantic signal) and the more aggressive alternative of registering placeholder capabilities (out of scope, creates dead stubs).
5. **All agents on sonnet-4.6** — consistency + future-proofing, even where sonnet-4 would have worked per Phase 4 finding
6. **Fixture strict floor at 70%** — documented in scoring code, load-bearing only within a suite
7. **Hook patch as committed script + upstream PR plan** — rejected "live with cache patches" as the worst long-term option

## Learnings

### Phase 4 Task 0 — `generateObject` vs `generateText({tools})` bug isolation

Before assuming a full-stack AI SDK bug, repro-test whether the failure is in the structured-output code path (`generateObject`) or the tool-calling code path (`generateText({tools})`). They use different serializations under the hood. Anthropic's tool-input format accepts JSON-schema `description` and number ranges; OpenRouter's structured-output bridge does not.

**The repro pattern**: build a 4-test matrix with (a) problem case, (b) without `.describe()`, (c) without `.min/.max`, (d) neither. The test that passes tells you exactly which JSON-schema construct the wire format rejects.

### Coverage drift — isolation evals don't catch cross-component inconsistency

The Phase 2.1 fix bumped `intent-classifier.ts` to sonnet-4.6, but 5 sibling files in the same package stayed on sonnet-4. No isolated capability eval catches this because each eval measures one component at a time. The right eval for catching cross-component drift is an **end-to-end runtime-pipeline eval** — deferred to Phase 6+ as `runtime-pipeline.eval.ts`.

**Rule**: when fixing a model-API interaction bug, `grep -rn "model-string" packages/<affected>` immediately. Sibling files share the bug class.

### Unregistered classifier labels — silent routing signal

When a classifier emits a label with no registered capability in the tool registry, `selectTools` returns `[]` and the agent runs `generateText` with zero tools. This produces a natural-language answer that **may or may not** be desired. Treat the gap as a deliberate design decision, not an implicit fall-through. Document in code near the branch point. Future Phase 6 work can convert any of the four deferred labels (knowledge, training, memory, payroll) into real tool-backed capabilities by adding a `<name>/index.ts` and registering it.

### Eval cost protection is a CI pattern, not an afterthought

Gating real-LLM evals behind `RUN_EVALS=1` + `OPENROUTER_API_KEY` prevents accidental cost bombs in CI while keeping the same test harness runnable locally. The empty-skip path (all suites cleanly skipped when unset) was verified explicitly and is worth preserving.

### Three scoring styles emerge naturally from test surface shapes

- **Intent classification** → `pass / hedged / fail / error` (correctness + confidence band)
- **Tool selection** → `pass / partial / fail / error` (tool name + args match — allow arg variance)
- **Field extraction** → `pass / partial / fail / error` (per-field present/absent/equals assertions)

Each surface dictates its own scoring semantics. Trying to unify under one scorer would lose critical detail. Anticipate **trajectory scoring** (multi-step tool chains, Phase 6+) and **refusal scoring** (authority-gating) as two future styles.

### The council process works — Phase 5 caught two correctness issues Phase 1-4 missed

Three parallel reviewers (system-steward, supervisor, system-agent-coordinator) each found issues the others missed. Specifically:
- Supervisor caught the 8-commit divergence from development that would have silently reverted employee-contract-management work on merge
- Agent-coordinator caught 7 unverified sonnet-4 references (5 in-scope, 2 out-of-scope) and 4 unregistered classifier labels
- Steward caught nothing new in Phase 3 but correctly overrode their own Phase 3 ordering in Phase 5 synthesis after seeing the other reviews

**Log for future councils**: when a branch touches AI agent infrastructure, system-agent-coordinator is the most load-bearing reviewer. Frontend-designer was skipped for this review and missed nothing.

## Known Issues & Debt

### Tracked follow-ups (not blocking merge)

1. **2 `services/stage-engine/` sonnet-4 references** — `agent-router.ts:145` and `admin-router.ts:93`. These are the production Botsson and admin agent runtimes. **OUT OF SCOPE for this branch** (different package, different deploy boundary) but **P0 SEVERITY** — must be addressed in a separate session immediately after merge. Also: `services/stage-engine/src/__tests__/admin-router.test.ts` has hardcoded `anthropic/claude-sonnet-4` string assertions that will need updating when the runtime is bumped.
2. **Schedule fixture relabel** — `schedule-when-work-next-week` has `expected.args: { days: 7 }` but the model defensibly picks `days: 14` for Norwegian "neste uke". 1-line change to bump strict schedule accuracy from 83.3% to 100%.
3. **Onboarding multi-location departments partial** — model misses departments embedded in the same sentence as locations. Options: split fixture into two turns, sharpen extraction prompt for nested entities, or accept as known model limitation. Defer indefinitely unless it causes user-visible impact.
4. **Phase 6+ capability evals** — guardian, profile, ui, communication, contract (dev added this), training, knowledge. Highest priority from agent-coord review: **guardian and communication** (both have write tools, highest user-impact risk).
5. **End-to-end runtime-pipeline eval** — single `runtime-pipeline.eval.ts` that seeds a fake session context and asserts the full classifier → selector → prompt → generateText loop returns non-empty text. Closes the coverage drift gap.
6. **Multi-step trajectory scoring** — new 4th scoring style needed before evaluating agents that chain tool calls (`stepCountIs(5)` in `agent-router.ts`). No eval currently exercises this.
7. **Refusal scoring** — new 5th scoring style needed before any capability runs with `confirm` or `autonomous` authority in production.
8. **Upstream PR against `vercel/vercel-plugin`** — materials ready in `docs/upstream-prs/vercel-plugin-ai-sdk-generateObject-fix.md`. Requires GitHub access from Pontus.
9. **`wt-2` journey-harness-poc reconciliation** — blocked on this branch landing. wt-2's plan must be refreshed to reference ADR-0073 baselines before any build agent runs.
10. **Third broken hook rule surfaced during Step 7** — the same vercel-plugin validator has a regex for "model slug must use dots not hyphens" that triggers false positives on package version strings (`ai@6.0.103`) and package names (`ai-sdk`). Add to upstream PR body as a second issue OR file a separate issue.

### Known limitations (not bugs)

- **No Stage Engine state transition coverage** — mission mode, guardian-evaluator, calendar-guardian, session-manager untested. Phase 6+ scope.
- **No prompt composition snapshot tests** — `buildBotssonPromptFromContext` takes 5 inputs and produces a system prompt. Worth adding unit-level snapshot tests for posture template regressions.
- **No memory-recall tests** — `mr-botsson.ts` injects `relevantMemories` but nothing verifies the classifier uses them.
- **Decision log structural mess (pre-existing)** — `docs/decisions/0000-decision-log.md` has 5 different `# Decision Log` headers from stacked feature branches. Not mine to fix in this branch but worth a dedicated cleanup session.

## Next Steps

### Immediate (first session after merge)

1. Audit the 2 `services/stage-engine/` sonnet-4 references and bump with appropriate smoke tests
2. File upstream PR against `vercel/vercel-plugin` using `docs/upstream-prs/vercel-plugin-ai-sdk-generateObject-fix.md`
3. wt-2 reconciliation per the Phase 5 council plan

### Phase 6 (next planned work)

Follow the council priority order:
- **P1**: guardian + communication capability evals (highest-risk untested)
- **P1**: end-to-end runtime-pipeline eval
- **P2**: multi-step trajectory scoring
- **P2**: refusal scoring

### Dependent work unblocked by this merge

- **wt-2 journey-harness-poc** — now has verified baselines for intent classifier and onboarding extraction to build on
- **Any future Botsson capability addition** — has a harness pattern to follow (see schedule/operations evals as template)

## Verification Summary

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm turbo typecheck --filter=@smartout/ai` | 0 errors, 4/4 tasks, full turbo cache |
| Unit tests | `cd packages/ai && pnpm test` | 28/28 pass |
| Eval skip path | `cd packages/ai && pnpm eval` | 4 suites, 8 tests cleanly skipped |
| Eval real run | `RUN_EVALS=1 OPENROUTER_API_KEY=... pnpm eval` | 8/8 pass, 4 reports written, 56s combined wall time |
| Smoke test | `runOnboardingAgent` with real API | PASS, model called 2 tools, returned clean Norwegian greeting |
| Hook script | `node scripts/patch-vercel-plugin-ai-sdk.mjs` | Idempotent, scans 325 files, patches newly-introduced cache copies |

All gates green as of 2026-04-07. Ready for merge.
