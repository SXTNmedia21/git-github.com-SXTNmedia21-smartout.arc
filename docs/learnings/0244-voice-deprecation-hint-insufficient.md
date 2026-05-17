---
title: "L-0244 — Hint-based LLM deprecation cannot replace tool omission"
id: L-0244
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: agent-architecture
tags: [voice-agent, llm, deprecation, livekit, ultravox, tool-selection]
related: [ADR-0298, L-0233, L-0234]
---

# L-0244: Hint-based LLM deprecation cannot replace tool omission

## Trigger

Sortie 5a (voice-task-infra) shipped `services/voice-agent/src/tools-task.ts` with 6 typed task tools mirroring ADR-0298 capability surface.

Existing `services/voice-agent/src/tools-personal.ts:53` `create_task` (free-text wrapper) was SOFT-DEPRECATED — description appended:

> "MERK (ADR-0298 row 5a): bruk create_personal_task i task-namespace hvis tilgjengelig — denne er fallback."

Both tools remain in LiveKit Realtime LLM's ToolContext after `buildAllBotssonTools()` spread merges `personalTools` + `taskTools`.

Council 2026-05-13: hint-based deprecation in description string does NOT prevent LLM from picking the old tool. LLMs disambiguate via toolset PRESENCE, not Norwegian description nudges.

## Pattern

Realtime LLM (LiveKit + GPT-4o-realtime per L-0233) sees a flat list of available tools with names + descriptions. It picks based on:
1. Name keyword match to user utterance
2. Description keyword density
3. Schema completeness (typed > free-text when typed exists)

A Norwegian hint embedded in description text is ONE signal among many. The LLM weights it against the rest of the description + the schema specificity + user phrasing.

Empirical baseline: similar hint-based deprecations in other LLM systems produce 5-30% mis-routing rate. For voice, this means 1 in 4 "lag oppgave" utterances may hit the old free-text path even after deprecation.

## Rule

When deprecating a voice tool:
- **Soft-deprecate (description hint):** NEVER sufficient. Provides 0-modest signal at best.
- **Hard-omit (remove from ToolContext):** Correct. LLM literally cannot pick a tool that isn't registered.

For 30-day migration windows where soft-deprecation is desired (preserve legacy voice sessions mid-flight), use a **registration flag** not a description hint:

```ts
buildPersonalTools({ omitCreateTask: true })  // when buildTaskTools also present
```

Adapter wires:
```ts
const personalTools = buildPersonalTools({ omitCreateTask: !!taskTools });
```

This makes deprecation a runtime choice (gradual rollout via feature flag) but enforces hard-omission at LLM toolset level.

## Mitigation

Pre-merge condition on `campaign/sortie-5-task-cutover` → development:

`services/voice-agent/src/tools-personal.ts` exports `buildPersonalTools(opts?: { omitCreateTask?: boolean })`. `adapter.ts:177` passes `{ omitCreateTask: true }` when `buildTaskTools` is included.

Soft-deprecation hint in description CAN remain as additional safety — but the omission flag is the contract.

## Sibling references

- ADR-0298 R6 (channel policy split)
- L-0233 (voice Realtime LLM ≠ stage-engine LLM)
- L-0234 (voice view-tools mirror pattern)
