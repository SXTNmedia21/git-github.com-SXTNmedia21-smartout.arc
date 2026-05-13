---
title: "Sortie 3 — Task Capability Unification (Design Spec)"
slug: sortie-3-task-capability-unify
status: ready
revision: v1
layer: spec
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0298
sortie_adr_reserved: ADR-0301
related_sorties: [Sortie-1 (ADR-0299), Sortie-2 (ADR-0300)]
tags: [sortie, spec, capability, task, ADR-0298, ADR-0301]
---

# Sortie 3 — Task Capability Unification (Design Spec)

> **Spec for orchestrator + build agents.** Lives alongside the plan; agents read this for context, plan for execution sequence. ADR-0298 row 3 is the canonical scope; this spec resolves the open implementation questions.

## 1. Goal

Ship the canonical `task` capability with 6 tools, register it in `capabilities/registry.ts`, extend the intent-classifier enum, wire `collector.ts` R7 (personal_task in system-prompt assembly), restore `resolveTaskType` procedure/checklist resolution, and route `addTaskAction` body through `task.create_session`. No mobile UI work (deferred to Sortie 4). No new task tables (the 5-source ontology is frozen per ADR-0298 R1).

## 2. Non-goals

- **Mobile Kalender UI** — Sortie 4 owns AddSheet, FAB-rewire, ProgressRing summary card.
- **emma_task auto-schedule writer changes** — `emma_task` mutations stay internal to Botsson's existing scheduler. The `task.complete(id, source='emma')` tool dispatches to the existing `/api/emma/tasks/dismiss` endpoint; nothing else changes.
- **`engine_state_step` exposure** — ADR-0298 R2 forbids; never readable through `task`.
- **`personal` capability deletion** — kept for 30 days as alias surface for `add_note`, `set_reminder`, `get_history`, `update_setting`. Only `create_task` task-verb deprecates.
- **RLS WITH CHECK audit** — out-of-band sortie (parallel-safe per ADR-0298 row A).
- **Voice unlock on `create_*` tools** — V1 chat-only per ADR-0298 R6; V2 (post-PII-detector) is a future ADR.

## 3. Canonical reality (locked 2026-05-13)

Pre-flight greps already confirmed:

- `fn_list_my_tasks(p_window_start, p_window_end)` RPC exists (Sortie B `20260606120100_fn_list_my_tasks.sql`); returns 16 columns including `source`, `status`, `raw_status`, `priority`, `compliance`, `hook_id`, `origin_actor`.
- `fn_normalize_session_task_status(status)` + `fn_normalize_priority(priority)` SQL helpers exist (Sortie B `20260606120000_fn_normalize_task_status_priority.sql`).
- `personal_task` table exists (`20260520100000_personal_task.sql`). RLS = owner-only JWT + service_role + api_key_read.
- `session_task` table exists. RLS UPDATE has WITH CHECK (Sortie 1 closure).
- `schedule_day_task` table exists. RLS UPDATE has WITH CHECK (audit, no change needed).
- `emma_task` table exists. Dismiss path `/api/emma/tasks/dismiss/route.ts` exists.
- `addTaskAction` Server Action at `apps/web/src/app/dashboard/_actions/add-task-action.ts:55` exists. Already `gateAction('task.add_task_manual')` gated. Server-derived identity per ADR-0151.
- `personal.createTask` tool at `packages/ai/src/capabilities/personal/tools.ts:135` exists.
- `intent-classifier.ts` capability enum has `personal` (line 63); does NOT yet have `task`.
- `CapabilityName` union type in `packages/ai/src/capabilities/types.ts` must mirror enum extension.
- `collector.ts` (NOT `collect-context.ts` — ADR-0298 typo) at `packages/ai/src/context/collector.ts:36` runs `collectContext({...})`; currently fetches `memories` via stage-engine memory bridge but NOT `personal_task`. Insert query right after `Promise.all([...])`.
- `resolveTaskType` at `apps/mobile/src/lib/resolve-task-type.ts:41` is restored target. Currently maps `compliance → haccp`, `hook_id → confirmation`. Needs `hook_linked_procedure_id → procedure` + `hook_linked_routine_id → checklist`.
- Mobile BFF `/api/mobile/tasks/route.ts` exists (POST creates session_task). Sister endpoint `/api/mobile/tasks/[id]/route.ts` exists (PATCH complete). Need expansion to: `complete` action delegates per-source.

