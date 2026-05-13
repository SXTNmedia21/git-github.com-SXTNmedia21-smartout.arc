---
title: "Sortie 3 — task-capability-unify HANDOFF"
slug: task-capability-unify
status: done
revision: v1
layer: handoff
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0301
related_sorties: [Sortie-1 (ADR-0299), Sortie-2 (ADR-0300)]
target_branch: feat/task-capability-unify
tags: [sortie-3, handoff, task-capability, ADR-0298, ADR-0301]
---

# Sortie 3 — task-capability-unify HANDOFF

> Branch: `feat/task-capability-unify` | Worktree: `~/dev/smartout.ai-wt-6` | Base: `development`
> 8 commits ahead of development at closure. ADR-0298 row 3 complete.

---

## Summary

Sortie 3 ships the canonical `task` capability — the write surface that ADR-0298 declared as the single replacement for three shadow paths (`personal.create_task`, `operations.complete_task`, `addTaskAction` Server Action). This closes the third row of the ADR-0298 five-sortie migration plan.

**What shipped:**

- `packages/ai/src/capabilities/task/` — new capability directory with `index.ts`, `gate.ts`, `tools.ts`, `__tests__/tools.test.ts`
- 6 canonical tools: `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`
- `task` registered in `packages/ai/src/capabilities/registry.ts`; `CapabilityName` union extended
- `intent-classifier.ts` enum extended with `"task"`; alias shim `aliasTaskVerbs()` in `router.ts` routes `personal`+task-verb → `task` for 30-day migration window
- `collector.ts` R7 (ADR-0298 §R7): `personal_task` fetch added as 6th `Promise.all` member; `AgentContext.personalTasks` new field; `<active_tasks>` slice injected in system prompt when non-empty
- `resolveTaskType` in `apps/mobile/src/lib/resolve-task-type.ts` restored with `hook_linked_procedure_id → 'procedure'` and `hook_linked_routine_id → 'checklist'` branches
- `fn_list_my_tasks` v2 migration: adds `hook_linked_procedure_id UUID` + `hook_linked_routine_id UUID` columns; SESSION branch joins `session_hook`; other sources NULL-fill
- `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` — new POST BFF route; `resolveMobileActor()` at entry; delegates per `source` parameter
- `apps/web/src/app/dashboard/_actions/add-task-action.ts` — body rewritten as thin wrapper delegating to `task.create_session` tool body; callers unbroken
- Telemetry: `"task created"`, `"task completed"`, `"task cancelled"`, `"task assigned"`, `"task overdue"` events registered in `packages/telemetry/src/registry.ts`; `task.added_manual` alias kept 30 days
- 2 SQL migrations applied to local Supabase
- 16 vitest cases (`tools.test.ts`), 11 intent-classifier cases, 13 pgTAP assertions — all green
- ADR-0301 accepted; JOURNEY-task-capability-unify.md written

**Why this matters:** Before Sortie 3, Botsson could not answer "hva må jeg gjøre i dag" — no capability tool returned a union across task surfaces. A manager saying "lag oppgave til Anna" wrote to the manager's `personal_task`, not Anna's `session_task` (cross-assign bug). `addTaskAction` was a shadow Server Action invisible to C4 governance. All three failure modes close with this sortie.

---

## Decisions

### ADR-0301 — Task Capability Unification (Sortie 3)

See `docs/decisions/0301-task-capability-unify.md` for the full accepted decision. Key sub-decisions made during build:

**1. `list_mine` uses direct table UNION, not the `fn_list_my_tasks` RPC**

The RPC is `SECURITY DEFINER` and relies on `auth.uid()` for identity. When called from the capability tool with a `service_role` client, `auth.uid()` returns NULL — the UNION returns 0 rows instead of throwing, making the bug silent. Direct table reads against the supabase client carrying the workspace JWT correctly scope by `workspace_id` + `profile_id`. Decision: direct UNION in tool body; RPC remains the mobile hook path where JWT flows through.

**2. `DROP FUNCTION IF EXISTS` before `CREATE OR REPLACE` in v2 migration**

`CREATE OR REPLACE FUNCTION` refuses to change the `RETURNS TABLE` column list — it treats column additions as a shape change and returns a `cannot change return type of existing function` error. The migration must `DROP FUNCTION IF EXISTS fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ)` first, then `CREATE OR REPLACE`. Documented as learning (see Learnings section).

**3. Alias shim placement in `router.ts`, not `intent-classifier.ts`**

The shim must execute after classification, not inside the classifier model. Placing it in `router.ts` as a post-classifier guard (`aliasTaskVerbs(intent)`) preserves the classifier's eval harness integrity — the eval tests classify against the model output, not the shim output. The shim is a routing policy, not a classification policy.

**4. `create_session` carries `assignee_profile_id` as explicit exception to ADR-0151**

ADR-0151 forbids body-supplied identity. `assignee_profile_id` is the one explicit exception: manager assigns to another person. The tool body enforces workspace membership check before INSERT (`SELECT 1 FROM profile WHERE profile_id = $1 AND workspace_id = $ctx.workspaceId AND is_active = true`); failure returns `{ ok: false, error: 'assignee_not_in_workspace' }` with no INSERT and no emit (L-0177 fail-fast).

**5. `MyTaskRow.hook_linked_*` is `string` in database.types.ts but `string | null` in `TaskWithHook`**

