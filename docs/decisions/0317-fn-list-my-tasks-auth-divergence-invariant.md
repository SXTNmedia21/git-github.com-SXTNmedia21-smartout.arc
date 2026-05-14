---
title: "fn_list_my_tasks — Auth Divergence Invariant and TS-Fallback Contract"
id: ADR_0317
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: task-manager
tags: [rpc, security-definer, auth-uid, service-role, ts-fallback, drift-prevention]
related: [ADR-0298, ADR-0300, ADR-0301, L-0245]
---

# ADR-0317: fn_list_my_tasks — Auth Divergence Invariant and TS-Fallback Contract

## Context and Problem Statement

`fn_list_my_tasks` is a `SECURITY DEFINER` RPC that resolves caller identity via `auth.uid()` internally
(ADR-0151 server-derivation invariant). It was shipped in two migrations:

- `20260606120100_fn_list_my_tasks.sql` — v1: 16 columns, 4-source UNION
- `20260607100100_fn_list_my_tasks_v2_hook_links.sql` — v2: 18 columns, adds
  `hook_linked_procedure_id` + `hook_linked_routine_id` via LEFT JOIN session_hook on ARM 1

The capability tool `task.list_mine` (`packages/ai/src/capabilities/task/tools.ts`) cannot call this RPC
directly: the stage-engine invokes Supabase with `service_role` JWT, which sets `auth.uid() = NULL`.
A `SECURITY DEFINER` function sees the definer's `search_path`, but the `caller_profiles` CTE
(`WHERE user_id = auth.uid()`) returns zero rows when `auth.uid()` is NULL — the RPC silently returns
an empty result set.

This creates **two distinct execution paths** for one logical operation. L-0245 codified the rule: these
paired paths require explicit drift markers and a shared invariant document. This ADR is that document.

## Decision Drivers

- **ADR-0298 R4**: internal callers (stage-engine, Edge Functions) MUST use direct table reads, not the RPC.
- **ADR-0151**: `workspace_id` + `profile_id` are always server-derived — never body-supplied.
- **ADR-0099 Law 1**: every query scopes by `workspace_id`.
- **L-0245**: paired RPC + TS paths require top-of-function drift marker + shared invariant ADR.
- **L-0042**: migration causal ordering — this ADR supersedes no migration, only documents existing ones.

## Decision

### Invariant 1 — Caller identity source per path

| Caller | Auth method | `auth.uid()` | Identity source |
|--------|-------------|--------------|-----------------|
| Mobile anon JWT (client) | RLS + SECURITY DEFINER | Resolves to user UUID | `caller_profiles` CTE in RPC |
| Web browser (authed session) | RLS + SECURITY DEFINER | Resolves to user UUID | `caller_profiles` CTE in RPC |
| stage-engine (`service_role`) | Bypasses RLS | NULL | `ctx.workspaceId` + `ctx.profileId` in TS-fallback |
| Edge Functions (`service_role`) | Bypasses RLS | NULL | Direct table reads per ADR-0298 R4 |

### Invariant 2 — RPC GRANT surface

```
GRANT EXECUTE ON FUNCTION public.fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
-- NOT granted to service_role or anon.
```

`service_role` bypasses RLS and the EXECUTE grant check entirely. The explicit exclusion is
documentation-by-policy: internal callers should NOT call the RPC because they would get empty results,
not because they are denied. The grant restriction prevents accidental anon-JWT calls that would
also return empty results (anon has no `user_id` in `profile`).

### Invariant 3 — TS-fallback shape contract

The TS fallback in `packages/ai/src/capabilities/task/tools.ts` (`listMine.execute`) MUST produce a
row shape equivalent to the v2 RPC return type. Required columns:

| Column | Type | Source mapping |
|--------|------|---------------|
| `id` | UUID | per-source PK |
| `source` | TEXT | `'session'` / `'day_ad_hoc'` / `'personal'` / `'emma'` |
| `status` | TEXT | normalized (pending/done/cancelled/triggered) |
| `title` | TEXT | per-source title/label field |
| `description` | TEXT / null | per-source or null |
| `due_at` | TIMESTAMPTZ / null | per-source date field |
| `priority` | TEXT | synthesized or `fn_normalize_priority` equivalent |
| `assigned_to` | UUID / null | per-source assignee or owner profile_id |
| `workspace_id` | UUID | from `ctx.workspaceId` |
| `session_id` | UUID / null | `department_session_id` or null |
| `hook_id` | UUID / null | `session_hook_id` or null |
| `compliance` | BOOLEAN | `is_compliance_required` or false |
| `created_at` | TIMESTAMPTZ | per-source |
| `completed_at` | TIMESTAMPTZ / null | per-source or null |
| `origin_actor` | TEXT | `'cascade_cron'` / `'human'` / `'agent_auto'` |
| `hook_linked_procedure_id` | UUID / null | ARM 1 only (v2 addition) |
| `hook_linked_routine_id` | UUID / null | ARM 1 only (v2 addition) |

**V1 TS-fallback gap (known, accepted):** The TS path does NOT currently project `hook_linked_procedure_id`
and `hook_linked_routine_id` (v2 columns). Stage-engine callers do not yet consume these fields. When a
consumer of the TS path requires these columns, the TS body MUST be updated in the same PR as the
consumer — not as a follow-up. This is tracked via the drift marker in `tools.ts` (L-0245 Rule 1).