## 4. Architecture

### 4.1 Six tools (file layout)

```
packages/ai/src/capabilities/task/
├── index.ts           — taskCapability definition; allowedChannels per tool (chat+voice for read+complete+cancel; chat-only for create_*)
├── gate.ts            — gateAction wrapper helpers (mirrors personal/gate.ts)
├── tools.ts           — six tool defineTool() exports
└── __tests__/
    └── tools.test.ts  — vitest suite (gate trips, identity derivation, channel enforcement)
```

Tools (signatures):

```ts
task.list_mine({ window_start?: ISODateTime; window_end?: ISODateTime }) → { tasks: MyTaskRow[] }
task.create_personal({ title: NonEmptyString; due_at?: ISODateTime; priority?: 'low'|'normal'|'high'|'urgent' }) → { id: UUID }
task.create_session({ session_id: UUID; title: NonEmptyString; assignee_profile_id?: UUID; hook_id?: UUID; compliance?: boolean; reason: NonEmptyString }) → { id: UUID }
task.create_day_ad_hoc({ date: ISODate; title: NonEmptyString; assignee_profile_id?: UUID; highlight?: boolean; category?: TEXT }) → { id: UUID }
task.complete({ id: UUID; source: 'session'|'personal'|'day_ad_hoc'|'emma' }) → { ok: true }
task.cancel_personal({ id: UUID; reason: NonEmptyString }) → { ok: true }
```

### 4.2 Channel policy (V1)

Per ADR-0298 R6: `create_personal`, `create_session`, `create_day_ad_hoc`, `cancel_personal` are CHAT-ONLY in V1 (free-text PII risk). `list_mine` and `complete` are chat + voice (no free-text input). Channel enforcement at capability `allowedChannels` array level + per-tool runtime check.

### 4.3 Authority gate per tool

Per ADR-0298 Authority Model + ADR-0287:

| Tool | gate_action capability | level | actor predicate |
|---|---|---|---|
| `list_mine` | (ungated, read) | — | always allow |
| `create_personal` | `task.create_personal` | suggest | self (employee+) |
| `create_session` | `task.create_session` | suggest | manager+ AND workspace-membership-verified on `assignee_profile_id` |
| `create_day_ad_hoc` | `task.create_day_ad_hoc` | suggest | manager+ |
| `complete` | `task.complete` | suggest | source-dependent (see 4.5) |
| `cancel_personal` | `task.cancel_personal` | suggest | self only |

Authority seeded in migration `20260607100000_task_capability_authority_seed.sql` (mirrors `personal_task.sql` lines 80-100 pattern, but capability key = `'task'`).

### 4.4 Identity derivation (ADR-0151)

Every tool receives `AgentToolContext` which already carries `workspaceId` + `profileId` server-derived. No tool parameter accepts `workspace_id` / `profile_id` / `completed_by`. Body schemas have `.strict()` (forbid extras, per L-0237).

The `assignee_profile_id` parameter on `create_session` is the explicit exception (cross-assign). Workspace-membership check at tool entry: `SELECT 1 FROM profile WHERE profile_id = $1 AND workspace_id = $ctx.workspaceId AND is_active = true`. Reject with explicit error if absent.

### 4.5 Source dispatch on `task.complete`

```
source='personal'    → UPDATE personal_task SET status='done', updated_at=now() WHERE id=$1 AND profile_id=$ctx.profileId
source='session'     → existing operations.complete_task tool's body (gated by manager+ OR assigned_to=self); reuse helper
source='day_ad_hoc'  → UPDATE schedule_day_task SET status='completed' (status enum: open|completed|cancelled) WHERE id=$1 AND workspace_id=$ctx.workspaceId AND (assigned_to=$ctx.profileId OR is_admin)
source='emma'        → POST /api/emma/tasks/dismiss with { id } and forwarded auth; existing endpoint handles cascade
```

Telemetry single emit `"task completed"` with `{ source, completed_via }` discriminator. Replaces 4 disjoint events (`session_task.completed`, `personal.task_completed`, `emma_task.dismissed`, `day_task.completed`) — keep aliases for 30 days.

### 4.6 BFF route for mobile completion (ADR-0298 R3 closure)

`apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` (new file, POST verb):

```ts
// Body: { source: 'session'|'personal'|'day_ad_hoc'|'emma' }
// Identity: server-derived from Bearer JWT via resolveMobileActor()
// Delegates to: stage-engine /agent/tools/task.complete OR direct task tool body
```

Existing mobile direct-mutation in `(me)/tasks/[id].tsx` was already deleted in Sortie 1. The new BFF route is the single replacement.

### 4.7 `addTaskAction` delegation pattern

Body of `apps/web/src/app/dashboard/_actions/add-task-action.ts:55` is preserved verbatim — but exposed as the body of `task.create_session` tool by import + invocation. The Server Action becomes a thin wrapper:

```ts
// add-task-action.ts (after)
export async function addTaskAction(input, actor?, channel='chat') {
  return runTaskTool('create_session', { ...input }, { actor, channel });
}
```

Keeps `WebDayControl Oppgaver` tab working without UI change. Telemetry event renamed `task.added_manual` → `"task created"` with `{ source: 'session', actor_kind: actor.role, ... }` carrying `manual: true` metadata. 30-day alias retained.

### 4.8 `intent-classifier.ts` extension

Add `"task"` to the `capability` enum at `packages/ai/src/router/intent-classifier.ts:38-72`. Add example entries to the eval harness covering 6 task verbs. Update `CapabilityName` union in `packages/ai/src/capabilities/types.ts`.

A/B alias: when classifier returns `"personal"` AND intent contains task-verbs ("lag oppgave", "todo", "påminnelse"), route to `task` if registered (transparent migration). Implementation: post-classifier guard in `packages/ai/src/router/router.ts` (new shim `aliasTaskVerbs(intent)`) for 30 days; remove alias in Sortie 5 closure ADR.

### 4.9 `collector.ts` R7 wiring

After current `Promise.all([profile, agentProfile, relationship, memories, activeShift])`, add a 6th parallel fetch:

```ts
sb.from("personal_task")
  .select("id, title, due_at, priority, status")
  .eq("profile_id", profileId)
  .eq("workspace_id", workspaceId)
  .in("status", ["open"])
  .order("due_at", { ascending: true, nullsFirst: false })
  .limit(20)
```

Result threaded into `AgentContext.personalTasks` (new field on `types.ts`). Prompt assembler in `packages/ai/src/prompts/system.ts` (or equivalent) appends an `<active_tasks>` slice when non-empty (max 10 lines). Mirrors `<world_state>` injection pattern from engine_world Phase 1+2.

### 4.10 `resolveTaskType` restoration (Sortie B HANDOFF gap)

ADR-0298 §4.5 RPC return signature currently lacks `hook_linked_procedure_id` + `hook_linked_routine_id`. Sortie B deferred. Restoration steps:

1. Migration `20260607100100_fn_list_my_tasks_v2_hook_links.sql` — CREATE OR REPLACE adds 2 columns to RETURNS TABLE; UNION ALL clause for `source='session'` joins `session_hook` and adds `sh.linked_procedure_id`, `sh.linked_routine_id`; other sources NULL-fill.
2. Regen `packages/supabase/src/database.types.ts`.
3. Update `MyTaskRow` type in `apps/mobile/src/hooks/queries/use-my-tasks.ts` with 2 new fields.
4. Extend `resolveTaskType` to read `hook_linked_procedure_id` (→ `'procedure'`) and `hook_linked_routine_id` (→ `'checklist'`) before falling through to `'confirmation'`.

Backward-compat: existing callers receive 2 nullable fields; default behavior unchanged when both NULL.

## 5. Migration plan (this sortie's SQL)

| File | Purpose |
|---|---|
| `20260607100000_task_capability_authority_seed.sql` | Seed `engine_authority_config(capability='task', level='suggest')` per workspace |
| `20260607100100_fn_list_my_tasks_v2_hook_links.sql` | CREATE OR REPLACE fn_list_my_tasks adding 2 hook-link columns |

Both apply on top of Sortie B migrations. Idempotent.

## 6. Test surface

### 6.1 Vitest — `packages/ai/src/capabilities/task/__tests__/tools.test.ts`

