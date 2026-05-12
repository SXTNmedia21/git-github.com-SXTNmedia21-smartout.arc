---
title: "Sortie 1 — Mobile Session-Task Defense Closure"
slug: sortie-1-session-task-defense
status: approved
layer: spec
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0298
sortie_adr_reserved: ADR-0299
predecessor_council: Mobile Oppgaver Council 2026-05-12
target_branch: feat/mobile-session-task-defense
target_worktree: ~/dev/smartout.ai-wt-2
tags: [sortie, mobile, defense, bff, rls, telemetry, task]
---

# Sortie 1 — Mobile Session-Task Defense Closure

> Source-of-truth chain: ADR-0298 (accepted 2026-05-13) is parent architecture. This spec scopes Sortie 1. Sortie 1 ADR reserved at slot 0299. Predecessor: Mobile Oppgaver Council 2026-05-12 (REJECT — REMEDIATE). Plan-review council 2026-05-13 returned REJECT on first plan draft; corrections applied per council Phase 5 synthesis.

## 1. Goal

Close every defense violation on the mobile `session_task` surface in a single sortie. No new task UI. No ontology change. No capability registration. Just shut the bypass holes, tighten schemas + RLS + telemetry registry so subsequent sorties build on clean foundation.

## 2. Non-goals

- No new task table
- No new RPC (`fn_list_my_tasks` is Sortie 2)
- No new capability (`task` capability is Sortie 3)
- No mobile UI changes beyond deleting 2 orphan routes
- No RLS audit on non-task tables (Sortie A)
- No tightening of 9 non-task `.catchall(z.unknown())` schemas (Sortie B)
- No `personal_task` FOR ALL split (Sortie A)
- No `emma_task` UPDATE policy WITH CHECK (Sortie A)
- No alias infrastructure (R10 hard-cut, deferred to Sortie 3)
- No `schedule_shift` / `shift_approval` RLS WITH CHECK hardening (Sortie A)

## 3. Verified pre-flight facts (canonical, do NOT re-derive in plan)

These were verified against actual code 2026-05-13 during plan-review council Phase 5:

### 3.1 `gateAction` location + signature

`apps/web/src/app/dashboard/_actions/_shared.ts:79` — Server Action layer canonical export. NOT in `@smartout/ai/gate` (that path does not exist).

Signature:
```typescript
export async function gateAction(args: {
  workspaceId: string;
  capability: string;       // dotted slug, e.g. "task.complete_session_task"
  channel: "chat" | "voice" | "system" | string;
  actorProfileId: string;
  actionType: string;       // e.g. "complete"
  entityId?: string;
}): Promise<GateResult | { allow: false; reason: string; ... }>
```

Return: object with `.allow` (boolean) and `.reason` (optional string). NOT `.allowed`.

### 3.2 `engine_authority_config` schema

Migration `20260302000100_engine_authority_config.sql:6-16`:

```
id, workspace_id, capability, level, updated_by, created_at, updated_at
+ ALTERs: min_role, requires_four_eyes, observer_escalation_hours
```

UNIQUE constraint: `uq_workspace_capability UNIQUE (workspace_id, capability)` — TWO columns only. No `action_type` column. No `allowed_channels` column.

Canonical seed pattern: `supabase/migrations/20260428220007_tips_authority_seed.sql:33-58` — single dotted capability string, CROSS JOIN VALUES, `ON CONFLICT (workspace_id, capability) DO NOTHING`.

### 3.3 `session_task` schema

PK: `id` (UUID). Columns include `workspace_id, assigned_to, completed_at, completed_by, status, department_session_id, session_hook_id, is_compliance_required, title, description`.

### 3.4 `schedule_shift` schema

PK: `schedule_shift_id` (NOT `id`). Columns include `workspace_id, employee_id, confirmed_at, confirmed_by, approved_at, approved_by, adhoc_approved_at, adhoc_approved_by`.

Actor for self-confirm: `employee_id` (NOT `profile_id`).

### 3.5 `shift_approval` schema

