---
title: "Sixten — Stage Engine Persona Registration and Wake Trigger"
id: ADR_0255
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-05-05
module: botsson-harness
tags: [sixten, stage-engine, heartbeat, persona-dispatch, mission-pool]
---

# ADR-0255: Sixten Persona Registration in Stage Engine and Wake Trigger

**Bunnsolid claim:** Sixten is the first heartbeat-coupled agent to be registered as a named persona in the Stage Engine's mission-pool dispatch path. This ADR locks the integration shape so subsequent phases (heartbeat-native dispatch, recurrence, memory recall) can extend without breaking the Phase 0 smoke-test contract.

## Context and Problem Statement

Sixten (`.claude/agents/sixten.md`) is a Claude Code agent who drafts ADRs, plans, and council briefs. He is defined as `heartbeat_coupled: true` and `persona: sixten` in his agent file. The Stage Engine's `mission-pool-slot` worker dispatches missions by loading `docs/journeys/<slug>/ir/journey.yaml` and executing a stub event loop.

Today, the stub loop emits 4 telemetry events and flips `engine_state.status=complete` but does not actually execute any agent. Sixten cannot receive a mission until the mission-pool learns to dispatch to him.

Three integration questions required an ADR-class answer:
1. **Where does persona routing live?** In the mission-pool-slot worker (reads `persona` from yaml), not in a new DB table.
2. **How is Sixten invoked?** Via the claude CLI subprocess (`claude --agent sixten.md --print <startup-prompt>`), not via the existing `routeAgentMessage` chat pipeline.
3. **What is the Phase 0 trigger?** A manual CLI script (`wake-sixten.sh`) calling `POST /agent/dispatch` on the stage-engine. Heartbeat-native (`engine_state` row + `heartbeat_pickup` RPC) is Phase 1.

## Decision Drivers

- Sixten must not mutate workspace data or invoke capability tools — his allow-list is: read files, write to `docs/`, emit terminal signal.
- Phase 0 must require zero DB migrations. `engine_state` integration is Phase 1.
- The persona dispatch pattern must be extensible to future agents (harness-builder, docs-tutor, etc.).
- The wake trigger must be callable from the developer workstation in < 5 commands.
- Sixten's invoke chain must be auditable: startup prompt is built from the mission folder files, not from opaque config.

## Considered Options

1. **Option A — HTTP endpoint (`POST /agent/dispatch`)** — new Hono route in stage-engine accepts `{persona, missionPath}`, reads mission folder, spawns claude CLI subprocess. CLI script calls it.
2. **Option B — Direct claude CLI from `wake-sixten.sh`** — script spawns claude directly, bypassing stage-engine entirely. No telemetry integration.
3. **Option C — engine_state row + heartbeat_pickup** — full integration via DB row; requires `heartbeat_pickup` RPC and `engine_state.persona` column migration.

## Decision Outcome

Chosen option: **Option A** for Phase 0, **Option C** as the Phase 1 target.

Option A chosen because:
- Telemetry (run_started / step_reached / completed) is emitted by stage-engine, not lost.
- The mission-pool-slot worker is the canonical dispatch path — persona routing belongs there.
- Stage-engine's auth middleware already skips auth in dev (no DB queries needed).
- Option B loses the telemetry contract entirely.
- Option C requires a migration (`engine_state.persona` column, `engine_authority_config` seed for sixten); Phase 0 does not justify that scope.

## Rules & Consequences

- **Good, because** the Sixten dispatch path reuses the exact folder structure (`ir/journey.yaml`, `MISSION.md`, `LICENSE.md`, `FLOW.md`, `RESCUE-PROMPT.md`) established for dev-arena-bootstrap and dev-adr-0249, so no new conventions are introduced.
- **Good, because** `persona` is an optional field in `MissionManifest` — missions without it fall through to the existing Phase 0 stub path, preserving backward compatibility.
- **Bad, because** Phase 0 does not wire `engine_state` rows — the heartbeat-dispatcher cannot pick up Sixten missions automatically until Phase 1.
- **Bad, because** claude CLI subprocess stdout is the only signal — no structured result shape until Phase 1 adds an output schema.

**What changes:**
- `services/stage-engine/src/workers/mission-pool-slot.ts` — reads `persona` from yaml; dispatches to `dispatchToSixten()` when `persona === "sixten"`.
- `services/stage-engine/src/routes/agent/dispatch.ts` — new route `POST /agent/dispatch`; validates `{persona, missionPath}`; loads mission folder; invokes claude CLI.
- `services/stage-engine/src/index.ts` — registers `agentDispatch` route.
- `~/.claude/scripts/wake-sixten.sh` — CLI trigger; resolves repo root; POSTs to `/agent/dispatch`.
- `docs/journeys/dev-sixten-hello/` — smoke-test mission folder (MISSION.md, LICENSE.md, FLOW.md, RESCUE-PROMPT.md, ir/).