The database generates non-null `string` for the new columns. `TaskWithHook` type in mobile code declares `string | null`. These are structurally assignable — no type error, no caller changes needed. TypeScript structural typing absorbs the wider type at assignment. Documented as a win: the narrower DB type is safe to assign to the wider consumer type.

**6. `addTaskAction` wrapper preserves exact function signature**

The rewrite makes `add-task-action.ts` a thin wrapper calling `runTaskTool('create_session', ...)`. The exported function signature, return type, and error shape are identical to pre-Sortie-3. All existing callers (WebDayControl Oppgaver tab) work without changes. Telemetry event renamed internally: `task.added_manual` (alias) + `"task created"` (canonical) both fire for 30 days.

---

## Learnings

### L-NEW-1: RPC SECURITY DEFINER incompatible with service_role caller for `auth.uid()`-based identity

When a capability tool calls a `SECURITY DEFINER` RPC using a `service_role` supabase client, `auth.uid()` inside the RPC resolves to NULL. The RPC's UNION-all branches filter by `auth.uid()` and silently return 0 rows. No error, no exception — just empty results. This makes the bug invisible in integration tests unless you assert on row count. Fix: use direct table reads with the JWT-scoped supabase client (which correctly carries `auth.uid()`), or use the `profile_id` parameter overload if the RPC supports it.

Suggested L-slot: "SECURITY DEFINER RPC + service_role caller → auth.uid()=NULL → silent empty result."

### L-NEW-2: `CREATE OR REPLACE FUNCTION` refuses RETURNS TABLE column additions

Postgres `CREATE OR REPLACE FUNCTION` treats RETURNS TABLE column changes as a shape change and throws `cannot change return type of existing function`. Adding new columns to an existing RETURNS TABLE signature requires `DROP FUNCTION IF EXISTS <name>(<arg_types>)` first, then `CREATE OR REPLACE`. The `IF EXISTS` guard preserves idempotency on repeat `migration up` runs. This affects any sortie that adds columns to an existing RPC.

Suggested L-slot: "CREATE OR REPLACE FUNCTION refuses RETURNS TABLE shape changes — DROP FUNCTION IF EXISTS first."

### L-NEW-3: `supabase gen types` writes WARN lines to stdout that corrupt the output file

`npx supabase gen types typescript --local` outputs WARN-level log lines to stdout before the TypeScript content. If redirected directly to `database.types.ts` (without `2>/dev/null`), these WARN lines appear at the top of the file and break the TypeScript parser. Always run without `op run` wrap (per L-op_run_supabase_gen_types_corrupts) AND add `2>/dev/null` to suppress WARN lines: `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`.

Suggested L-slot: "supabase gen types stderr corrupts output without 2>/dev/null."

### L-NEW-4: TypeScript structural typing absorbs narrower DB type into wider consumer type

`MyTaskRow.hook_linked_procedure_id` from the regenerated `database.types.ts` is `string` (non-null, since the RPC column has a NULL-fill default but the generated type reflects the column declaration). `TaskWithHook` in mobile code declares `string | null`. `string` is structurally assignable to `string | null` — no type error at assignment, no caller updates needed. This is a structural typing win: the mobile consumer type can be more permissive than the DB-derived type without breaking anything.

---

## Known Issues / Debt

| Item | Detail | Target |
|------|--------|--------|
| Telemetry alias `task.added_manual` | Deprecated at Sortie 5 closure. Reminder date: 2026-06-13 (30 days from 2026-05-13). | Sortie 5 |
| Intent-classifier alias shim `aliasTaskVerbs()` | Removed in Sortie 5 closure ADR (30-day A/B window). | Sortie 5 |
| `emma_task` auto-schedule writer identity | Q11 from ADR-0298 still open: who INSERTs `emma_task` rows? Affects agent-prompt documentation only. Non-blocking. | Future |
| Mobile UI for `create_session` via FAB | Sortie 4 owns the Kalender AddSheet and FAB rewire per `docs/design/design_handoff_calendar/source/screens.jsx`. No task-create UI shipped in Sortie 3. | Sortie 4 |
| RLS WITH CHECK audit (≥30 policies) | Out-of-band sortie (`feat/rls-with-check-audit`, ADR-0302-companion). Parallel-safe. | Future |
| Voice unlock on `create_*` tools | V1 chat-only per ADR-0298 R6. V2 (post-PII-detector) is a future ADR. | Future |

---

## Next Steps

1. **Sortie 4 (ADR-0302)**: Mobile Kalender UI — `AddSheet`, FAB rewire (currently opens BotssonShell → relocate to chat-tab mic icon), `ProgressRing` summary card, filter-chip "Oppgaver" on WeekView. Canonical source: `docs/design/design_handoff_calendar/source/screens.jsx`.

2. **Sortie 5**: E2E (`feat/task-e2e`) — Playwright: voice-create → list-RPC → tap-complete → telemetry verify → cross-workspace RLS isolation → memory-discoverability → `fn_list_my_tasks` < 500ms p95 gate. Also closes alias shim removal and `task.added_manual` deprecation.

3. **Optional — promote ADR-0298 status**: Currently `proposed`. 3/5 sorties shipped (Sortie 1, 2, 3 all accepted). Pontus decides when to flip to `accepted` (Sortie 4 or Sortie 5).

4. **Q12 resolution**: `tasks:read` + `tasks:write` scope names need to be added to the `smartout-edge-function-guide` canonical scope list. Resolved functionally in Sortie 3 via workspace-api registry; documentation update pending.
