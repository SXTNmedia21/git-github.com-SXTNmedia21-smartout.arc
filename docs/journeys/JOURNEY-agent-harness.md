---
title: "Journey — agent-harness"
feature: agent-harness
branch: feat/agent-harness
created: 2026-04-07
updated: 2026-04-07
module: ai-agent
status: ready_for_merge
tags: [ai-agent, eval-harness, developer-journey]
---

# Journey — agent-harness

> This feature ships internal developer tooling, not end-user UI. "Journey" here
> means the developer's workflow: how to run the harness, how to read the output,
> how to add new coverage, and how to diagnose failures. No admin/manager/employee
> paths because none of this runs in production request paths.

## Journey: Developer runs unit tests (default, no API key needed)

**Precondition:** repository cloned, `pnpm install` run, on any branch.

1. Developer opens terminal in repo root → runs `pnpm --filter @smartout/ai test` → vitest spins up in the `packages/ai` workspace
2. Vitest loads `vitest.config.ts` → config excludes `**/*.eval.ts` so no real-LLM files are considered
3. Three unit test files discovered and executed sequentially:
   - `router/__tests__/scoring.test.ts` (7 tests — scoring buckets, strict/lenient math)
   - `router/__tests__/tool-selector.test.ts` (14 tests — full authority matrix, 0.7 confidence boundary)
   - `router/__tests__/intent-classifier.test.ts` (7 tests — mocked LLM via `vi.mock("ai")`)
4. Developer sees `Test Files 3 passed (3)` and `Tests 28 passed (28)` in under 1 second
5. Exit code 0 → developer continues work

**Postcondition:** 28 unit tests verified green. No API key consumed. No network calls. Safe to run in CI on every PR.

**Error paths:**
- **If new unit test added that reaches out to real LLM**: vitest throws at import time because `ai` module is mocked. Developer sees stack trace pointing to mock boundary. Fix: add mock to `vi.mock("ai")` block or move the test to an `.eval.ts` file.
- **If mocked capability registry drifts from real one**: tool-selector tests start failing because expected tool names don't match reality. Fix: update the mock in `tool-selector.test.ts:10-40` to match the new capability shape.

## Journey: Developer runs real LLM evals locally

**Precondition:** 1Password CLI authenticated, `op` session valid, feature work involves intent classification, tool selection, or field extraction that needs validation against real model behavior.

1. Developer fetches the API key → `export OPENROUTER_API_KEY=$(op read "op://smartout_ai/OpenRouter/api_key")` (session-scoped, never persisted)
2. Developer runs `RUN_EVALS=1 pnpm --filter @smartout/ai eval`
3. Vitest loads `vitest.eval.config.ts` → config is `singleFork`, 300s timeout, includes only `**/*.eval.ts`
4. Four eval suites discovered and run (sequentially within the fork, in parallel across suites when possible):
   - `router/__evals__/intent-classifier.eval.ts` (11 fixtures, ~55s)
   - `capabilities/schedule/__evals__/schedule.eval.ts` (6 fixtures, ~14s)
   - `capabilities/operations/__evals__/operations.eval.ts` (6 fixtures, ~14s)
   - `agents/__evals__/onboarding.eval.ts` (5 fixtures, ~41s)
5. Each suite calls the real function under test with each fixture → scores the output against the expected value → outputs pass/partial/fail/error per fixture
6. Markdown reports written to:
   - `packages/ai/src/router/__evals__/reports/latest-intent-classifier-seed.md`
   - `packages/ai/src/capabilities/schedule/__evals__/reports/latest-schedule-tool-calls-seed.md`
   - `packages/ai/src/capabilities/operations/__evals__/reports/latest-operations-tool-calls-seed.md`
   - `packages/ai/src/agents/__evals__/reports/latest-onboarding-extraction-seed.md`
7. Developer reads the latest-*.md files → sees per-fixture breakdown, per-capability rollup, overall strict + lenient accuracy
8. Developer decides: baseline looks right → commit the report as evidence, OR baseline regressed → investigate the failures