PK: `approval_id` (NOT `id`). Columns include `workspace_id, shift_id, approved_at, approved_by, approved_hours, status` (enum `pending|approved|edited|disputed`), `handoff_completed`, `handoff_requested`.

NO direct `profile_id` or `employee_profile_id`. Actor resolves via `shift_id → schedule_shift.employee_id`.

### 3.6 Helper functions

`supabase/migrations/00004_rls_policies.sql:28-33`:

- `get_workspace_ids_for_user(uid uuid)` — 1 arg
- `is_admin_in_workspace(uid uuid, wid uuid)` — 2 args (NOT 1)

### 3.7 Telemetry registry

`packages/telemetry/src/registry.ts:9187` already has `"session_task completed"` event with destinations `["posthog", "logger", "activity_trail", "engine_event"]`.

Strategy: REUSE existing `"session_task completed"` for task completion. Register 2 NEW events: `"shift confirmed"` + `"hours confirmed"`.

`EmitEvent` discriminated union: existing types extend `BaseEvent` (pattern: `interface SessionTaskCompleted extends BaseEvent { event: "session_task completed"; properties: {...} }`). Add 2 new interfaces + 2 new `EVENT_ROUTING` entries + union extension.

### 3.8 Migration tip (verified 2026-05-13)

Current repo tip: `20260604000008_onboarding_capability_authority_seed.sql`. Sortie 1 migrations use `20260604120000+` timestamps (safe).

### 3.9 Mobile Zod schemas — actual state

| Schema | Line | Has `.catchall`? | PK field name |
|---|---|---|---|
| `completeTaskSchema` | 82-87 | YES | `id` |
| `completeCheckpointSchema` | 89-95 | NO (bare object) | `task_id` |
| `signChecklistSchema` | 97-102 | NO (bare object) | `task_ids: string[]` |
| `confirmShiftSchema` | 113-117 | YES | `schedule_shift_id` |
| `confirmHoursSchema` | 138-142 | YES | `approval_id` |

Plan must convert 3 catchall → strict AND tighten 2 bare-object schemas to remove forgeable `completed_by`/`completed_at` fields.

### 3.10 `department_session.tasks_completed` counter

Read by 7+ surfaces (dashboard, hms, communication briefing, operations-intelligence). NO trigger or app-code writer found in grep. Pre-existing gap — counter is read but appears never incremented. **NOT a Sortie 1 fix.** Document in HANDOFF as known-gap (likely existing data-integrity issue independent of mobile defense).

### 3.11 Personal capability — 4 tools with same entity_type bug

- `personal/tools.ts:121` (`add_note`) emit `entity_type: "agent_session"` — wrong (writes `engine_memory`)
- `personal/tools.ts:192` (`create_task`) emit `entity_type: "session_task"` — wrong (writes `personal_task`)  
- `personal/tools.ts:314` (`set_reminder`) emit `entity_type: "agent_session"` — wrong (writes `engine_delayed_trigger`)
- `personal/tools.ts:468` (`update_setting`) emit `entity_type: "agent_session"` — wrong (writes `engine_memory`)

**Sortie 1 fixes only `create_task` (line 192).** Other 3 are documented as residual L-0064 debt in HANDOFF + Sortie B scope.

### 3.12 Learning slot reservation

`L-0224` is max on development. `L-0233`, `L-0234`, `L-0235` claimed on other branches.

Sortie 1 learning slots: **L-0236** + **L-0237** (NOT 0237/0238 as earlier plan claimed — those clash with branch reservations).

## 4. Scope — what changes

### 4.1 New BFF routes (3)

| Path | Method | Auth | Server Action |
|---|---|---|---|
| `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` | PATCH | Bearer | `completeSessionTaskAction` (NEW) |
| `apps/web/src/app/api/mobile/shifts/[id]/confirm/route.ts` | PATCH | Bearer | `confirmShiftAction` (NEW) |
| `apps/web/src/app/api/mobile/shift-approvals/[id]/confirm/route.ts` | PATCH | Bearer | `confirmHoursAction` (NEW) |