- T1: `list_mine` returns rows from RPC; no `workspace_id` parameter accepted.
- T2: `create_personal` rejects strict-schema extras (`profile_id` in body → 400).
- T3: `create_personal` chat channel passes; voice channel rejects (ADR-0298 R6).
- T4: `create_session` rejects when `assignee_profile_id` belongs to other workspace.
- T5: `create_session` gate-trip: employee role denied; manager passes.
- T6: `complete` source='personal' updates row; source='session' delegates.
- T7: `complete` source='session' on row assigned to another → manager passes, employee denied.
- T8: `cancel_personal` self-only; cross-actor rejected.
- T9: Telemetry emit shape — `"task created"` with required `{source, actor_kind, assigned_to_self}`.

### 6.2 Vitest — intent-classifier coverage

- IC1: "lag oppgave til Anna" → `task` (manager voice).
- IC2: "hva må jeg gjøre i dag" → `task` (list_mine intent).
- IC3: "marker som ferdig" → `task` (complete intent).
- IC4: Alias backstop — classifier returns `personal` + task-verb → router rewrites to `task`.

### 6.3 pgTAP — `supabase/tests/sortie-3-task-capability.spec.sql`

- P1: Authority seed populated for every workspace with owner.
- P2: `fn_list_my_tasks` v2 returns `hook_linked_procedure_id` + `hook_linked_routine_id` columns.
- P3: Session-source row JOINs session_hook correctly (procedure-linked task surfaces non-NULL).
- N1: Non-session source rows NULL-fill new columns.

### 6.4 Manual smoke

- Web `/dashboard/day-control/sessions/:id` → Oppgaver tab → add task → assert telemetry `"task created"` (single event family).
- Mobile PWA `localhost:8083` → task list refresh hits RPC v2; HACCP/procedure/checklist/confirmation/general all render distinct UI per `resolveTaskType`.

## 7. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Telemetry alias-window break | 30-day alias kept (both `task.added_manual` AND `"task created"` registered); deprecation removal is Sortie 5. |
| Intent-classifier mis-route during A/B | Alias shim in router preserves `personal` task-verb path → `task` capability. Both classifiers green during window. |
| `assignee_profile_id` workspace mismatch silent-fail | Explicit fail-fast: tool returns `{ ok: false, error: 'assignee_not_in_workspace' }`. No silent fallback (L-0177). |
| `addTaskAction` Server Action callers break | Wrapper preserves exact signature + return shape. Vitest covers the wrapper. |
| `collector.ts` regression on cold-cache workspaces | Added Promise.all member is bounded `limit(20)` and same RLS profile fetch. No new join. |
| `fn_list_my_tasks` v2 query plan regression | EXPLAIN ANALYZE captured in migration commit. Indexes on `session_hook.linked_procedure_id` if missing. |
| BFF route auth bypass | `resolveMobileActor()` mandatory at entry; throws on missing/empty IDs (per ADR-0134). |

## 8. Escalation protocol

If during execution:

- **Council escalation (lead orchestrator decision)** required when:
  - Adding a 7th tool not listed above.
  - Adding fields to `RETURNS TABLE` of `fn_list_my_tasks` beyond the 2 hook-link columns (would touch ADR-0298 R8 multi-workspace contract).
  - Voice unlock proposed on any `create_*` tool (would supersede R6 — needs new ADR).
  - `engine_state_step` exposure (would violate R2 — requires ADR amendment).

- **Lead-only decision** (no council) for:
  - Helper function placement (gate.ts vs tools.ts).
  - Tool field order in zod schema.
  - Alias-shim implementation detail.

## 9. References

- ADR-0298 §4 (Architecture), §R1-R8 (Rules), §Migration Plan row 3
- ADR-0151 (server-derived identity)
- ADR-0132/0133/0134 (mobile thin-client + telemetry contract)
- ADR-0287 (gate_action mandatory on mutation tools)
- ADR-0288 (voice channel policy split)
- L-0176 (docstring drift from body)
- L-0177 (silent identity fallback)
- L-0237 (.catchall accepts forgeable identity → use .strict)
- Sortie 1 HANDOFF (BFF wrap pattern)
- Sortie 2 HANDOFF (fn_list_my_tasks contract)

---

> **Acceptance for spec close-out:** This spec exits when its plan-sibling at `docs/superpowers/plans/2026-05-13-sortie-3-task-capability-unify.md` is `status: ready` and ADR-0301 slot is reserved.
