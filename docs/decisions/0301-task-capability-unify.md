---
title: "ADR-0301: Task Capability Unification (Sortie 3)"
id: ADR_0301
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0301: Task Capability Unification (Sortie 3)

## Context

This is the Sortie 3 implementation decision for ADR-0298 row 3: write-surface unification. Sorties 1 (ADR-0299) and 2 (ADR-0300) closed the mobile BFF defense layer and the `fn_list_my_tasks` read-surface respectively. Sortie 3 ships the `task` capability itself — the single registered write surface that replaces three shadow paths: `personal.create_task`, `operations.complete_task`, and `addTaskAction` Server Action.

Before this sortie, Botsson could not answer "hva må jeg gjøre i dag" (no capability tool returned a union across task surfaces), a manager saying "lag oppgave til Anna" wrote to the manager's own `personal_task` (cross-assign bug), and `addTaskAction` was a shadow Server Action invisible to C4 governance (ADR-0287 violation).

For full architecture context, decision drivers, and the five-sortie migration plan, see **ADR-0298**.

## Decision Drivers

From ADR-0298 §2 goals + non-goals, applied to Sortie 3 scope:

- **Single capability surface**: agent + intent-classifier must route all task verbs to one `task` capability instead of three shadow paths.
- **C4 governance visibility** (ADR-0287): every write tool must be registered with `gate_action`.
- **Identity derivation** (ADR-0151): no body-supplied `workspace_id` / `profile_id`. `assignee_profile_id` is the explicit exception; workspace membership must be verified before INSERT.
- **Voice channel safety** (ADR-0288): free-text-write tools chat-only V1; list/complete allowed on voice.
- **Backward compatibility**: `addTaskAction` callers must be unbroken; `task.added_manual` telemetry alias kept 30 days.
- **Non-goals**: no mobile Kalender UI (Sortie 4), no `engine_state_step` exposure (ADR-0298 R2), no voice unlock on `create_*` tools.

## Decision Outcome

**Chosen: ship as specified in ADR-0298 §Architecture + Sortie 3 design spec, with three implementation clarifications discovered during build.**

### Clarification 1 — `list_mine` uses direct table UNION, not `fn_list_my_tasks` RPC

The RPC is `SECURITY DEFINER` and derives identity from `auth.uid()`. When invoked from a capability tool with a `service_role` client, `auth.uid()` is NULL — the UNION returns 0 rows silently. Direct table reads using the JWT-scoped supabase client correctly scope by `workspace_id` + `profile_id`. Decision: direct UNION in tool body; RPC remains the mobile hook path.

### Clarification 2 — `fn_list_my_tasks` v2 migration must DROP first

`CREATE OR REPLACE FUNCTION` cannot change `RETURNS TABLE` column shape. The v2 migration runs `DROP FUNCTION IF EXISTS fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ)` before the CREATE, preserving idempotency on repeat `migration up` runs.

### Clarification 3 — Alias shim lives in `router.ts`, not `intent-classifier.ts`

Post-classifier guard `aliasTaskVerbs(intent)` in `router.ts` rewrites `personal`+task-verb → `task`. Placement in router preserves classifier eval harness integrity — evals test model output, not routing policy.

## Architecture Summary

Four-block architecture as shipped:

**1. Capability shape** (`packages/ai/src/capabilities/task/`)

```
index.ts   — taskCapability definition; allowedChannels per tool
gate.ts    — gateTaskAction helper + resolveAssigneeWorkspaceMembership
tools.ts   — six defineTool() exports
__tests__/ — 16 vitest cases covering gate trips, channel enforcement, telemetry shape
```

Six tools with channel and authority policy:

| Tool | Writes to | Min Role | Channel V1 |
|------|-----------|----------|------------|
| `task.list_mine` | (read) | — (ungated) | chat + voice |
| `task.create_personal` | `personal_task` | employee | chat-only |
| `task.create_session` | `session_task` | manager | chat-only |
| `task.create_day_ad_hoc` | `schedule_day_task` | manager | chat-only |
| `task.complete` | source-dispatched | self or manager | chat + voice |
| `task.cancel_personal` | `personal_task` | self | chat-only |

**2. BFF route** (`apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts`)

POST verb. `resolveMobileActor()` mandatory at entry (ADR-0134 fail-fast). Delegates to `task.complete` tool body with `source` from request body. No body-supplied identity fields (ADR-0151). Closes ADR-0298 R3 mobile-mutation-via-BFF mandate for the completion verb.

**3. Intent-classifier + router** (`packages/ai/src/router/`)