Note: route path `[id]` is the URL segment. Server Action receives `taskId` / `shiftId` / `approvalId` from `params.id` and uses CORRECT column names for the `.eq()` query (`id` for session_task, `schedule_shift_id` for schedule_shift, `approval_id` for shift_approval).

### 4.2 Shared helper (NEW)

`apps/web/src/app/api/mobile/_shared/actor.ts` — extract `resolveMobileActor` from existing `apps/web/src/app/api/mobile/tasks/route.ts:47-75`. Refactor existing route to import from new shared module.

### 4.3 Server Actions (3 NEW)

`apps/web/src/app/dashboard/_actions/complete-session-task-action.ts`:
- Import `gateAction` from `./_shared`
- Call: `gateAction({ workspaceId, capability: "task.complete_session_task", channel, actorProfileId: actor.profileId, actionType: "complete", entityId: taskId })`
- Check `if (!gate.allow)` 
- `.from("session_task").select(...).eq("id", taskId)` — session_task PK is `id`
- Workspace + assignee verification
- UPDATE with `status='completed'`, `completed_at`, `completed_by=actor.profileId`
- emit `"session_task completed"` (existing event, reuse)

`apps/web/src/app/dashboard/_actions/confirm-shift-action.ts`:
- `gateAction({ capability: "schedule.confirm_shift", actionType: "confirm" })`
- `.from("schedule_shift").select("workspace_id, employee_id").eq("schedule_shift_id", shiftId)` — correct PK + actor column
- UPDATE `confirmed_at`, `confirmed_by`
- emit `"shift confirmed"` (NEW event — registered in Sortie 1)

`apps/web/src/app/dashboard/_actions/confirm-hours-action.ts`:
- `gateAction({ capability: "timesheet.confirm_hours", actionType: "confirm" })`
- `.from("shift_approval").select("workspace_id, shift_id").eq("approval_id", approvalId)` — correct PK
- JOIN through `shift_id → schedule_shift.employee_id` for actor verification (no direct profile column)
- UPDATE `approved_at`, `approved_by`, `status='approved'`
- emit `"hours confirmed"` (NEW event)

### 4.4 Mobile action-map handlers (5)

| Handler | Current | New |
|---|---|---|
| `complete_task` (line 104-110) | `.from("session_task").update(p).eq("id", p.id)` | `PATCH /api/mobile/tasks/${p.id}/complete` |
| `complete_checkpoint` (line 336-347) | direct update on session_task | `PATCH /api/mobile/tasks/${p.task_id}/complete` — uses schema field `task_id` |
| `sign_checklist` (line 350-364) | direct update loop | Loop: `PATCH /api/mobile/tasks/${id}/complete` per id in `p.task_ids` |
| `confirm_shift` (line 112-118) | `.from("schedule_shift").update(p).eq("schedule_shift_id", p.schedule_shift_id)` | `PATCH /api/mobile/shifts/${p.schedule_shift_id}/confirm` |
| `confirm_hours` (line 122-128) | direct update | `PATCH /api/mobile/shift-approvals/${p.approval_id}/confirm` |

All handlers send empty body `{}`. Identity derived server-side from Bearer JWT.

### 4.5 Mobile Zod schemas — tighten 3 catchall + tighten 2 bare-object

| Schema | Action |
|---|---|
| `completeTaskSchema` | Convert `.catchall(z.unknown())` → `.strict()`. Drop `status` field (server forces). Keep `id`. |
| `confirmShiftSchema` | Convert `.catchall(z.unknown())` → `.strict()`. Keep only `schedule_shift_id`. |
| `confirmHoursSchema` | Convert `.catchall(z.unknown())` → `.strict()`. Keep only `approval_id`. |
| `completeCheckpointSchema` | Already bare object. Drop `completed_by` + `completed_at` (forgeable). Add `.strict()`. Keep `task_id`, drop `status`. |
| `signChecklistSchema` | Already bare object. Drop `completed_by` + `completed_at`. Add `.strict()`. Keep `task_ids` array, drop `status`. |

