---
title: "ADR-0112 — Intent Classifier Coverage Invariant"
id: ADR-0112
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: ai-router
tags: [ai, router, capabilities, intent-classifier, invariant, ci]
---

# ADR-0112 — Intent Classifier Coverage Invariant

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

`packages/ai/src/capabilities/registry.ts` is the single source of truth for
which capabilities the Smartout agent can dispatch to. `packages/ai/src/
router/intent-classifier.ts` is what maps a user message to one of those
capabilities. The two files are independent editable surfaces, and nothing
enforces that they stay in sync.

Council R2 review discovered this exact drift: PR #197 registered a new
`shift_lifecycle` capability in `registry.ts` (with 4 write tools) but did
not update `intentSchema` in `intent-classifier.ts`. Because OpenRouter
returns structured output validated against `intentSchema`, the model
simply could not emit `"shift_lifecycle"` as a classification — so every
"godkjenn vakten min" / "publiser vakten" phrase was routed to `schedule`
(a read-only capability), producing a silent dead-end with no tool match
and no error.

The failure mode is insidious: typecheck passes, registry works, the new
capability's unit tests pass, the classifier's own tests pass, yet the
capability is **unreachable from the agent surface**. Only end-to-end eval
or production logs catch it.

## Decision Drivers

- Silent unreachability is the worst failure mode: no error, no log line,
  just "the agent doesn't know how to do that".
- `packages/ai` is touched by multiple concurrent branches (contract,
  shift_lifecycle, governance, operations_intelligence). Drift recurs.
- The eval harness (ADR-0073) is gated and not run on every PR; it cannot
  be the primary defence.
- Fix must be cheap enough to run in pre-commit / CI on every change.

## Considered Options

1. **Documentation-only invariant** — write it down, rely on reviewers.
2. **Runtime check at router boot** — panic if any registered capability
   is missing from `intentSchema`.
3. **Static CI check** — a small TypeScript or shell script that imports
   both surfaces and asserts set-equality, run in CI and pre-commit.
4. **Collapse the two surfaces** — derive `intentSchema` from the registry.

## Decision Outcome

**Invariant (normative):** Every capability name registered in
`packages/ai/src/capabilities/registry.ts` MUST have a corresponding
value in the `intentSchema` `capability` enum in
`packages/ai/src/router/intent-classifier.ts`, and every non-`general`
value in `intentSchema.capability` MUST be either registered in the
registry or explicitly documented in the intentional fall-through list
in `router/tool-selector.ts` (current exceptions: `knowledge`, `training`
proxy, `memory`, `payroll` — see the comment block in `tool-selector.ts`).

**Near-term:** enforce via (option 3) a static CI check. Proposed shape:

```ts
// packages/ai/scripts/check-intent-coverage.ts
import { getRegisteredCapabilities } from "../src/capabilities/registry.js";
import { intentSchema } from "../src/router/intent-classifier.js";

const registered = new Set(getRegisteredCapabilities());
const enumValues = new Set(intentSchema.shape.capability.options);
const DOCUMENTED_TOOLLESS = new Set(["knowledge", "memory", "payroll", "general"]);

const missingInEnum = [...registered].filter((c) => !enumValues.has(c));
const orphanInEnum = [...enumValues].filter(
  (v) => !registered.has(v) && !DOCUMENTED_TOOLLESS.has(v),
);

if (missingInEnum.length || orphanInEnum.length) {
  console.error({ missingInEnum, orphanInEnum });
  process.exit(1);
}
```

Wire it into the `@smartout/ai` package's `lint` script (or a new
`check:intents` script) so `pnpm turbo lint --filter=@smartout/ai` fails
if the invariant breaks.

**Longer-term:** option 4 (derive the enum from the registry) is the
principled fix, but requires refactoring the classifier schema to avoid
Zod-to-OpenRouter incompatibilities already documented in ADR-0073's
addendum. Deferred — tracked as follow-up.

## Positive Consequences

- Silent unreachability of new capabilities becomes impossible after CI.
- Contributors adding a new capability see a failing check immediately.
- Documents the tool-less intentional fall-through list in one place.

## Negative Consequences

- Small CI step to maintain.
- Exception list (`DOCUMENTED_TOOLLESS`) must be kept honest — reviewers
  must reject PRs that extend it without matching comment in
  `tool-selector.ts`.

## Related

- **ADR-0073** (AI Eval Harness) — the quality safety net this invariant
  backs up; together they are structural + behavioural coverage.
- **ADR-0095** (Shift Lifecycle Five-Layer Architecture) — the feature
  whose registration-without-classifier-wiring motivated this ADR.
- **Learning-0048** — Council R2 finding (F5) that exposed the drift.
- **ADR-0099** (Unified Authority Gate) — the authority layer that
  renders the capability useful once it is reachable.

## Follow-ups

- [ ] Implement `packages/ai/scripts/check-intent-coverage.ts`.
- [ ] Wire into `pnpm --filter @smartout/ai lint` and `turbo.json` `lint`
      task inputs.
- [ ] Add the same check to pre-commit via husky.
- [ ] Consider option 4 (derive enum from registry) when ADR-0073
      addendum's Zod-to-OpenRouter constraints are revisited.