### Invariant 4 — Drift marker requirement

Both artifacts MUST carry a paired cross-reference comment at the point of divergence.

**SQL side (migration body comment):**
```sql
-- PAIRED PATH NOTE (ADR-0317 / L-0245):
-- This RPC is SECURITY DEFINER using auth.uid(). service_role callers (stage-engine)
-- get auth.uid()=NULL → zero rows. Internal callers MUST use the TS-fallback in
-- packages/ai/src/capabilities/task/tools.ts (listMine.execute).
-- When this RPC gains new columns or changed filters, update the TS-fallback in lockstep.
```

**TS side (execute body comment):**
```ts
// MIRROR OF fn_list_my_tasks v2 (supabase/migrations/20260607100100_*)
// RPC uses SECURITY DEFINER + auth.uid() — service_role caller gets NULL → zero rows.
// This TS path replicates the UNION with explicit ctx filters (ADR-0298 R4, L-0245).
// INVARIANT: When fn_list_my_tasks changes, this body MUST change in lockstep (ADR-0317).
// Owners: system-agent-coordinator + harness-builder
```

### Invariant 5 — Migration evolution protocol

When a future sortie adds columns or changes filter logic in `fn_list_my_tasks`:

1. The migration file MUST add the paired-path comment (Invariant 4 SQL side).
2. A PR reviewer MUST verify the TS-fallback projects the new columns before merge.
3. If the TS-fallback is intentionally left behind (known acceptable gap), it MUST be documented
   under "V-N TS-fallback gap" in this ADR with: column names, reason for delay, and the Linear ticket
   that tracks the catch-up.
4. `close-feature.sh` SHOULD surface a grep-check: `grep -r "fn_list_my_tasks" packages/ai/src/capabilities/task/tools.ts` — failure = drift marker removed.

## Return Shape and Status Normalization (v2 canonical)

The normalized `status` field maps per-source raw values as follows:

| Source | Raw status | Normalized status |
|--------|-----------|------------------|
| `session_task` | `pending` | `pending` |
| `session_task` | `in_progress` | `in_progress` |
| `session_task` | `completed` | `done` |
| `session_task` | `cancelled` | `cancelled` |
| `session_task` | `overdue` | `overdue` |
| `session_task` | other | delegated to `fn_normalize_session_task_status()` |
| `schedule_day_task` | `pending` / `open` | `pending` |
| `schedule_day_task` | `completed` / `done` | `done` |
| `schedule_day_task` | `cancelled` | `cancelled` |
| `schedule_day_task` | other | `pending` (catch-all) |
| `personal_task` | `open` | `pending` |
| `personal_task` | `done` | `done` |
| `personal_task` | `cancelled` | `cancelled` |
| `personal_task` | other | `pending` |
| `emma_task` | `pending` | `pending` |
| `emma_task` | `triggered` | `triggered` |
| `emma_task` | `done` | `done` |
| `emma_task` | `dismissed` | `cancelled` |
| `emma_task` | other | `pending` |

`engine_state_step` is explicitly EXCLUDED (ADR-0298 R2 — workflow runtime, never user-visible as task).

## Window Defaults

```sql
p_window_start  DEFAULT (now() - INTERVAL '1 day')
p_window_end    DEFAULT (now() + INTERVAL '7 days')
```

`personal_task` and `emma_task` ARM include rows with `due_at IS NULL` (open backlog) regardless of window.
`session_task` and `schedule_day_task` ARM filter strictly by window (date-anchored domain objects).

## Multi-Workspace Behavior

`caller_profiles` CTE returns ALL active profiles for `auth.uid()`:

```sql
SELECT profile_id, workspace_id
FROM public.profile
WHERE user_id = auth.uid() AND is_active = true
```

A user with profiles in 3 workspaces receives the full UNION across all three (ADR-0298 R8).
The TS-fallback uses `ctx.workspaceId` (single workspace per stage-engine session) — this is a known
behavioral divergence. Multi-workspace union in the agent path requires the agent to be invoked once per
workspace or the caller to UNION explicitly. This is acceptable for V1 (single-workspace stage-engine
sessions are the norm per session-context BFF derivation).

## Consequences

- Mobile clients and browser sessions CALL the RPC directly via `supabase.rpc('fn_list_my_tasks', {...})`.
- Stage-engine CALLS the TS-fallback in `listMine.execute`. Never calls the RPC.
- Both paths MUST be updated when the RPC schema changes.
- The drift marker pattern from L-0245 is BINDING on all future fn_list_my_tasks evolutions.
- `task.list_mine` telemetry event (read-path, posthog + logger only) is registered in
  `packages/telemetry/src/registry.ts` and emitted by the consumer (BFF or UI hook) on successful
  fetch — NOT inside the RPC body or the TS-fallback execute function itself.

## Links

- `supabase/migrations/20260606120100_fn_list_my_tasks.sql` — v1 original
- `supabase/migrations/20260607100100_fn_list_my_tasks_v2_hook_links.sql` — v2 current
- `packages/ai/src/capabilities/task/tools.ts` — TS-fallback (listMine.execute)
- `packages/telemetry/src/registry.ts` — `task.list_mine` event registration
- ADR-0298: Task ontology, five sources, read-surface mandate
- ADR-0300: Sortie B — RPC ship + mobile rewire
- ADR-0301: Sortie 3 — capability unification
- L-0245: Paired RPC + TS-path drift-marker rule
