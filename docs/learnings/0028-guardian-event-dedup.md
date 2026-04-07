---
title: "Avoid Duplicate Guardian Events Across Lifecycle Layers"
id: LEARNING_0028
status: canonical
layer: learning
created: 2026-03-14
updated: 2026-04-07
tags: [guardian, stage-engine, events, dedup]
---

# Learning-0028: Avoid Duplicate Guardian Events Across Lifecycle Layers

> Renumbered from Learning-0002 → Learning-0028 on 2026-04-07. Original 0002 number collided with `0002-middleware-cookie-preservation.md` (older). Middleware learning kept the 0002 slot.

## Context

Wiring `emitGuardianEvent()` into the stage engine lifecycle. The ultravox adapter calls `advanceStage()` from `stage-manager.ts`, which already emits `stage.changed` and `session.completed` events. The adapter also had its own emit calls for these same events.

## Discovery

When a higher-level function (e.g. `advanceStage()`) already emits guardian events, callers of that function must NOT emit the same events again. The emit belongs at the point where the action happens, not at every call site.

Rule of thumb: **emit at the source of the action, not at the trigger site**.

## Impact

- Before adding `emitGuardianEvent()` to any file, check if the function being called already emits
- `stage-manager.ts` owns stage.changed and session.completed events
- `session-manager.ts` owns session.started and session.abandoned events
- Adapters (ultravox, future voice adapters) should NOT re-emit events that the managers already cover
- Adapters CAN emit adapter-specific events (e.g. voice.connected, transcription data) that managers don't know about

## References

- `services/stage-engine/src/core/stage-manager.ts` — emits stage.changed, session.completed
- `services/stage-engine/src/routes/adapters/ultravox.ts` — duplicate removed during code review
