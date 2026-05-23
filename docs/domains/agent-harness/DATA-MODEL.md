---
title: "Agent Harness — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, data-model, engine, migrations, rls, telemetry]
---

# Agent Harness — Data Model

> Tables, migrations, RPCs, and telemetry. **Code wins.** Each table claim cites the migration + line that creates it.

## Engine tables (engine_* — 10+ base tables)

| Table | Migration | Line | Purpose |
|---|---|---|---|
| `engine_missions` | `20260301200000_engine_tables.sql` | :19 | Reusable agent workflow definitions (mission blueprints) |
| `engine_stages` | `20260301200000_engine_tables.sql` | :64 | Ordered steps within missions |
| `engine_sessions` | `20260301200000_engine_tables.sql` | :109 | Active conversation state — runtime session tracking |
| `engine_inbox` | `20260301200000_engine_tables.sql` | :158 | Generic data inbox for agent-stored data |
| `engine_memory` | `20260302000000_engine_memory.sql` | :10 | Workspace-scoped agent memory. TTL-managed cron added `20260531000000_engine_memory_ttl_cron.sql` |
| `engine_authority_config` | `20260302000100_engine_authority_config.sql` | :6 | C4 governance table — capability authority configuration per workspace |
| `engine_process` | `20260304100000_engine_process_tables.sql` | :17 | Event motor blueprint — defines workflow steps |
| `engine_step` | `20260304100000_engine_process_tables.sql` | :43 | Steps within an engine_process blueprint |
| `engine_trigger` | `20260304100000_engine_process_tables.sql` | :72 | Trigger definitions that fire engine_process instances |
| `engine_event` | `20260304100000_engine_process_tables.sql` | :101 | Workflow event log + `wait_for_event` resume signal |
| `engine_state` | `20260304100000_engine_process_tables.sql` | :129 | Live workflow instance (one per process+trigger combo) |
| `engine_delayed_trigger` | `20260304100000_engine_process_tables.sql` | :190 | Delayed trigger queue |
| `engine_state_step` | `20260412100100_engine_state_step.sql` | :10 | Per-step execution tracking for live instances |
| `engine_world` | `20260525000000_engine_world.sql` | :63 | Shared world model — agent fleet reads before acting (Vercel, PRs, worktrees, migrations, CI, costs) |

### Key migration phases

| Phase | Migrations | Purpose |
|---|---|---|
| Foundation | `20260301200000` + `20260301200100` | engine_missions/stages/sessions/inbox + seed data |
| Memory | `20260302000000` + `20260319120000` | engine_memory + fix constraints |
| Authority | `20260302000100` + `20260414225000` + many seeds | engine_authority_config + nullable updated_by + 15+ process seeds |
| Session modes | `20260302000200` + `20260324100000` + `20260330200000` | sessions mode column + nullable expiry + nullable workspace |
| Process motor | `20260304100000` | Full engine_process/step/trigger/event/state/delayed_trigger |
| Journey link | `20260308194427` + `20260308194432` + `20260308194433` | process↔journey FK + nullable workspace + seeds |
| Tuning | `20260318120000` | engine_tuning_notes + mission_prompt |
| State step | `20260412100100` | engine_state_step per-step tracking |
| Domain process seeds | 10+ migrations | billing (fase 2, dunning), contract-intake, invoice lifecycle, cascade cost/budget, contract engine seeds, employee activation, channel sensitivity, etc. |
| Archive job | `20260508100100` | engine_state archive cron |
| Realtime | `20260517000000` | engine_event realtime publication |
| Scheduling | `20260520110000` | engine_state_scheduling (state scheduling metadata) |
| World | `20260525000000` + `20260526000000` + `20260528010000` | engine_world + world_phase_1 (observe_platform function) + revoke platform from clients |
| FK cascade | `20260329200001` | FK cascade constraints |
| Authority audit | `20260616100602` | RLS WITH CHECK audit fix (ADR fdb20/fdb22) |
| Employee activation | `20260621100000–100200` | engine_process + trigger + authority_config for employee activation workflow |

