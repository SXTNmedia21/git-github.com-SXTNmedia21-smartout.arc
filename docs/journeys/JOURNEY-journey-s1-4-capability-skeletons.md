---
title: "Journey — S1.4 journey capability skeletons"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey, s1-4, capabilities, adr-0173]
---

# Journey — S1.4 Journey Capability Skeletons

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.4

## Scope

S1.4 registers four journey capabilities (`run_dev`, `publish_mission`, `publish_guide`, `run_guided`) with skeleton `execute()` bodies. Each tool emits `journey run_started` once per call; full flows land M3 / M4 / M5. The journeys below document the operator flow at skeleton-level — what the user does, what the system does, what shows up downstream.

---

## Journey 1: Admin runs a dev journey via chat (`run_dev`)

**Precondition:**
- Admin is authenticated in the web dashboard.
- Intent classifier routes the user's message (e.g. "run dev journey for onboarding") to `capability: "journey"` with confidence ≥ 0.7.
- Workspace's `engine_authority_config` has `journey.run_dev` at level `suggest`, min_role `admin` (S1.3 seed).
- `AgentToolContext` has non-null `workspaceId` + `profileId` resolved from the web session.

**Steps:**
1. User sends "run dev journey for onboarding v3" in the web chat. → Intent classifier returns `{capability: "journey", confidence: 0.85}`. → tool-selector resolves `journey` capability at authority = `suggest` → returns `readOnlyTools + suggestTools` = `[run_dev, publish_mission, publish_guide]`. → Agent picks `run_dev` with `{journey_version_id: "abc-..."}`.
2. Tool executes. → ADR-0134 guard passes (ctx has workspaceId + profileId). → `crypto.randomUUID()` generates `run_id`. → `emit({event: "journey run_started", workspace_id, actor_id: profileId, properties: {capability: "journey.run_dev", surface: "dev", ...}})` fires. → 4 destinations receive the event: PostHog (analytics), logger (stdout), `activity_trail` (audit), `engine_event` (workflow). → Return `JSON.stringify({ok: true, run_id, note: "S1.4 skeleton..."})`.
3. Agent surfaces the skeleton note to the user → User sees "Started run {run_id} (dev surface). Full Playwright wiring lands M3."

**Postcondition:**
- One `activity_trail` row with `event_name = "journey.run_started"` (dot-converted by `toDotNotation()`).
- One `engine_event` row with the same event keyed for downstream engine-dispatch.
- No `journey_version` or `engine_state` mutation — S1.4 skeleton does not touch those tables.

**Error paths:**
- **Missing context (ADR-0134 guard trip):** If `workspaceId === ""` or `profileId === ""`, tool returns `{ok: false, error: "missing_context", message: "..."}` BEFORE any emit. No side-effects.
- **Authority downgrade:** If workspace admin has downgraded `journey.run_dev` to `read_only` or `disabled`, tool-selector returns `[]` for the journey capability → Agent cannot call `run_dev` at all → falls through to a natural-language "I don't have permission" response.
- **Intent mis-classification:** If classifier returns `capability: "general"` (low confidence), tool-selector returns the union of all read_only tools across capabilities → `run_dev` not selectable. User must rephrase.
- **Registry miss (should not happen):** If `emit({event: "journey run_started", ...})` is called but `EVENT_ROUTING["journey run_started"]` is missing (registry regression), `emit()` logs an error and no-ops. Tool return is unchanged. CI grep catches this before merge (S1.1 guardrail).

---

## Journey 2: Admin publishes a journey as a runtime mission (`publish_mission`)

**Precondition:**
- Admin is authenticated in the web dashboard.
- Authority row `journey.publish_mission` at `suggest` / `admin` (S1.3 seed).
- A `journey_version` row in status `ready_test` (S1.2 enum lifecycle) exists for the target version.

**Steps:**
1. User writes "publish the onboarding journey as a mission" → Intent classifier → `journey` capability. → Agent picks `publish_mission` with `{journey_version_id: "..."}`.
2. Tool executes → ADR-0134 guard passes → emits `journey run_started` with `capability: "journey.publish_mission"`, `surface: "admin"` → returns skeleton.
3. User sees skeleton note "engine_missions insert + mission publish lands in M4."

**Postcondition:**
- One `activity_trail` + one `engine_event` row for the `run_started` event.
- No `engine_missions` row yet — M4 wires the actual publish.

**Error paths:**
- **Missing context:** ADR-0134 guard returns `{ok:false, error:"missing_context"}`.
- **Future (M4):** `journey_version` in wrong status / no valid IR → M4 will add validation before `engine_missions` insert. S1.4 skeleton does not validate status.