**What stays the same:**
- `engine_authority_config` — untouched. Sixten has no workspace authority.
- Any existing capability (`packages/ai/src/capabilities/`) — untouched.
- `engine_sessions` and `engine_state` schema — untouched (no migration).
- Phase 0 stub path for missions without `persona` field — unchanged.

**Agent Impact:**
- To add a new persona, extend `REGISTERED_PERSONAS` in `dispatch.ts` and add a dispatch branch in both `dispatch.ts` and `mission-pool-slot.ts`.
- To promote Sixten to heartbeat-native (Phase 1), add `engine_state.persona` column + `engine_authority_config` seed + wire `heartbeat_pickup` RPC to pass `persona` in notify payload. The `dispatchToSixten()` function in `mission-pool-slot.ts` is already the canonical executor — Phase 1 only changes how it is invoked.

## Phase 0.5 — File-Backed Task Queue (added 2026-05-05)

Phase 0 (manual `wake-sixten.sh`) and Phase 1 (heartbeat-native via `engine_state`) leave a usable middle gap: a heartbeat-driven queue for Sixten + future personas without a DB migration.

**What ships:**
- `infra/sixten/queue.json` — versioned array of task objects. Schema includes UI-visible fields (`title`, `description`), dispatch fields (`persona`, `missionPath`, `instruction`), schedule (`type`, `interval_seconds`, `deadline`), and lifecycle (`status`, `priority`, `created_at`, `last_run_at`, `next_run_at`, `last_result`).
- `infra/sixten/dispatcher.sh` — heartbeat-driven host-side worker. Pops next due task, POSTs to `/agent/dispatch`, transitions `pending → in_progress → completed|failed|pending` (recurring re-queue based on `interval_seconds`).
- `services/stage-engine/src/routes/agent/queue.ts` — `GET /agent/queue`, `GET /agent/queue/:id`, `PUT /agent/queue/:id`. Read-only listing for Harness UI; status patches for personas at completion. mtime-checked optimistic locking.
- `~/dev/second-brain-v2/ops/scripts/sixten-dispatch.sh` — heartbeat handler wrapper.
- `HEARTBEAT.md` job `sixten-dispatch [cooldown: 5m]` (paused until smoke-test green).
- Volume mount in `docker-compose.yml`: `../infra/sixten/queue.json:/app/infra/sixten/queue.json` (read+write).

**Why this and not Phase 1 directly:**
- Zero migration cost. Schema can iterate freely until shape is right.
- Validates the UI surface (Harness page-tool) before paying DB-and-RLS price.
- Heartbeat-driven, not manual. Bridges the gap between ADR-0255 Phase 0 and Phase 1 without the engine_state column.
- Single dispatcher + low contention = JSON-file is sufficient. Phase 1 promotes to `engine_state` rows when distributed claim or RLS becomes load-bearing.

**Hard constraints inherited from Phase 0:**
- Persona allow-list still gated by `REGISTERED_PERSONAS` in `dispatch.ts`.
- No workspace authority for Sixten — `engine_authority_config` untouched.
- Telemetry/audit emission via host-side `log-activity.sh` (not `engine_event`).

**Phase 0.5 → Phase 1 promotion path:**
1. Migrate `queue.json` rows into `engine_state` rows (one per task, `persona` column populated).
2. Replace `dispatcher.sh` with `heartbeat_pickup` RPC + `pg_notify` listener in `mission-pool-slot.ts`.
3. Replace `agentQueue` route with `engine_state`-backed read endpoint (workspace-scoped, RLS-enforced).
4. Delete `infra/sixten/queue.json` + `dispatcher.sh` + heartbeat job + wrapper script.

## Phase 1 Prerequisites

Before Sixten can be dispatched via heartbeat-native path:
1. `engine_state` table needs a `persona TEXT NULL` column (migration required — bring through system-steward review).
2. `engine_authority_config` needs a seed for `capability='journey.run_dev'`, `actor_type='agent'`, `actor_slug='sixten'`.
3. `heartbeat_pickup` RPC must include `persona` in the `pg_notify` payload.
4. Mission-pool-slot `handleDispatch()` must read `persona` from the row (server-derived per ADR-0151), not from the yaml.

Until those land, `wake-sixten.sh` + `POST /agent/dispatch` is the canonical trigger.

## Open Questions

- **Memory recall:** Phase 1 should surface `engine_memory` rows for `agent_slug='sixten'` in the startup prompt. ADR-0255 Phase 1 will extend `buildSixtenStartupPrompt()` to inject memories.
- **Recurrence:** Sixten missions with `recurrence IS NOT NULL` need a scheduler (pg_cron seeded row or `engine_delayed_trigger`). Deferred to Phase 2.
- **Output schema:** Phase 0 uses stdout terminal signal (`SIXTEN_MISSION_COMPLETE: <id>`). Phase 1 should define a structured result JSON (`{ mission_id, stages_completed, output_path }`).