**Postcondition:** 4 fresh baselines measured. Reports written to gitignored `reports/` directories (only `latest-*.md` is meant to be referenced, not committed).

**Error paths:**
- **If `RUN_EVALS=1` is not set**: all 4 suites cleanly skip with "8 tests skipped". Developer sees this and remembers to set the flag.
- **If `OPENROUTER_API_KEY` is not set**: the intent classifier / onboarding / agent code throws `"OPENROUTER_API_KEY is not set"`. Developer re-runs `op read` and retries.
- **If `op` session expired**: `op read` prints `"not currently signed in"`. Developer runs `eval $(op signin)` then retries.
- **If OpenRouter returns `"could not parse the response."` or `"Provider returned error"`**: this is the Phase 2.1 bug pattern returning. Check if the schema under test has `.describe()` or `.min/.max` on a Zod field — those are forbidden in `generateObject` calls. See ADR-0073 for the empirical matrix.
- **If a fixture fails unexpectedly**: diff the report against the previous baseline (`git log -- <report-path>`). If the failure is model behavior drift, consider relabeling the fixture. If it's a code regression, bisect.

## Journey: Developer adds a new fixture to an existing eval suite

**Precondition:** developer wants to add coverage for a new edge case in an existing capability or the classifier.

1. Developer identifies the eval suite that covers the surface → opens `<suite>/fixtures/<name>-seed.ts`
2. Developer reads the existing fixtures to understand the format — each has `id`, `input`, `expected`, `tags`
3. Developer adds a new fixture object to the exported array with:
   - **`id`**: lowercase-kebab-case, descriptive (e.g., `schedule-overtime-next-friday`)
   - **`input`**: either a string user message (intent/capability suites) or a `conversationHistory` array (onboarding)
   - **`expected`**: the right shape for the suite — see the `_schema.ts` discriminated union
   - **`tags`**: for filtering and organization (`english`, `norwegian`, `read`, `write`, etc.)
4. Developer runs the suite locally: `RUN_EVALS=1 pnpm --filter @smartout/ai eval <suite-name>`
5. Developer reads the new fixture's result in the report → confirms pass OR investigates partial/fail
6. Developer commits the fixture alone OR the fixture + any prompt/schema changes that made it pass

**Postcondition:** new fixture is part of the suite. Baseline accuracy updates on next full run.

**Error paths:**
- **If fixture format is wrong**: Zod validation fails at suite load time. Error message points at the specific field. Fix the shape.
- **If fixture is genuinely ambiguous**: the model might return a defensible alternative. Either (a) relax the expected assertion (e.g., use `present` instead of `equals` for extraction), (b) tighten the prompt so the model has less room for ambiguity, or (c) split the fixture into two cleaner cases.
- **If fixture triggers a new prod bug**: the harness just did its job. Fix the code, add a NOTE block referencing the fixture ID, update ADR-0073 with an addendum.

## Journey: Developer creates a new eval suite for a new capability

**Precondition:** developer is building a new capability (e.g., Phase 6+ guardian or communication) and wants to establish a baseline before shipping.

1. Developer reads `capabilities/schedule/__evals__/` as the canonical template (6 fixtures, clean pattern)
2. Developer creates directory structure:
   ```
   capabilities/<name>/__evals__/
     fixtures/
       <name>-seed.ts     # fixture array
     reports/
       .gitignore         # contents: * then !.gitignore
     <name>.eval.ts       # the suite driver
   ```
3. Developer copies the fixture schema import (from the shared `capabilities/__evals__/fixtures/_schema.ts`) and the scorer import (`capabilities/__evals__/tool-call-scoring.ts`)
4. Developer writes 6-10 fixtures covering read tools first, then write tools if present
5. Developer stubs `execute()` for each tool in the suite driver (no real Supabase calls — eval measures tool selection, not execution)
6. Developer runs `RUN_EVALS=1 pnpm --filter @smartout/ai eval <name>`
7. Developer iterates on fixture wording and tool descriptions until baseline is ≥70% strict (the documented floor) OR decides the floor needs to move for this capability with a documented reason