`intent-classifier.ts` enum extended with `"task"`. 11 intent-classifier test cases green. `aliasTaskVerbs()` shim in `router.ts` routes `personal`+task-verb → `task` for 30-day A/B window; removed in Sortie 5 closure ADR.

**4. `collector.ts` R7** (`packages/ai/src/context/collector.ts`)

`personal_task` fetch added as 6th `Promise.all` member. `AgentContext.personalTasks` new field in `types.ts`. Prompt assembler injects `<active_tasks>` slice when non-empty (max 10 lines, mirroring `<world_state>` injection pattern from ADR-0281). Closes ADR-0298 R7 agent-memory mandate.

### Telemetry

Five canonical events registered in `packages/telemetry/src/registry.ts` with 4-destination routing (PostHog, Logger, `activity_trail`, `engine_event`):

```
"task created"    { source, actor_kind, assigned_to_self }
"task completed"  { source, actor_kind, completed_via }
"task cancelled"  { source, reason }
"task assigned"   { source, from_actor, to_actor }
"task overdue"    { source: 'session', auto: true }
```

`task.added_manual` retained as alias for 30 days (deprecation: Sortie 5 closure, ~2026-06-13).

### SQL migrations (this sortie)

| Migration | Purpose |
|-----------|---------|
| `20260607100000_task_capability_authority_seed.sql` | Seeds `engine_authority_config(capability='task', level='suggest')` per workspace |
| `20260607100100_fn_list_my_tasks_v2_hook_links.sql` | Drops + recreates `fn_list_my_tasks` adding `hook_linked_procedure_id UUID` + `hook_linked_routine_id UUID` columns; SESSION branch JOINs `session_hook`; other sources NULL-fill |

### Test coverage

- 16 vitest cases: gate trips, channel enforcement, cross-workspace reject, telemetry shape
- 11 intent-classifier cases: task verb coverage + alias backstop
- 13 pgTAP assertions: authority seed per workspace, v2 RPC column presence, SESSION JOIN correctness, NULL-fill for non-session sources

## Consequences

### Good

- **Single write surface**: all task mutations route through the `task` capability; C4 governance dashboardable.
- **Cross-assign works correctly**: manager → Anna creates a `session_task` with `assigned_to=anna_uuid`; pre-Sortie-3 it wrote to manager's `personal_task`.
- **Botsson can answer task queries**: `task.list_mine` unions all 4 sources; system prompt carries `<active_tasks>` slice.
- **`addTaskAction` callers unbroken**: thin wrapper preserves exact signature, return shape, and error contract.
- **Voice safety**: `create_*` tools chat-only V1 closes free-text PII vector on voice transcript.
- **Learnings captured**: 4 new L-slots (SECURITY DEFINER + service_role, DROP FUNCTION IF EXISTS, gen-types stderr, structural typing win).

### Bad

- **30-day alias window**: `task.added_manual` + `aliasTaskVerbs()` shim add temporary complexity. Removed in Sortie 5.
- **`list_mine` not using RPC**: direct UNION in tool body is a slight deviation from the spec intent (spec §4.1 expected RPC reuse). Correct and tested, but creates a divergence between the tool path and the mobile hook path.
- **`emma_task` auto-schedule writer identity (Q11)**: still undocumented. Affects agent-prompt accuracy, not data integrity.

### Agent Impact

- Mr. Botsson routes all task verbs through `task` capability after this sortie.
- `personal` capability remains active for `add_note`, `set_reminder`, `get_history`, `update_setting`; task-verbs alias-shimmed for 30 days.
- Voice sessions: `task.list_mine` + `task.complete` available on voice; create/cancel deflect with "Si dette på tekst."
- `task.complete(id, source)` is the canonical complete verb — agent never directly mutates task tables.
- System prompt now carries `<active_tasks>` slice when employee has open personal tasks.

## Cross-references

- **ADR-0298** — Task ontology, 5-sortie migration plan, all rules (R1-R8), open questions (Q11-Q15)
- **ADR-0299** — Sortie 1: mobile BFF defense + RLS WITH CHECK + schema tighten
- **ADR-0300** — Sortie 2: `fn_list_my_tasks` RPC + mobile `useMyTasks` rewire
- **ADR-0151** — Server-derived identity; `assignee_profile_id` is the declared exception
- **ADR-0132** / **ADR-0133** / **ADR-0134** — Mobile thin-client + telemetry contract
- **ADR-0281** — engine_world `<world_state>` injection pattern (mirrored by `<active_tasks>`)
- **ADR-0287** — `gate_action` mandatory on mutation capability tools
- **ADR-0288** — Voice channel policy split; chat-only on free-text-write tools V1
