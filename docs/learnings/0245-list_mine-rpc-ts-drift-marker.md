---
title: "L-0245 — RPC + TS-fallback path duo requires paired drift markers"
id: L-0245
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: agent-architecture
tags: [rpc, security-definer, auth-uid, drift, codeowners, list-my-tasks]
related: [ADR-0298, L-0042]
---

# L-0245: RPC + TS-fallback path duo requires paired drift markers

## Trigger

Sortie 3 shipped `task.list_mine` tool. Implementation choice: query `fn_list_my_tasks` RPC v2 (18 cols, 4-source UNION).

Problem: RPC is `SECURITY DEFINER` using `auth.uid()`. Stage-engine invokes Supabase with `service_role` JWT (`auth.uid() = NULL`). RPC returns zero rows in agent context.

Solution: tool body bypasses RPC, performs 4 direct table queries with explicit `ctx.workspaceId` + `ctx.profileId` filters (equivalent UNION shape in TS).

Council 2026-05-13: this creates a paired implementation. Two distinct paths (RPC for mobile anon, TS for stage-engine service_role) representing the same logical query. Sortie 3 v2 RPC added `hook_linked_procedure_id` + `hook_linked_routine_id`. The TS path did NOT project these. **Drift has already started.**

## Pattern

When a capability tool can't use an existing RPC (due to security context mismatch), the natural fix is to re-implement the UNION inline. This creates two source-of-truth paths for one logical operation. When the RPC evolves (new column, modified filter), the TS path silently lags. Mobile starts depending on the new column → service_role agent queries return stale shape → telemetry diverges → contributor files bug.

Same class as L-0042 (migration timestamp ordering) — both about cross-artifact discipline. Different vector: L-0042 is creation-time, this is evolution-time.

## Rule

When TS code path mirrors an RPC's logic (because of security-context mismatch or perf):

1. **Top-of-file comment in TS path** explicitly naming the RPC + the constraint:
   ```ts
   // MIRROR OF fn_list_my_tasks v2 (supabase/migrations/20260607100100_*)
   // RPC uses SECURITY DEFINER + auth.uid() — service_role caller gets NULL → zero rows.
   // This TS path replicates the UNION with explicit ctx filters.
   // INVARIANT: When fn_list_my_tasks changes, this body MUST change in lockstep.
   // Owners: system-agent-coordinator + harness-builder
   ```

2. **Matching comment in RPC migration** at function definition naming the TS path:
   ```sql
   -- TS MIRROR: packages/ai/src/capabilities/task/tools.ts:listMine body
   -- Stage-engine service_role uses TS path (auth.uid() returns NULL in that context).
   -- INVARIANT: keep column set + WHERE clauses aligned.
   ```

3. **Dev-mode runtime assertion** (vitest setup, or stage-engine boot) that calls the RPC + introspects column set vs TS expected shape; fail-fast on mismatch. Catches forgotten lockstep updates.

4. **CODEOWNERS entry** for the migration directory pattern requires review by both `system-agent-coordinator` + `botsson-harness-builder` on any change to RPC files matching `fn_list_my_tasks*.sql`.

## Mitigation

Pre-merge condition on `campaign/sortie-5-task-cutover` → development:

Add the paired marker comments per rule above to:
- `packages/ai/src/capabilities/task/tools.ts` (top of `listMine` body)
- `supabase/migrations/20260607100100_fn_list_my_tasks_v2_hook_links.sql` (top of CREATE FUNCTION)

Defer rule 3 (runtime assertion) + rule 4 (CODEOWNERS) to follow-up sortie.

## Long-term direction

Correct architectural fix is `fn_list_my_tasks_for_actor(p_workspace_id UUID, p_profile_id UUID)` — explicit-identity RPC variant callable from service_role. Eliminates the TS mirror. When mobile depends on `hook_linked_*` columns AND the same mobile flow needs to be agent-reachable, fork the work.

## Sibling references

- ADR-0298 row 4 (Sortie 3 task capability)
- L-0042 (migration timestamp ordering — cross-artifact discipline)
- L-0233 (voice Realtime LLM ≠ stage-engine LLM)
