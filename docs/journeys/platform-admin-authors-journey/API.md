---
title: "API surface — platform-admin-authors-journey"
journey_id: platform-admin-authors-journey
created: 2026-04-29
updated: 2026-04-29
---

# API.md — endpoints + events + functions

## HTTP endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/platform-admin/journeys/wizard` | godmode JWT | Create new `wizard_session` row, return wizard_session_id |
| GET | `/api/platform-admin/journeys/wizard` | godmode JWT | List active + completed wizard_session rows |
| POST | `/api/platform-admin/journeys/wizard/{sessionId}` | godmode JWT | Update wizard_session metadata |
| POST | `/api/platform-admin/journeys/wizard/{sessionId}/complete` | godmode JWT | Finalize wizard_session (legacy — being superseded by publish_draft tool) |
| POST | `/api/emma/chat` | cookie or Bearer | BFF — forwards to stage-engine `/agent/chat` with `mission="journey_authoring"` + `wizardSessionId` |
| POST | `${STAGE_ENGINE_URL}/agent/chat` | API key | Stage-engine canonical agent endpoint (called by BFF only) |

## Telemetry events

| Event name | Properties | Routes to |
|---|---|---|
| `journey_authoring phase_advanced` | `phase`, `wizard_session_id` | PostHog + activity_trail + engine_event |
| `journey_authoring journey_published` | `journey_id`, `journey_version_id`, `mission_id`, `wizard_session_id` | PostHog + activity_trail + engine_event |
| `journey run_started` | `journey_version_id`, `run_id`, `surface`, `capability` | (existing — ADR-0173) PostHog + activity_trail + engine_event |

> **Registry rows pending** in `packages/telemetry/src/registry.ts` for the
> two `journey_authoring` events. Tracked in ADR-0226 Phase 3.

## Capability tools (journey_authoring)

| Tool | Schema | Returns | Authority |
|---|---|---|---|
| `save_draft` | `{ draft: object, next_phase?: enum }` | text status | suggest |
| `check_duplicates` | `{ title, module, actor }` | duplicate report | read_only |
| `lookup_journeys` | `{ module?, actor?, keyword?, limit? }` | journey list | read_only |
| `publish_draft` | `{ confirm: boolean }` | text + journey_version_id | suggest |

## Capability tools (journey — frozen-4 per ADR-0173)

| Tool | Schema | Returns | Used in this journey |
|---|---|---|---|
| `journey.publish_mission` | `{ journey_version_id: uuid }` | JSON `{ ok, mission_id, run_id }` | Yes — chained after publish_draft |
| `journey.publish_guide` | `{ journey_version_id: uuid }` | JSON `{ ok, guide_id, run_id }` | Optional |
| `journey.run_dev` | `{ journey_version_id: uuid }` | JSON `{ ok, run_id }` | No (out of scope) |
| `journey.run_guided` | `{ ... }` | JSON | No (out of scope) |

## Database RPCs

| RPC | Used by | Purpose |
|---|---|---|
| `gate_action` | `gatedMutation()` for save_draft + publish_draft + publish_mission | Authority evaluation per (workspace, capability, role) |
| `cascade_gate_write` | `gatedMutation()` Pathway B | Framework-rule policy diff (currently no-op for journey_authoring) |

## Functions invoked (server-side)

| Function | Where | Purpose |
|---|---|---|
| `routeAgentMessage` | `services/stage-engine/src/core/agent-router.ts` | Stage-engine entry per turn |
| `classifyIntent` | `packages/ai/src/router/intent-classifier.ts` | Routes to `journey_authoring` capability |
| `selectTools` | `packages/ai/src/capabilities/tool-selector.ts` | Filters tools by authority + channel |
| `gatedMutation` | `packages/ai/src/gate/gatedMutation.ts` | Wraps every mutation through gate_action + cascade_gate_write |
| `validateV21IrForMission` | `@smartout/journey-ir` | IR validation at publish_mission boundary |
| `emit` | `@smartout/telemetry` | Telemetry write to 4 destinations (PostHog, logger, activity_trail, engine_event) |