---

## Journey 3: Admin publishes a journey as a user guide (`publish_guide`)

**Precondition:**
- Admin authenticated. Authority row `journey.publish_guide` at `suggest` / `admin`.
- `journey_version` in a publishable status.

**Steps:**
1. User writes "publish user guide for onboarding" → Intent classifier → `journey`. → Agent picks `publish_guide`.
2. Tool executes → guard passes → emits `journey run_started` with `capability: "journey.publish_guide"`, `surface: "admin"` → returns skeleton.
3. User sees "USER-GUIDE generator wiring lands in M4."

**Postcondition:**
- One `activity_trail` + one `engine_event` row.
- No USER-GUIDE page generated — M4 wires the docs generator.

**Error paths:** Same shape as Journey 2 (guard trip, future M4 validation).

---

## Journey 4: End-user runs a guided journey (`run_guided`)

**Precondition:**
- End-user is authenticated in web runtime (mobile path is M5 BFF proxy — out of scope).
- Authority row `journey.run_guided` at `autonomous` / `employee` (S1.3 seed).
- A published runtime mission exists for the journey (M4 delivers this; S1.4 only exercises the skeleton).

**Steps:**
1. User triggers a guided-run entry point (chat message "start guided onboarding journey" or UI button that routes to the same capability). → Intent classifier → `journey` (confidence ≥ 0.7 on the specific phrasing). → tool-selector resolves `journey` at authority = `autonomous` → returns `capability.tools` (all 4). → Agent picks `run_guided` with `{journey_version_id}`.
2. Tool executes autonomously (no UI-confirm since not in `suggestTools`). → ADR-0134 guard passes → `run_id = crypto.randomUUID()` → `emit({event: "journey run_started", capability: "journey.run_guided", surface: "runtime_web", ...})` → returns skeleton note "Fjernkontroll state machine lands in M5."
3. User sees the skeleton response (in M1). M5 will replace this with the Fjernkontroll state machine surface (ADR-0177).

**Postcondition:**
- One `activity_trail` + one `engine_event` row.
- No Fjernkontroll UI changes — M5 wires the state machine.

**Error paths:**
- **Missing context (ADR-0134):** Non-negotiable guard. Empty `workspaceId` or `profileId` → `{ok:false, error:"missing_context"}`. On mobile (M5), this is where `getProfileContext()` resolution failures manifest.
- **Authority level = `suggest` (downgraded from default):** tool-selector returns `readOnlyTools + suggestTools` = `[] + [run_dev, publish_mission, publish_guide]` = 3 tools. `run_guided` is NOT in that set → Agent cannot invoke it → user sees "I don't have permission to start a guided run." This is the deliberate safety posture: a workspace that downgrades `run_guided` from `autonomous` turns it OFF entirely.
- **Authority level = `confirm`:** tool-selector returns `capability.tools` (all 4 incl. `run_guided`). Same as autonomous but with a confirm step — behaviour wiring for `confirm` is in tool-selector, not the capability.

---

## Cross-cutting: ADR-0134 compliance (every journey)

**Precondition:** `AgentToolContext.workspaceId` and `profileId` are non-null, non-empty strings.

**Guard:** Every `execute()` body starts with
```typescript
if (!ctx.workspaceId || !ctx.profileId) {
  return JSON.stringify({ ok: false, error: "missing_context", message: "..." });
}
```
No emit fires before this guard. Empty-string fallback is banned (Gate A C-5 grep gate; merge-blocker).

**Test coverage:** `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts` asserts this for every tool × every empty-variant (both empty, workspaceId only empty, profileId only empty) = 12 ADR-0134 assertions.

---

## Cross-cutting: telemetry fan-out

Every emit routes to 4 destinations (per `EVENT_ROUTING["journey run_started"]` in registry.ts:7148):
1. **PostHog** (`posthog` destination) — product analytics.
2. **Logger** (`logger` destination) — stdout for ops visibility.
3. **`activity_trail`** (`activity_trail` destination) — audit row with `event_name = "journey.run_started"` (dot-converted).
4. **`engine_event`** (`engine_event` destination) — workflow-trigger row consumed by engine-dispatch.

Wire-format event name is `journey.run_started` (dotted) after `toDotNotation()`; registry key is `journey run_started` (space). L-0094 enforced: every emit here has a matching registry entry pre-verified by Phase 2.5 grep (`registry.ts:4737+`).
