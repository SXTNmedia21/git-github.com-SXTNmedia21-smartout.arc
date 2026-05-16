---
title: "Sortie 5b — Intent-Classifier Eval-Gate Report"
slug: sortie-5b-intent-classifier-eval-gate
feature: hard-delete-operations-complete
status: skipped
layer: audit
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-5b, audit, intent-classifier, eval-gate, ADR-0298]
---

# Sortie 5b — Intent-Classifier Eval-Gate Report

## Gate Verdict: SKIPPED — Defer B6 shim drop

`OPENROUTER_API_KEY` was not available in the execution environment. 1Password is not signed in interactively in this agent session (non-TTY). Eval suite requires the key at `op://smartout_ai/OpenRouter/api_key` which cannot be resolved without an active `op` session.

The `aliasTaskVerbs` shim in `packages/ai/src/router/tool-selector.ts:109-124` **must NOT be dropped** until a full eval-gate run produces ≥95% accuracy across IC1-IC4.

---

## Eval Command Used

```bash
# First attempt — without op run wrap (as specified by Phase 1 instructions)
cd /home/sxtnl/dev/smartout.ai-sortie-5-task-cutover-wt-2
RUN_EVALS=1 pnpm --filter @smartout/ai eval
```

The `eval` script maps to:
```bash
vitest run --config vitest.eval.config.ts
```

The `vitest.eval.config.ts` includes `src/**/*.eval.ts` and excludes `**/*.eval.ts` from the default `vitest.config.ts` — so the eval config must be used, not plain `vitest run`.

### Observed output (relevant extract)

```
❯ src/router/__evals__/intent-classifier.eval.ts (2 tests | 2 skipped) 8ms
    ↓ classifies every fixture and writes a report
    ↓ strict accuracy is above regression floor

FAIL src/router/__evals__/intent-classifier.eval.ts > intent-classifier eval
Error: OPENROUTER_API_KEY required to run evals.
       Set it in your shell or via 1Password.
  ❯ src/router/__evals__/intent-classifier.eval.ts:49:13

Test Files  4 failed | 1 skipped (5)
      Tests 9 skipped (9)
```

The `intent-classifier.eval.ts` suite has `RUN_EVALS` gating (`describe` vs `describe.skip`) — with `RUN_EVALS=1` the suite runs but `beforeAll` throws immediately on missing key. Result: 2 tests skipped (Vitest records `beforeAll` failures as skips on the describe block).

### Second attempt — op run wrap

```bash
op run --env-file=.env.template -- sh -c 'echo "OPENROUTER_API_KEY=${OPENROUTER_API_KEY:0:8}..."'
# [ERROR] 2026/05/13 20:26:52 error initializing client:
#         You are not currently signed in. Please run `op signin --help`
```

1Password CLI session not active. Key at `op://smartout_ai/OpenRouter/api_key` is unresolvable in this environment.

---

## Per-Fixture Verdict (IC1-IC4)

Eval did not execute. No classifier calls were made. All four fixtures are in `packages/ai/src/router/__evals__/fixtures/intent-seed.ts` at lines 97-129.

| ID | Intent string | Expected capability | Observed capability | Confidence | Verdict |
|----|--------------|---------------------|---------------------|------------|---------|
| task-IC1-create-for-employee | "Lag oppgave til Anna: bestille nye forklær innen fredag" | `task` (min 0.75) | — | — | **SKIPPED** |
| task-IC2-list-mine | "Hva må jeg gjøre i dag?" | `task` (min 0.70) | — | — | **SKIPPED** |
| task-IC3-complete | "Marker som ferdig" | `task` (min 0.70) | — | — | **SKIPPED** |
| task-IC4-create-personal | "Lag en personlig oppgave: ringe lege" | `task` (min 0.70) | — | — | **SKIPPED** |

---

## Aggregate Accuracy

| Metric | Value |
|--------|-------|
| Fixtures attempted | 0 / 4 |
| Pass | — |
| Fail | — |
| Skipped | 4 |
| Accuracy (strict) | N/A |
| Gate threshold | ≥ 95% |

---

## Gate Decision

**SKIPPED — Defer B6 shim drop.**

Per spec §4.1 and §6 (Risk table row 2): eval-gate not passed → skip B6. The `aliasTaskVerbs` shim at `tool-selector.ts:109-124` and the IC4 test block at `intent-classifier.test.ts:162-208` remain untouched in Sortie 5b.

All other Sortie 5b phases (B1-B5, B7) proceed as planned — they are not gated on this eval.

---

## How to Re-Run the Eval Gate

When a 1Password session is active:

```bash
cd /home/sxtnl/dev/smartout.ai-sortie-5-task-cutover-wt-2
op run --env-file=.env.template -- sh -c 'RUN_EVALS=1 pnpm --filter @smartout/ai eval 2>&1'
```

Then inspect `packages/ai/src/router/__evals__/reports/latest-intent-classifier.md` for per-fixture outcomes. If IC1-IC4 all PASS with confidence ≥ threshold, proceed with B6 in a follow-up sortie (5c or standalone).

---

## References

- Spec: `docs/superpowers/specs/2026-05-13-sortie-5b-hard-delete-operations-complete-design.md` §4.1
- Eval file: `packages/ai/src/router/__evals__/intent-classifier.eval.ts`
- Fixtures IC1-IC4: `packages/ai/src/router/__evals__/fixtures/intent-seed.ts:97-129`
- Scoring logic: `packages/ai/src/router/__evals__/scoring.ts`
- Shim under gate: `packages/ai/src/router/tool-selector.ts:109-124` (`aliasTaskVerbs`)
- ADR-0298: `docs/decisions/0298-task-ontology-five-sources.md`
