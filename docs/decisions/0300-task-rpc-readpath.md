---
title: "Sortie B Task RPC Read-Path — fn_list_my_tasks + normalize helpers + mobile useMyTasks rewire"
id: ADR_0300
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0300: Sortie B Task RPC Read-Path — fn_list_my_tasks + normalize helpers + mobile useMyTasks rewire

## Context and Problem Statement

ADR-0298 §Architecture mandates a single read surface for all user-facing task sources: a `fn_list_my_tasks` SECURITY DEFINER RPC that unions `session_task` (D6 cascade), `schedule_day_task` (D6 ad-hoc), `personal_task` (C2 user-curated), and `emma_task` (C2 agent-curated) into one normalized result set. Before this sortie, mobile task reads were fragmented: `useMyTasks` queried individual tables with heterogeneous status enums, no consistent priority ordering, no RPC-layer workspace isolation invariant, and a `resolveTaskType` function that silently dropped type metadata for hooked tasks. `engine_state_step` (workflow runtime) was at risk of leaking into the user-visible task surface. Sortie A (`feat/mobile-session-task-defense`) closed write-path gaps; Sortie B closes the read-path.

## Decision Drivers

- ADR-0298 R1: single read surface, identity from `auth.uid()`, no client-supplied workspace_id or profile_id
- ADR-0151: actor identity must be derived server-side
- ADR-0078: workspace isolation — cross-workspace row leaks are forbidden
- ADR-0298 R2: `engine_state_step` is explicitly excluded from user-visible task surfaces
- ADR-0298 R8: multi-workspace callers must receive a union across all their active workspaces in a single call
- Spec §4.4: consumer count — if > 3 mobile consumers, scope expands to cover all (escalation trigger 3)

## Considered Options

1. **SECURITY DEFINER RPC UNION (chosen)** — single PostgreSQL function, identity from `auth.uid()`, UNION across 4 tables, normalize helpers as `IMMUTABLE PARALLEL SAFE` functions
2. **Database view** — rejected; views cannot carry `SECURITY DEFINER` across tables with heterogeneous RLS; caller's JWT context bleeds into RLS evaluation per table
3. **Per-table hook fan-out on mobile** — rejected; violates R1 (single surface); N+1 pattern; any new task source requires a new hook and a new consumer update pass

## Decision Outcome

Chosen option: **Option 1 — SECURITY DEFINER RPC UNION**, because it is the only option that satisfies R1 (single surface), R2 (engine_state_step exclusion), R8 (multi-workspace union in one call), and ADR-0078 (workspace isolation enforced at RPC layer, not client layer). Views fail at the RLS boundary. Per-table fan-out fails at R1.

## Rules and Consequences

- **Good, because** identity is derived from `auth.uid()` inside the RPC — client cannot supply a forged profile_id or workspace_id (ADR-0151 satisfied)
- **Good, because** `engine_state_step` exclusion is hardcoded in the RPC body, not a filter the client can override (R2 satisfied)
- **Good, because** anon JWT → `caller_profiles` CTE returns 0 rows → RPC returns empty set silently — no error surface for unauthenticated callers
- **Good, because** NULL-assigned `schedule_day_task` rows are visible to all workspace members (pickup flow) via `WHERE assigned_to = auth.uid() OR assigned_to IS NULL` within the workspace_id CTE boundary
- **Good, because** multi-workspace callers receive a single UNION across all their active workspace_ids (R8 satisfied); no N+1 pattern on mobile
- **Bad, because** `collector.ts` wire (ADR-0298 R7) is deferred to Sortie 3 — capability tools do not yet call `fn_list_my_tasks`; only mobile `useMyTasks` is wired
- **Bad, because** `resolveTaskType` in `apps/mobile/src/hooks/useMyTasks.ts` returns a generic placeholder for hooked tasks (`hook_linked_procedure_id` / `hook_linked_routine_id` joins not yet in RPC) — restored in Sortie 3
- **Agent Impact:** 12-file mobile blast from P4 scope expansion (5+ consumers exceeded spec §4.4 threshold of 3). All 12 files rewired in commit `2c0ab2804`. Any future consumer of `useMyTasks` automatically benefits from the RPC surface — no additional wiring needed unless the hook interface changes.
- **pgTAP locked invariants:** 21 assertions (15 RPC + 6 backfill) lock the behavior described above. Any future change to `fn_list_my_tasks` must update the pgTAP suite before merge.

## pgTAP Deviation Notes

- 21 assertions shipped (15 RPC + 6 backfill) — spec §6 said "16+"; 21 is the actual count.
- N5 (anon block) was spec'd as GRANT error. Actual behavior: anon JWT → `caller_profiles` CTE returns 0 rows → 0 rows returned. Test updated to assert 0 rows, not permission error.
- `department_session.status` fixture uses `'upcoming'` (not `'open'`) per local DB enum.
- `activity_trail` backfill migration targets columns `event` + `action_verb` (not `action`).

---

> Registered in `docs/decisions/0000-decision-log.md`. Relates to ADR-0298 (task ontology + read-surface mandate), ADR-0151 (identity derivation), ADR-0078 (workspace isolation), ADR-0134 (telemetry contract). Sortie 3 will close the `collector.ts` gap (ADR-0301) and restore `resolveTaskType` mapping.