**Total harness-owned migrations (engine_* + agent_session_* + agent_profile): 45**

## Agent session tables (agent_session_* — 3 tables + agent_profile)

| Table | Migration | Line | Purpose |
|---|---|---|---|
| `agent_session_recording` | `20260515120100_agent_session_recording.sql` | :14 | Full session transcript per turn (ADR-0184). Ring buffer. |
| `agent_session_envelope` | `20260515120200_agent_session_envelope.sql` | :12 | Session metadata envelope (workspace, profile, channel, model) |
| `agent_session_whisper` | `20260515120300_agent_session_whisper.sql` | :13 | Turn-level whisper annotations. Per-verb extension: `20260616100200` |
| `agent_profile` | `20260307000000_agent_profile_system.sql` | :10 | One per workspace — Mr. Botsson's DNA (persona configuration) |

## Engine dispatch action handlers (RPCs / Edge Function)

All 10 action types handled in `supabase/functions/engine-dispatch/index.ts`:

| Action type | Supabase function line | Notes |
|---|---|---|
| `wait_for_event` | :776 | Suspends state; resumes on matching event |
| `assign_task` | :787 | Creates task via capability delegation |
| `send_notification` | :813 | Routes through notification_outbox |
| `update_entity` | :846 | Cross-state write — guarded by engine_world observer |
| `create_deviation` | :1431 | HACCP Phase 2c handler |
| `validate_settlement` | :1541 | Settlement validation step |
| `lock_checkout` | :1626 | Period lock step |
| `schedule_control` | :1760 | Schedule modification via scheduling capability |
| `start_process` | :1830 | Nested process instantiation |
| `upsert_session` | :1857 | Session creation/update within workflow |

## Telemetry events

Events from `packages/telemetry/src/registry.ts`:

| Event | Line (approx) | Purpose |
|---|---|---|
| `engine.context_patched_targeted` | :4235 | Targeted context patch applied |
| `engine.cross_state_write_blocked` | :4252 | Cross-state write guard blocked a write |
| `agent.schedule.workspace_queried` | :4844 | Agent queried workspace schedule data |
| `agent.schedule.date_queried_self` | :4859 | Agent queried own schedule |
| `agent.memory.summary_written` | :5476 | Memory summary written to engine_memory |
| `agent.memory.added` | :5495 | Memory item added |

All 6 events route to `logger` destination for structured stdout observability in stage-engine (per registry:10310 and :13984).

## RLS patterns

- `engine_authority_config`: workspace-scoped + JWT + API key policies. Authority seeds cover 15+ capabilities.
- `engine_sessions`: workspace-scoped. Nullable workspace_id for platform-level sessions.
- `engine_memory`: workspace-scoped + TTL. Platform-level rows use `workspace_id = NULL`.
- `engine_world`: workspace-scoped + platform-level (`workspace_id = NULL`) dual-pattern. Writes restricted to server-side (ADR-0151, ADR-0099).
- `agent_session_recording`: workspace-scoped + profile-scoped read (own sessions only).
- `agent_profile`: one per workspace. Dual RLS: JWT + API key read policies.

## Key invariant checks

| Invariant | Enforcement | ADR |
|---|---|---|
| Every POST body omits `profile_id`/`actor_id` | `invariants:server-actor` CI script | ADR-0151 |
| Every capability in registry appears in intent enum | `invariants:intent-coverage` CI script | ADR-0112 |
| `gate_action` is sole auth gate | `invariants:gate-singleton` CI script | ADR-0099 |
| Every emit() event in registry.ts | `invariants:emit-coverage` CI script | ADR-0116, ADR-0175 |
| Every capability tool accepts `AgentToolContext` | `pnpm turbo typecheck` | ADR-0099 |
| `deriveProfileId` called before tool dispatch | `agent-chat-forged-profile.test.ts` integration test | ADR-0151 |