### 4.6 RLS — `session_task` WITH CHECK with NULL-tolerance + transition-scoping

New migration replaces `jwt_update_session_task`:

```sql
DROP POLICY IF EXISTS "jwt_update_session_task" ON public.session_task;

CREATE POLICY "jwt_update_session_task" ON public.session_task
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      -- assignee may complete own task
      assigned_to IN (
        SELECT profile_id FROM public.profile
        WHERE user_id = auth.uid() AND is_active = true
      )
      -- OR task is unassigned (pickup flow per D6 cascade)
      OR assigned_to IS NULL
      -- OR admin in workspace
      OR public.is_admin_in_workspace(auth.uid(), workspace_id)  -- 2-arg signature
    )
  );
```

Allows: assignee-completes-own, unassigned-pickup-by-anyone-in-workspace, admin-override. Closes Steward Phase 5 §9 cascade-integrity concern (D6 state machine preserved).

### 4.7 Gate-action seeds (2 migrations, 3 capabilities)

Migration `20260604121000_task_complete_gate_action_seed.sql`:

```sql
INSERT INTO public.engine_authority_config (
  workspace_id, capability, level, min_role, requires_four_eyes, observer_escalation_hours, updated_by
)
SELECT w.workspace_id, v.capability, v.level, v.min_role, v.requires_four_eyes, v.observer_escalation_hours, NULL::uuid
FROM public.workspace w
CROSS JOIN (VALUES
  ('task.complete_session_task',  'suggest', 'employee', false, 72),
  ('schedule.confirm_shift',      'suggest', 'employee', false, 72),
  ('timesheet.confirm_hours',     'suggest', 'employee', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

Single migration covers all 3 gates (UNIQUE is `(workspace_id, capability)` so dotted-slugs are independent rows).

### 4.8 Telemetry registry extension

`packages/telemetry/src/registry.ts`:

1. Extend `EntityType` union — add `personal_task`, `schedule_day_task`, `emma_task` (after verifying NOT already present)
2. Add 2 new event interfaces:
   ```typescript
   export interface ShiftConfirmed extends BaseEvent {
     event: "shift confirmed";
     properties: {
       entity: EntityRef;  // entity_type: "schedule_shift"
       metadata: { source: "session" | "mobile"; channel: string };
     };
   }
   export interface HoursConfirmed extends BaseEvent {
     event: "hours confirmed";
     properties: {
       entity: EntityRef;  // entity_type: "shift_approval"
       metadata: { source: "session" | "mobile"; channel: string };
     };
   }
   ```
3. Add to `SmartoutEvent` union
4. Add to `EVENT_ROUTING`:
   ```typescript
   "shift confirmed": {
     destinations: ["posthog", "logger", "activity_trail", "engine_event"],
     category: "operations",
   },
   "hours confirmed": {
     destinations: ["posthog", "logger", "activity_trail", "engine_event"],
     category: "operations",
   },
   ```

REUSE `"session_task completed"` for task complete path (no new event needed).

### 4.9 Entity_type bug fix

`packages/ai/src/capabilities/personal/tools.ts:192`:

```typescript
// Before
entity_type: "session_task",  // closest entity_type in registry
// After
entity_type: "personal_task",
```

Sortie 1 fixes only `create_task`. Other 3 personal-tool entity_type drift (line 121, 314, 468) documented as residual L-0064 debt in HANDOFF, Sortie B scope.

### 4.10 Orphan route deletion

- Delete `apps/mobile/app/(app)/(me)/tasks/[id].tsx` + Stack.Screen registration
- Delete `apps/mobile/app/(app)/(home)/create-task.tsx`
- Replace `router.push("/(app)/(home)/create-task")` at `apps/mobile/app/(app)/(home)/operations.tsx:193` with TODO comment pointing to Sortie 4 AddSheet wiring

### 4.11 Doc-drift fixes (3)

- `docs/journeys/JOURNEY-mobile-addsheet-task-bff-wrap.md` — `status: verified` → `status: deferred`
- `apps/mobile/src/components/ai/BotssonSheet.tsx` — Ultravox → LiveKit (3 occurrences per ADR-0282)
- `docs/decisions/0283-task-mobile-bff-wrap.md` — `status: proposed` → `status: accepted`

## 5. Architecture flow

### 5.1 Mobile complete-task flow (canonical)

```
mobile tap → useMutation
  → enqueue("complete_task", { id })  ← strict schema, no identity
  → SyncWorker → actionMap.complete_task
  → PATCH /api/mobile/tasks/${id}/complete (Bearer)
    ├─ resolveMobileActor(bearerToken) → { workspaceId, profileId, role } (ADR-0151)
    ├─ gate_action("task.complete_session_task", actor)  ← C4 gate
    ├─ load session_task row, verify workspace_id + assignee match
    ├─ supabaseAdmin.update({ status, completed_at, completed_by })
    │   ↳ RLS WITH CHECK verifies (assignee | NULL | admin)
    └─ emit("session_task completed")  ← 4-destination
