---
title: "Couplings — platform-admin-authors-journey"
journey_id: platform-admin-authors-journey
created: 2026-04-29
updated: 2026-04-29
---

# COUPLINGS.md — bound to

## ADRs

| ADR | Topic | How this journey binds |
|---|---|---|
| ADR-0078 | Channel security | journey_authoring + journey.publish_mission both `allowedChannels: ["chat"]` |
| ADR-0099 | gate_action audit chain | every mutation routes through gate_action; gate_evaluation row per call |
| ADR-0132 | Mobile thin client → web BFF → stage-engine | wizard chat traffic uses `/api/emma/chat` BFF, never direct stage-engine |
| ADR-0133 | Mobile surface boundary | journey authoring is web-only (compose/plan verbs) |
| ADR-0134 | Telemetry contract — non-empty workspace_id + actor_id | save_draft + publish_draft fail-fast on missing |
| ADR-0151 | Server-derived profile_id | BFF resolves profile_id from auth, never trusts request body |
| ADR-0173 | Capability count frozen at 4 (journey runtime) | publish_draft DELEGATES to journey.publish_mission, never duplicates |
| ADR-0176 | Authority migration-only | engine_authority_config rows seeded by migration; runtime never inserts |
| ADR-0193 | Telemetry parity (no empty-string fallback) | save_draft + publish_draft refuse empty IDs |
| ADR-0194 | engine_missions.is_active=false at publish | publish_mission inserts is_active=false; activation is separate flow |
| ADR-0204 | Server Action / capability-tool gate parity | gatedMutation wraps save_draft + publish_draft writes |
| ADR-0217 | journey_guide MDX storage | publish_guide tool (out of this journey's path but available) |
| ADR-0222 | Skill-ops vs capabilities boundary | journey_authoring is a runtime capability; journey-protocol is the authoring SKILL |
| ADR-0226 | This decision — wizard via stage-engine capability | Direct binding |

## Capabilities

| Capability | Tools used | Source |
|---|---|---|
| `journey_authoring` (new) | save_draft, check_duplicates, lookup_journeys, publish_draft | `packages/ai/src/capabilities/journey-authoring/` |
| `journey` (frozen-4) | publish_mission | `packages/ai/src/capabilities/journey/` |

## Tables

| Table | Coupling | Migration |
|---|---|---|
| `wizard_session` | Read + UPDATE per phase + on completion | (pre-existing) |
| `journey` | INSERT at publish_draft | (pre-existing) |
| `journey_version` | INSERT at publish_draft | (pre-existing) |
| `engine_missions` | INSERT at publish_mission | `20260301200000_engine_tables.sql` |
| `engine_stages` | INSERT at publish_mission | `20260301200000_engine_tables.sql` |
| `engine_authority_config` | Read by gate_action | seeded `20260519100002_seed_journey_authoring_authority.sql` |
| `gate_evaluation` | Audit row per gatedMutation | `20260506110000_gate_action_four_eyes.sql` |

## Routes

| Route | Owner | Coupling |
|---|---|---|
| `/platform-admin/journeys/wizard` | apps/web | Wizard launcher list |
| `/platform-admin/journeys/wizard/[sessionId]` | apps/web | Wizard chat surface |
| `/api/emma/chat` | apps/web | BFF — forwards to stage-engine with mission + wizardSessionId |
| `/api/platform-admin/journeys/wizard` | apps/web | Session create/list |
| `/api/platform-admin/journeys/wizard/[sessionId]` | apps/web | Session update |
| `/api/platform-admin/journeys/wizard/[sessionId]/complete` | apps/web | Legacy completion (superseded by publish_draft) |

## Stage-engine bindings

| Component | File | Coupling |
|---|---|---|
| `/agent/chat` route | `services/stage-engine/src/routes/agent/chat.ts` | Schema accepts `wizard_session_id` |
| `routeAgentMessage` | `services/stage-engine/src/core/agent-router.ts` | Threads wizardSessionId into toolContext |
| `intent-classifier` | `packages/ai/src/router/intent-classifier.ts` | Routes "definer journey" intents to journey_authoring |
| `tool-selector` | `packages/ai/src/capabilities/tool-selector.ts` | Filters journey_authoring tools by authority level |

## Other journeys

| Journey | Relationship |
|---|---|
| (none — this is the meta-journey for authoring) | |

## Telemetry registry

| Event | Status |
|---|---|
| `journey_authoring phase_advanced` | Pending — must be added to `packages/telemetry/src/registry.ts` |
| `journey_authoring journey_published` | Pending — must be added to `packages/telemetry/src/registry.ts` |
| `journey run_started` | Existing (ADR-0173 Phase B) — re-used by publish_mission |

## What this journey does NOT bind to

- `engine_authority_config` mutations (ADR-0176 forbids runtime writes here)
- Mission activation (`is_active=true`) — handled by separate enrich flow
- `journey_event` audit table (used by other journey runtime flows; not by authoring)