**Postcondition:** new eval suite exists, has a baseline, is gated behind `RUN_EVALS=1`, and runs in under 30 seconds.

**Error paths:**
- **If the capability has no tools that fit any of the 3 scoring styles**: you might need a 4th style (trajectory, refusal, or prompt composition). Open an ADR before building the new scorer.
- **If the baseline is stuck below 70%**: investigate whether the issue is fixture ambiguity (fix fixtures), capability tool descriptions (fix `capabilities/<name>/tools.ts`), or model limitation (document + lower floor with reason).

## Journey: Developer diagnoses a failing fixture

**Precondition:** a fixture that used to pass is now failing, OR a new fixture won't pass and the developer doesn't know why.

1. Developer opens the latest report → reads the fail entry. Each failure includes the input, the model's actual output, and the specific assertion that failed.
2. Developer classifies the failure:
   - **"could not parse the response." / "Provider returned error"** → schema bug (see ADR-0073). Check for `.describe()` or `.min/.max` in `generateObject` schemas.
   - **Wrong tool called** → either the model's tool selection is off (check tool descriptions in `capabilities/<name>/tools.ts`) or the fixture's expected tool name is outdated.
   - **Right tool, wrong args** → `tool-call-scoring.ts` treats this as `partial`. Check args passed: are they defensibly different (e.g., Norwegian "neste uke" interpretation) or genuinely wrong?
   - **Extraction field missing** → either (a) the extraction prompt doesn't teach the model to look for this field, or (b) the model can only find it with more context than the fixture provides. See `onboarding-departments-multi-location` as the canonical example of (b).
3. Developer re-runs the single suite with verbose output if needed
4. Developer either fixes the code (prompt, schema, capability tool) OR relabels the fixture OR documents the fixture as a known limitation in its `tags`
5. Developer re-runs to verify the fix, commits

**Postcondition:** the baseline is restored (or intentionally moved with a documented reason).

**Error paths:**
- **If bisect needed**: `git stash` + `git checkout <previous-good-sha>` + `RUN_EVALS=1 pnpm eval <suite>` to confirm the previous baseline, then walk forward in commits.
- **If OpenRouter itself is flaky**: run the fixture 3 times. If it's intermittent, it's a real issue with the model or the network. If it's deterministic, it's code.

## Data Flow

```
Developer intent
    │
    ▼
pnpm test  ◀── default: unit tests, mocked LLM, < 1s
    │
    ├─ vitest.config.ts (excludes *.eval.ts)
    ▼
28 unit tests (scoring math + tool selector + mocked classifier)
    │
    └── exit 0 → done

Developer intent
    │
    ▼
RUN_EVALS=1 pnpm eval  ◀── explicit opt-in, real OpenRouter, ~56s total
    │
    ├─ vitest.eval.config.ts (includes *.eval.ts only)
    ▼
4 eval suites (intent-classifier + schedule + operations + onboarding)
    │
    ├─ each suite: for each fixture → call real function → score
    ▼
8 test results + 4 markdown reports in reports/latest-<suite>.md
    │
    └── developer reads reports → decides pass/fail
```

## Three Scoring Styles

Each eval surface has its own outcome semantics because the shapes are different:

| Surface | Scorer file | Outcome buckets | Used by |
|---|---|---|---|
| Intent classification | `router/__evals__/scoring.ts` | `pass` / `hedged` (right label + low confidence) / `fail` / `error` | intent-classifier eval |
| Tool selection | `capabilities/__evals__/tool-call-scoring.ts` | `pass` (tool + args) / `partial` (tool right, args off) / `fail` / `error` | schedule + operations evals |
| Field extraction | `agents/__evals__/extraction-scoring.ts` | `pass` (all field assertions match) / `partial` (some match) / `fail` / `error` | onboarding eval |

**When to add a 4th scoring style**: if the surface is a multi-step tool chain (trajectory), a refusal-expected scenario, or a prompt composition check, the existing three won't fit. Open an ADR before building.