```

### 5.2 Identity contract

JWT → Bearer → `resolveMobileActor` → `ResolvedActor` → gate + write + emit.

Body carries ONLY `id` (or empty `{}` if id is in URL). No `workspace_id`, no `completed_by`, no `actor_id`, no `*_at`. Server forces all identity fields.

## 6. Error handling

| Failure mode | Status | Response |
|---|---|---|
| Bearer missing | 401 | `Unauthorized` |
| Bearer invalid / profile inactive | 401 | `Unauthorized` |
| Empty workspace_id or profile_id | 401 | `Unauthorized` (L-0177 fail-fast) |
| Body has unknown field | 422 | Zod `.strict()` parse error |
| URL `id` not UUID | 422 | `Ugyldig ID` |
| Row not found | 404 | `Oppgaven finnes ikke` |
| Workspace mismatch | 403 | `Oppgaven tilhører et annet arbeidsrom` |
| Not assignee + not admin + already-assigned | 403 | `Ikke autorisert` |
| `gate.allow=false` | 403 | `gate.reason` |
| RLS WITH CHECK rejects | 500 → 403 | Surface gracefully |
| Telemetry emit fails | 200 + log | Best-effort per ADR-0114 |

## 7. Testing

### 7.1 Unit (vitest)

Per Server Action: happy path + cross-workspace reject + gate-deny + row-not-found. Mock `gateAction` returning `{ allow: true }` / `{ allow: false, reason }`. Verify mock receives `actorProfileId` (not `profileId`).

### 7.2 RLS direct test

SQL test: simulate JWT for employee A, attempt UPDATE on task assigned to employee B (no admin role) → reject. Same employee A, UPDATE task with `assigned_to=NULL` → allow (pickup flow preserved).

### 7.3 E2E (Playwright, 3 specs)

- `sortie-1-mobile-task-complete.spec.ts` — happy + 422 + 401
- `sortie-1-mobile-shift-confirm.spec.ts` — same shape
- `sortie-1-mobile-hours-confirm.spec.ts` — same shape

Each verifies: DB row updated, activity_trail row exists with correct entity_type, engine_event row exists.

## 8. Pre-implementation decisions (build-agent does NOT re-litigate)

1. Gate-capability slugs: `task.complete_session_task`, `schedule.confirm_shift`, `timesheet.confirm_hours` (dotted, single column in `engine_authority_config`)
2. Single BFF route for task-class completion: complete_task + complete_checkpoint + sign_checklist all PATCH `/api/mobile/tasks/[id]/complete`. sign_checklist loops sequentially.
3. `.strict()` not allow-list — schemas declare only allowed keys.
4. Activity_trail backfill: Sortie 2, NOT Sortie 1.
5. `personal_task`/`emma_task` UPDATE WITH CHECK: Sortie A.
6. Authority level: `suggest` for all 3 gates, `min_role: employee`.
7. Channel guard: chat + voice at gate (no PII risk on completion verbs). ADR-0298 R6 chat-only restriction applies to free-text creates, not completes.
8. Push notification on completion: out of scope.
9. `tasks_completed` counter: pre-existing gap, NOT Sortie 1 fix. Document in HANDOFF.
10. Other 3 personal-tool entity_type drift: residual L-0064 debt, Sortie B scope.

## 9. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Mobile sync replay → duplicate completion | BFF idempotent: status='completed' already → 200 with `already_completed: true` |
| R2 | `is_admin_in_workspace` perf in RLS | Function exists per `00004_rls_policies.sql:33`, verified used in prior policies |
| R3 | `EntityType` union extension breaks consumers | Grep `switch.*entity_type` before commit, verify default-branch coverage |
| R4 | EntityType extension + entity_type fix split across Tasks 1 + Task 18 — phantom union member referenced | Same atomic commit OR Task 1 lands first; verify ordering |
| R5 | Doc-drift edits reverted by formatter | Re-verify diff post-prettier (CLAUDE.md Verification After Lint/Formatter) |
| R6 | confirm_shift + confirm_hours RLS WITH CHECK deferred | Application gate sufficient until Sortie A; document as known-gap |
| R7 | Build-agent imports `@smartout/ai/gate` (council-flagged) | Spec explicit: `import { gateAction } from "./_shared"` |
| R8 | Build-agent uses wrong PK columns | Spec §3.4 + §3.5 explicit + plan tasks reference verified column names |
| R9 | Telemetry registry change breaks downstream consumers | New events use existing destination pattern; reuse of `session_task completed` is non-additive |

## 10. Acceptance criteria

1. 3 BFF routes exist + handle happy/error paths per §6
2. 5 action-map handlers route through BFF (zero direct Supabase mutations on session_task/schedule_shift/shift_approval in mobile)
3. 3 Zod catchall schemas use `.strict()`; 2 bare-object schemas tightened (forgeable fields dropped + `.strict()`)
4. `session_task` UPDATE policy has WITH CHECK + NULL-tolerance + admin-override
5. 3 gate-action seeds in `engine_authority_config` with correct columns + UNIQUE compliance
6. `EntityType` union extended with 3 new values (after verification)
7. 2 new telemetry events registered (`shift confirmed`, `hours confirmed`); reuse `session_task completed`
8. `personal/tools.ts:192` entity_type = `"personal_task"`
9. 2 orphan routes deleted + 1 Stack.Screen registration removed
10. 3 doc-drift fixes committed
11. Typecheck + lint pass
12. 3 Playwright E2E pass
13. Manual smoke: complete session_task from mobile PWA → DB updated + activity_trail row + engine_event row
14. HANDOFF written + L-0236 + L-0237 learning stubs
15. ADR-0299 written + registered
16. BOTSSON-SYSTEM-MAP.md updated (3 new BFF rows + personal capability L1 status note)
17. STATE-SUMMARY.md bumped with Sortie 1 closure

## 11. References

- ADR-0298 (Task Ontology, parent architecture, accepted 2026-05-13)
- ADR-0283 (Task Create Mobile BFF Wrap, predecessor, status flips accepted in this sortie)
- ADR-0282 (Voice Plane LiveKit, driver for BotssonSheet docstring fix)
- Cross-cutting: ADR-0078, 0099, 0114, 0132, 0134, 0151, 0186, 0204, 0240, 0287
- Pattern precedents: ADR-0273 (deviation/day-info BFF), ADR-0277 (shift authoring BFF)
- Learnings: L-0042 (migration timestamps), L-0064 (entity_type registry drift), L-0177 (silent identity from payload), L-0202 (ADD COLUMN vs sibling-table)
- Council records: Mobile Oppgaver Council 2026-05-12, ADR-0298 Validation Council 2026-05-13, Sortie 1 Plan-Review Council 2026-05-13

## 12. Open questions

None. All 14 council blockers resolved in this spec.
