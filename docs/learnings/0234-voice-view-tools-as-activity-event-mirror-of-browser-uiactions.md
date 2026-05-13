---
id: L_0234
title: "Path-gated voice view-tools mirror browser uiActions via activity-event bridge"
status: active
created: 2026-05-13
updated: 2026-05-13
module: MODULE_BOTSSON
tags: [learning, voice, harness, schedule, path-gating, tool-design]
related: [L-0233, L-0238]
---

# L-0234 — Path-gated voice view-tools mirror browser uiActions via activity-event bridge

## Pattern

When a page already exposes view-state operations (date nav, column grouping, period switching, filter, layout, focus) to **browser-chat Botsson** via `useRegisterTools("page-key", kit)` — voice can reach the **same operations** by adding a 1:1 mirror tool in voice-agent that publishes a **single discriminated activity event** over the LiveKit data channel. The page's bridge component listens for the event and calls the matching React state setter.

Key constraint Pontus articulated 2026-05-13: *"viktig at path spesifika tools bare er tilgjengelig når de kan benyttes"* — path-specific tools must be unavailable when they cannot be used. Voice satisfies this through a `checkSchedulePath()` guard at the top of every `execute()`, returning a dialogic redirect ("Du må være på vaktplan-siden. Vil du at jeg navigerer deg dit?") rather than silently failing or pretending success.

## Why mirror, not bridge directly

Voice-agent runs in a Node process inside Docker. The page's React state setters live in the browser. There is no shared memory. We need a wire format.

`_publishActivity(event)` already exists on the voice-agent side and is already plumbed through `BotssonOrbVoiceMount` → `BotssonShell.handleVoiceActivity` → window event dispatch → page bridge. Mutation tools (`propose_create_shift` etc.) use this for ghost-card proposals. View tools reuse the same pipe with a different event type.

## Single discriminated event vs N event types

Instead of `schedule_navigate_date` + `schedule_switch_columns` + `schedule_set_period` + `schedule_set_filter` + `schedule_switch_layout` + `schedule_focus_day` (six event types in the `BotssonActivityEvent` union), use **one** event type with a discriminated `action` field:

```ts
type ScheduleViewChangePayload =
  | { action: "navigate_date"; weekOffset: number }
  | { action: "switch_columns"; view: string }
  | { action: "set_period"; weeks: number }
  | { action: "set_filter"; filter: string }
  | { action: "switch_layout"; layout: string }
  | { action: "focus_day"; dateId: string; openPlanner: boolean };

// part of BotssonActivityEvent
| { type: "schedule_view_change"; payload: ScheduleViewChangePayload; ts: number }
```

Bridge then switches on `payload.action`. Single `useEffect`, single window listener, single union to extend when a new view-op is added.

## Enum-validated parameters at two layers

For each tool: enum values appear **both** in the JSON-schema `parameters.enum` (rejected at the OpenRouter wire boundary so the LLM cannot hallucinate non-existent views) **and** in the `execute()` body's runtime check (defence-in-depth — should the schema fail, the body still rejects unknown values with a Norwegian error message).

Example: `set_schedule_columns` enum `["ansatt", "jobb", "team", "lokasjon"]` — both schema and body. Out-of-band values like "kategori" trigger `Ugyldig view "kategori". Bruk: ansatt, jobb, team, lokasjon.` before any data is published.

## Fail-fast on the bridge side

The browser bridge receives the event but the page's state setter may be undefined (page-prop chain didn't wire that capability). Don't pretend success — `console.warn` + early-return:

```ts
case "set_period":
  if (!setTimePeriod) {
    console.warn("[schedule-bridge] set_period received but setTimePeriod not wired");
    return;
  }
  setTimePeriod(payload.weeks);
  return;
```

Voice tool returned "Viser månedsoversigt" optimistically. If the bridge cannot deliver, the UI silently doesn't change — but the warning gives a developer signal to wire the missing prop. Pontus's "hugs-implementering" (tight implementation) constraint translates to: never lie about success.

## Tools/bridge naming convention

For view-state operations (non-mutations):
- Tool name: `set_<surface>_<aspect>` — `set_schedule_date`, `set_schedule_columns`, `set_schedule_period`, `set_schedule_filter`, `set_schedule_layout`, `set_schedule_focus_day`.
- Event type: `<surface>_view_change` — `schedule_view_change`.
- Window event name: `botsson:<surface>-view-change` — `botsson:schedule-view-change`.
- Bridge listener: single `useEffect` in the surface's tools-bridge.

For mutations: keep the existing `propose_*` convention (`propose_create_shift`) and the ghost-card window event `botsson:shift-proposal`.

## Forward implications

When extending voice to other surfaces (people, year-wheel, governance), follow the same pattern:

1. Identify the surface's uiActions in its `*-voice-tools-bridge.tsx`.
2. Add path-gated voice tools that publish a single discriminated `<surface>_view_change` activity event.
3. Add the event variant to `BotssonActivityEvent`.
4. Add a dispatch case to `BotssonShell.handleVoiceActivity`.
5. Add a window-event listener to the surface bridge with fail-fast guards.

## References

- ADR-0078: voice channel guard (path-gating is layer 3)
- ADR-0289: voice-agent registry duplication freeze
- [L-0233](./0233-voice-realtime-llm-vs-stage-engine-llm-two-contexts.md): two LLM contexts (motivates why voice needs its own tools, not just stage-engine tools)
- Commit: `bc1b3c3ee` (6 view-state voice tools + bridge wiring)
- Files: `services/voice-agent/src/tools-schedule.ts:set_schedule_*`, `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx:BotssonActivityEvent + ScheduleViewChangePayload`, `apps/web/src/app/Botsson/_components/BotssonShell.tsx:handleVoiceActivity dispatch`, `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx:botsson:schedule-view-change listener`
