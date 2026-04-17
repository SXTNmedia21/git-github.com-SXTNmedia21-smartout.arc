---
title: "Telemetry corruption ships silently when emit() exists but payload is malformed"
id: LEARNING_0045
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [telemetry, mobile, council, audit, cascade, c1-calibration]
---

# Learning-0045: emit() existence is necessary, not sufficient

## Context

2026-04-17 mobile strategy council. Prior councils had repeatedly checked "do mobile mutations call emit()" as a proxy for telemetry health, and the answer flipped over time:

- 2026-04-06 council: "12/12 mobile hooks 0 emit()" — true at the time
- 2026-04-17 fact-check: "all 18 mutation hooks DO emit()" — true today

But Supervisor's R1 deeper trace found that `emit()` *being called* doesn't mean *the payload is valid*:

- `apps/mobile/src/hooks/mutations/use-punch.ts:141-142` — punch_out emits `workspace_id: null, actor_id: ""`
- `apps/mobile/src/hooks/mutations/use-swap.ts:60,124-138,187-192` — all 4 swap mutations emit `workspace_id: ""` (empty string)
- `apps/mobile/src/hooks/mutations/use-create-shift.ts:69` — emits `actor_id: ""`

`BaseEvent` types `workspace_id` as `string | null`, so empty string passes TypeScript silently. The `engine_event` routing filter (`workspace_id IS NOT NULL`) drops the row. The `activity_trail` insert succeeds but with broken attribution. C1 calibration loops downstream make wrong decisions.

## Discovery

"Calls emit()" is a binary check. "Emits well-formed events with required attribution" is a contract check. They are not the same. Three failure modes hide behind a passing emit() check:

1. **Empty-string fallbacks** — `actor_id: profile?.id ?? ""` looks safe, isn't.
2. **Null vs empty-string ambiguity** — TypeScript types `string | null` accept `""`, downstream filters don't agree.
3. **Field-by-field copy-paste drift** — first mutation gets it right, subsequent mutations copy the structure but skip the context-resolution.

The fix pattern was already in the codebase (`use-punch.ts:24-46` `getProfileContext()`) but other mutations didn't use it. Code review missed this three times.

### The invariant

**emit() existence is a necessary condition for telemetry health, not sufficient. The contract is: registered event name + non-null workspace_id + non-empty actor_id + payload schema match.**

Audit checks must validate the contract, not the call.

## Application

- ADR-0129 codifies the runtime contract (dev-mode assertion, prod-mode rate-limited warning) and lint rule
- Mobile mutation PRs require unit test asserting `workspace_id` and `actor_id` are non-empty in the emit payload
- Future telemetry audits don't ask "does emit() get called" — they ask "does the contract hold for every emit() site"
- This pattern likely exists in other surfaces (web, edge functions) — separate audit warranted

## Repeat-learning watch

If future councils find new sites with empty-string telemetry attribution, escalate to a hard lint rule (already proposed in ADR-0129 R4).
