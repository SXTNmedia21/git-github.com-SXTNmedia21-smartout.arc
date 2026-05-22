# Procedure Engine — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can create a routine + assign it to a location; cron materializes its tasks onto that location's day-line; an employee clocks in and sees exactly their day's tasks; late + newly-assigned tasks notify.

**Architecture:** Build on the existing governance spine (`routine`/`procedure`/`procedure_step`) + D6 runtime (`department_session`/`day_line`/`session_task`/`shift_session`). The only novel schema is routine→location/team scoping + provenance + executor_type. Authoring goes through a new `procedure` capability tool (delegating writes, ADR-0204/0240). Materialization extends `session-hook-executor`. Min dag reads via the existing day_line chain. Notifications use the existing notification engine + a watchdog.

**Tech Stack:** Supabase Postgres (migrations), `@smartout/ai` capability (Zod + defineTool + gatedMutation), Hono Edge Functions (Deno), React Native (Expo) mobile, Next.js BFF, vitest.

**Source spec:** `docs/superpowers/specs/2026-05-22-procedure-engine-design.md`

**Reference patterns (read before starting):**
- Capability tool shape: `packages/ai/src/capabilities/routine/tools.ts` (existing `attach_to_line`)
- Migration discipline: `smartout-database-guide` skill (L-0042 timestamp ordering — run `ls supabase/migrations/ | tail -1` first)
- Cron materialization: `supabase/functions/session-hook-executor/index.ts`
- Min dag mobile read: `apps/mobile/src/hooks/queries/use-my-tasks.ts` + `use-shift-session.ts`
- Notification emit: `packages/telemetry/src/registry.ts` + notification engine `00006_notification_engine.sql`

---

## File Structure

**Schema (new migrations — timestamp > current repo tip):**
- `supabase/migrations/<ts>_routine_location_team_scope.sql` — `routine.location_id`, `routine.workspace_id` (denorm + trigger), `routine.executor_type` enum, `routine_team` junction
- `supabase/migrations/<ts>_session_task_provenance.sql` — `session_task.origin`, `generated_by`, `source_reference`

**Capability (new tool in existing capability):**
- Modify: `packages/ai/src/capabilities/routine/tools.ts` — add `create` + `assign_to_location` tools
- Modify: `packages/ai/src/capabilities/routine/index.ts` — register tools
- Modify: `packages/ai/src/capabilities/routine/gate.ts` — gate actions
- Modify: `packages/ai/src/router/intent-classifier.ts` — intent enum
- Modify: `supabase/migrations/<ts>_routine_capability_authority_seed.sql` — seed gate authority

**Cron (extend existing):**
- Modify: `supabase/functions/session-hook-executor/index.ts` — routine→procedure_step expansion (G-expand) + provenance stamping + location→day_line resolution

**UI (web — minimal authoring form; mobile — Min dag + clock-in):**
- Create: `apps/web/src/app/dashboard/governance/_components/RoutineForm.tsx`
- Create: `apps/web/src/app/dashboard/governance/_hooks/use-routine-mutations.ts`
- Modify: mobile shift surface for clock-in + day view (existing `use-shift-session.ts`, `DuringShiftView`)
- Modify: shift location UI (`apps/web/src/components/day/` shift editor)

**Notifications:**
- Modify: `supabase/functions/session-watchdog-demoter/` or new overdue-notify path
- Modify: `session-hook-executor` / `task` capability — emit `task assigned` notification

---

## Parallel Team Execution (domain-owned agents, dependency waves)

Pure "all domains at once" fails: schema (enums/tables) blocks capability, cron, and UI. The team runs in **3 waves**, each gated by the orchestrator. Within a wave, agents own **non-overlapping file boundaries** and run concurrently.

### Team roster

| Agent | Model | Domain | Owns (file boundary) |
|-------|-------|--------|----------------------|
| **DB** | sonnet | database/schema | `supabase/migrations/*` (Tasks 1,2), regenerates `packages/supabase/src/database.types.ts` (sole owner) |
| **Logic** | sonnet | capability/tools | `packages/ai/src/capabilities/routine/*`, `router/intent-classifier.ts`, **sole editor of `packages/telemetry/src/registry.ts`**, authority-seed migration (Tasks 3,4,5,5b) |
| **Cron** | sonnet | edge function | `supabase/functions/session-hook-executor/*` (Task 6) |
| **WebUI** | sonnet | web | `apps/web/src/app/dashboard/governance/_components/RoutineForm.tsx` + `_hooks/*`, shift-location editor in `apps/web/src/components/day/*` (Tasks 7,8) |
| **MobileUI** | sonnet | mobile | `apps/mobile/src/*`, `apps/web/src/app/api/mobile/shift-session/[id]/clock-in/route.ts` (Task 9) |
| **Notif** | sonnet | notifications | `supabase/functions/session-watchdog-demoter/*`, notif emit in `task/tools.ts` — coordinates registry adds THROUGH Logic agent (Task 10) |
| **Reviewer** | opus | gate | reviews each agent's diff between waves; no file ownership |
| **Orchestrator** | opus | coordination | dispatches per wave, **commits each agent's work** (sub-agents do NOT commit — L-collision), runs typecheck gate between waves |

### Waves (dependency gates)

```
WAVE 0 (blocking)        WAVE 1 (parallel ×2)         WAVE 2 (parallel ×3)
─────────────────        ────────────────────         ────────────────────
DB: Tasks 1,2      ──▶   Logic: Tasks 3,4,5,5b   ──▶  WebUI: Tasks 7,8
(schema + types)         Cron:  Task 6                 MobileUI: Task 9
                                                       Notif: Task 10
```

- **Wave 0 → Wave 1 gate:** migrations applied locally + `database.types.ts` regenerated + `pnpm --filter @smartout/supabase typecheck` green. Logic + Cron both consume the new enums/columns.
- **Wave 1 → Wave 2 gate:** `cd packages/ai && pnpm typecheck` green + capability tools callable. WebUI/MobileUI/Notif consume the capability + schema contracts.
- Cron (Wave 1) depends only on Wave-0 schema (provenance cols, routine.location_id), NOT on Logic's TS — runs fully parallel with Logic.

### Collision rules (from L-subagent-commit-collision + L-0316)

1. **One file, one owner.** Shared hot files arbitrated: `database.types.ts` → DB only; `packages/telemetry/src/registry.ts` → Logic only (Notif requests its events via the Wave-1 handoff note, Logic adds them). `intent-classifier.ts` → Logic only.
2. **Sub-agents do NOT commit or push.** Each returns a diff summary; the orchestrator stages + commits per agent (atomic, correct message). Prevents the pre-commit-hook batch-collision (L, 2026-05-20).
3. **Worktree isolation optional.** If using `isolation:"worktree"`, verify the physical path exists via `git worktree list` BEFORE dispatch (L-0316) — the flag is metadata only. Default here: shared `development` branch + file boundaries (boundaries are clean across domains; waves serialize the schema dependency).
4. **Branch discipline.** Every sub-agent told explicitly: work on `development`, do not switch branch, do not commit.
5. **Between-wave verify.** Orchestrator runs the gate typecheck (post-merge-verify discipline) before opening the next wave.

### Dispatch shape (orchestrator, per wave)

```
# Wave 0 — single blocking agent
Agent(subagent_type="general-purpose", model="sonnet", description="DB schema",
      prompt="<Tasks 1+2 verbatim from this plan> ... do NOT commit; return migration files + type-regen diff summary")
# orchestrator: apply, regen types, commit, typecheck gate

# Wave 1 — two agents IN ONE MESSAGE (parallel)
Agent(... model="sonnet", description="Logic capability", prompt="<Tasks 3,4,5,5b> ... sole editor of registry.ts; do NOT commit")
Agent(... model="sonnet", description="Cron expansion",   prompt="<Task 6> ... do NOT commit")
# orchestrator: review (opus Reviewer), commit each, typecheck gate

# Wave 2 — three agents IN ONE MESSAGE (parallel)
Agent(... model="sonnet", description="Web UI",   prompt="<Tasks 7,8>")
Agent(... model="sonnet", description="Mobile UI",prompt="<Task 9>")
Agent(... model="sonnet", description="Notif",    prompt="<Task 10>")
# orchestrator: review, commit each, final acceptance run
```

> Effective parallelism: Wave 0 = 1 agent, Wave 1 = 2 concurrent, Wave 2 = 3 concurrent. Critical path ≈ DB → Logic → WebUI/Mobile. Notif + Cron ride free in their waves.

---

## Task 1: Schema — routine location + team + executor_type

**Files:**
- Create: `supabase/migrations/<ts>_routine_location_team_scope.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

- [ ] **Step 1: Determine migration timestamp**

Run: `ls supabase/migrations/ | tail -1`
Pick a timestamp strictly greater (e.g. if tip is `20260621202000`, use `20260622100000`).

- [ ] **Step 2: Write the migration**

```sql
-- <ts>_routine_location_team_scope.sql
-- Procedure Engine Phase 1: routine scoping by location + team(0..N) + executor.
-- Spec: docs/superpowers/specs/2026-05-22-procedure-engine-design.md §2.3, §3

-- executor_type: same routine model, different executor (human/ai/system/hybrid)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routine_executor_type') THEN
    CREATE TYPE routine_executor_type AS ENUM ('human', 'ai', 'system', 'hybrid');
  END IF;
END $$;

ALTER TABLE public.routine
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.location(location_id),
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspace(workspace_id),
  ADD COLUMN IF NOT EXISTS executor_type routine_executor_type NOT NULL DEFAULT 'human';

-- Denormalize workspace_id from protocol on insert/update (routine has no direct workspace today)
CREATE OR REPLACE FUNCTION public.set_routine_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.protocol WHERE protocol_id = NEW.protocol_id;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_set_routine_workspace_id ON public.routine;
CREATE TRIGGER trg_set_routine_workspace_id
  BEFORE INSERT OR UPDATE ON public.routine
  FOR EACH ROW EXECUTE FUNCTION public.set_routine_workspace_id();

-- Backfill existing rows
UPDATE public.routine r SET workspace_id = p.workspace_id
  FROM public.protocol p WHERE r.protocol_id = p.protocol_id AND r.workspace_id IS NULL;

-- routine_team junction (0..N; zero rows = location-wide / pickup)
CREATE TABLE IF NOT EXISTS public.routine_team (
  routine_id uuid NOT NULL REFERENCES public.routine(routine_id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.team(team_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (routine_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_routine_team_routine ON public.routine_team(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_team_workspace ON public.routine_team(workspace_id);

ALTER TABLE public.routine_team ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jwt_read_routine_team" ON public.routine_team;
CREATE POLICY "jwt_read_routine_team" ON public.routine_team FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_manage_routine_team" ON public.routine_team;
CREATE POLICY "jwt_manage_routine_team" ON public.routine_team FOR ALL
  USING (is_admin_in_workspace(workspace_id)) WITH CHECK (is_admin_in_workspace(workspace_id));
DROP POLICY IF EXISTS "api_key_read_routine_team" ON public.routine_team;
CREATE POLICY "api_key_read_routine_team" ON public.routine_team FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "service_role_routine_team" ON public.routine_team;
CREATE POLICY "service_role_routine_team" ON public.routine_team FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_routine_location ON public.routine(location_id) WHERE location_id IS NOT NULL;
```

- [ ] **Step 3: Apply locally + verify**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<ts>_routine_location_team_scope.sql`
Expected: no errors; `\d public.routine` shows `location_id`, `workspace_id`, `executor_type`; `\d public.routine_team` exists.

- [ ] **Step 4: Regenerate types (NO op run — L-0 corruption)**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `routine_team` + `routine_executor_type` + new routine columns appear.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<ts>_routine_location_team_scope.sql packages/supabase/src/database.types.ts
git commit -m "feat(procedure-engine): routine location + team(0..N) + executor_type scope"
```

---

## Task 2: Schema — session_task provenance triple

**Files:**
- Create: `supabase/migrations/<ts2>_session_task_provenance.sql`

- [ ] **Step 1: Write migration** (timestamp > Task 1's)

```sql
-- <ts2>_session_task_provenance.sql
-- Provenance triple: no task exists without origin/generated_by/source_reference.
-- Spec §2.3, §7b. Cheap now, brutal debugging later.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_origin') THEN
    CREATE TYPE task_origin AS ENUM ('session','adhoc','routine','procedure','projection','manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_generated_by') THEN
    CREATE TYPE task_generated_by AS ENUM ('cron','manager','agent','system');
  END IF;
END $$;

ALTER TABLE public.session_task
  ADD COLUMN IF NOT EXISTS origin task_origin,
  ADD COLUMN IF NOT EXISTS generated_by task_generated_by,
  ADD COLUMN IF NOT EXISTS source_reference uuid; -- hook_id / routine_id / template_id

COMMENT ON COLUMN public.session_task.source_reference IS 'FK-less ref to the producing entity (session_hook.id, routine_id, timeline_template_id) — interpreted with origin.';
```

- [ ] **Step 2: Apply + regenerate types + commit** (same pattern as Task 1 steps 3–5)

Run: apply via psql; `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Commit: `feat(procedure-engine): session_task provenance triple (origin/generated_by/source_reference)`

---

## Task 3: Capability — `routine.create`

**Files:**
- Modify: `packages/ai/src/capabilities/routine/tools.ts`
- Modify: `packages/ai/src/capabilities/routine/index.ts`
- Modify: `packages/ai/src/capabilities/routine/gate.ts`
- Test: `packages/ai/src/capabilities/routine/__tests__/create.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/create.test.ts
import { describe, it, expect, vi } from "vitest";
import { createRoutineTool } from "../tools.js";

describe("routine.create", () => {
  it("inserts a routine bound to a procedure + protocol with executor_type default human", async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => ({ data: { routine_id: "r1" }, error: null }) }) });
    const ctx = {
      workspaceId: "ws1", profileId: "p1", sessionId: "s1",
      supabaseAdmin: { from: vi.fn(() => ({ insert })) },
    } as any;
    const res = await createRoutineTool.execute(
      { name: "Stenge-rutine", procedure_id: "proc1", protocol_id: "prot1", trigger_type: "scheduled", trigger_config: { times: ["23:30"], days: ["mon"] } },
      ctx,
    );
    expect(res).toContain("Stenge-rutine");
    expect(insert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai && pnpm vitest run src/capabilities/routine/__tests__/create.test.ts`
Expected: FAIL — `createRoutineTool` not exported.

- [ ] **Step 3: Implement `createRoutineTool`** in `tools.ts` (follow existing `attach_to_line` shape — gate + emit + gatedMutation)

```ts
export const createRoutineTool = defineTool({
  name: "create",
  description: "Create a recurring routine bound to a procedure. Materializes into session_task per day via cron. Manager+, chat-only.",
  schema: z.object({
    name: z.string().describe("Routine name, e.g. 'Stenge-rutine'"),
    procedure_id: z.string().uuid().describe("The procedure whose steps this routine runs"),
    protocol_id: z.string().uuid().describe("Parent protocol (compliance container)"),
    trigger_type: z.enum(["scheduled", "event"]),
    trigger_config: z.record(z.unknown()).describe("e.g. { times: ['23:30'], days: ['mon','tue'] }"),
    executor_type: z.enum(["human", "ai", "system", "hybrid"]).default("human"),
  }),
  execute: async (input, ctx) => {
    const gate = await gateRoutineAction(ctx, "create");
    if (!gate.allowed) return gate.message;
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase.from("routine").insert({
      name: input.name, procedure_id: input.procedure_id, protocol_id: input.protocol_id,
      trigger_type: input.trigger_type, trigger_config: input.trigger_config,
      executor_type: input.executor_type,
      assigned_to_type: "team", assigned_to_ref: ctx.workspaceId, // placeholder; refined by assign_to_location
    }).select("routine_id").single();
    if (error || !data) return `Kunne ikke lage rutine: ${error?.message ?? "ukjent"}`;
    await emit({ /* "routine created" — register in telemetry registry first */ });
    return `Rutine "${input.name}" opprettet.`;
  },
});
```

- [ ] **Step 4: Register** in `index.ts` (`tools`, `suggestTools`) + add `create` gate action in `gate.ts` + add `"routine created"` to `packages/telemetry/src/registry.ts` (SmartoutEvent union + EVENT_ROUTING).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ai && pnpm vitest run src/capabilities/routine/__tests__/create.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/ai && pnpm typecheck`
Commit: `feat(procedure-engine): routine.create capability tool`

---

## Task 4: Capability — `routine.assign_to_location`

**Files:**
- Modify: `packages/ai/src/capabilities/routine/tools.ts`
- Test: `packages/ai/src/capabilities/routine/__tests__/assign-to-location.test.ts`

- [ ] **Step 1: Write failing test** — assigns location_id + optional team rows; fail-fast if routine not in workspace (L-0177).

```ts
it("sets routine.location_id and inserts routine_team rows; rejects cross-workspace routine", async () => {
  // routine lookup returns workspace mismatch → expect refusal string
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd packages/ai && pnpm vitest run src/capabilities/routine/__tests__/assign-to-location.test.ts`

- [ ] **Step 3: Implement** `assignRoutineToLocationTool`: verify routine belongs to `ctx.workspaceId` (fail-fast 4xx-equivalent string per L-0177), `UPDATE routine SET location_id`, replace `routine_team` rows for `team_ids` (empty array = location-wide). gate + emit.

- [ ] **Step 4: Run → PASS. Step 5: typecheck. Step 6: commit** `feat(procedure-engine): routine.assign_to_location`

---

## Task 5: Wire routine → session_hook so cron picks location

**Files:**
- Modify: `packages/ai/src/capabilities/routine/tools.ts` (assign creates/updates a `session_hook` with `linked_routine_id` for the routine's department)
- Test: extend `assign-to-location.test.ts`

- [ ] **Step 1–6 (TDD):** On assign, upsert a `session_hook` (respecting `UNIQUE(workspace_id, department_id, hook_type)`) with `linked_routine_id = routine_id`, `hook_type` derived from `trigger_config`. Acceptance: after assign, a session_hook row links the routine to the department serving that location.

---

## Task 5b: Capability — `procedure.add_step` + task-create ad-hoc/routine toggle

**Files:**
- Modify: `packages/ai/src/capabilities/<procedure-or-routine>/tools.ts` — add `add_step` tool
- Test: `__tests__/add-step.test.ts`

Enables "Create task → choose: ad-hoc one-time OR add into a routine" (Pontus 2026-05-22).

- [ ] **Step 1: Write failing test** — `add_step` inserts a `procedure_step` (title/description/step_order/is_required/training_content?/media_urls?) onto a routine's `procedure_id`; appends at max(step_order)+1.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `addStepTool`: resolve routine→procedure_id (fail-fast if routine not in `ctx.workspaceId`, L-0177); insert `procedure_step` at next order; gate + emit. The "ad-hoc" branch already exists (`task.create_day_ad_hoc` → `schedule_day_task`); this tool is the "into-routine" branch.
- [ ] **Step 4: Run → PASS. Step 5: typecheck. Step 6: commit** `feat(procedure-engine): procedure.add_step (task into routine)`

> The task-create UI toggle (ad-hoc vs into-routine) routes to `task.create_day_ad_hoc` (existing) or `procedure.add_step` (this task). UI lives in Task 7's shared form family.

## Task 6: Cron — expand routine steps + stamp provenance + resolve day_line (G-expand, G3)

**Files:**
- Modify: `supabase/functions/session-hook-executor/index.ts`
- Test: `supabase/functions/session-hook-executor/_tests/routine-expand.test.ts`

- [ ] **Step 1: Write failing test** — a hook with `linked_routine_id` (routine has procedure with 3 steps) materializes 3 `session_task` rows (not 1 stub), each with `day_line_id` resolved + `origin='routine'`, `generated_by='cron'`, `source_reference=routine_id`.

- [ ] **Step 2: Run → FAIL** (current code creates 1 stub — G6).

- [ ] **Step 3: Implement** — in the `linked_routine_id` branch: `SELECT procedure_id FROM routine`, then `SELECT * FROM procedure_step WHERE procedure_id ORDER BY step_order`, insert one `session_task` per step (mirror the `linked_procedure_id` branch at lines ~158-188), each carrying `day_line_id` (from `fn_resolve_single_day_line`), provenance triple, `is_compliance_required` from step.

- [ ] **Step 4: Run → PASS. Step 5: deploy locally + smoke. Step 6: commit** `fix(procedure-engine): cron expands routine steps + stamps provenance + day_line anchor`

---

## Task 7: Web — minimal RoutineForm + assign-to-location

**Files:**
- Create: `apps/web/src/app/dashboard/governance/_components/RoutineForm.tsx`
- Create: `apps/web/src/app/dashboard/governance/_hooks/use-routine-mutations.ts`
- Modify: `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx` (mount "Ny rutine")

- [ ] **Step 1:** Follow `ProcedureBuilder.tsx` pattern (shadcn Sheet + form). Fields: name, procedure (select from active procedures), protocol (derived), trigger (times/days), location (select), teams (multi-select, optional). Nordic Split tokens only (no hardcoded colors). **ONE shared `RoutineForm` component (Pontus 2026-05-22)** — reused from every route (governance now; Sesjonsplanlegger Phase 2; Botsson). No per-route variants. Mount points call the same component; props inject context (e.g. preselected location).
- [ ] **Step 2:** `use-routine-mutations.ts` — TanStack mutation calling a server action that delegates to `routine.create` then `routine.assign_to_location`. `emit()` in `onSuccess`.
- [ ] **Step 3:** Mount in governance page. **Acceptance:** admin fills form → routine row + location_id + routine_team rows exist; appears for cron.
- [ ] **Step 4: typecheck + commit** `feat(procedure-engine): web RoutineForm + assign-to-location`

---

## Task 8: Shift location UI (deliverable 4)

**Files:**
- Modify: shift editor in `apps/web/src/components/day/` (AddShiftDialog or schedule shift form)

- [ ] **Step 1–4:** `schedule_shift.location_id` already exists — add a location `<Select>` to the shift create/edit form; on save, set `location_id`. `ensure_shift_session` trigger propagates to `shift_session.location_id`. **Acceptance:** set location on a shift → `shift_session.location_id` matches; Min dag filters to that location. Commit `feat(procedure-engine): set location on shift`.

---

## Task 9: Mobile — clock-in + Min dag (deliverable 1)

**Files:**
- Modify: `apps/mobile/src/hooks/queries/use-shift-session.ts` (clock-in mutation → `status='clocked_in'`)
- Modify: `apps/mobile/src/components/home/DuringShiftView.v2.tsx` (timeline of today's tasks via day_line chain)
- BFF: `apps/web/src/app/api/mobile/shift-session/[id]/clock-in/route.ts` (new)

- [ ] **Step 1: BFF clock-in route** — POST sets `shift_session.status='clocked_in'`, `clocked_in_at=now()`; server-derived identity (ADR-0151); emit telemetry.
- [ ] **Step 2: Mobile clock-in action** wired to BeforeShiftView CTA.
- [ ] **Step 3: Min dag** — `useDayLineItems(shiftSessionId)` resolves `shift_session → shift_session_day_line → day_line → session_task`, gated on `status ∈ scheduled/clocked_in` (G6). Render timeline with start/due. Empty state when none.
- [ ] **Step 4: Acceptance** — employee with published shift clocks in; sees only their/pickup tasks for today at that location; empty when none. Commit `feat(procedure-engine): mobile clock-in + Min dag timeline`.

---

## Task 10: Notifications — late + newly-assigned (deliverable 5)

**Files:**
- Modify: `supabase/functions/session-watchdog-demoter/index.ts` (or sibling) — on `session_task` → `overdue`, emit notification to assignee + manager
- Modify: `packages/ai/src/capabilities/task/tools.ts` — on `assigned_to` set, emit `task assigned` notification
- Test: `_tests/overdue-notify.test.ts`

- [ ] **Step 1: Write failing test** — task past due (status→overdue) produces a notification row for assignee + manager.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — wire overdue transition + assignment to notification engine (`00006_notification_engine.sql` patterns); register `task assigned` + `task overdue` in telemetry registry.
- [ ] **Step 4: Run → PASS. Step 5: commit** `feat(procedure-engine): notify on overdue + newly-assigned task`

---

## Acceptance (Phase 1 falsifiable — from spec §6)

1. Employee with a published shift can clock in; Min dag shows only their/pickup tasks for today at that location; empty when none.
2. Admin creates "Stenge-rutine" bound to a procedure with steps; row exists; appears in routine list.
3. Routine assigned to Lokale 1 → cron materializes `session_task` with `day_line_id` for Lokale 1 that day; not on other locations; each task carries provenance triple + expanded per step (not 1 stub).
4. Manager sets location on a shift → `shift_session.location_id` follows; Min dag filters correctly.
5. Task past due → assignee + manager notified; newly-assigned task → assignee notified.

---

## Self-Review

- **Spec coverage:** §6 deliverables 1–5 → Tasks 9, 3, (4+5+6), 8, 10. Schema delta §2.3 → Tasks 1–2. Provenance/executor_type §7b → Tasks 1–2, 6. ✓
- **Deferred (NOT Phase 1):** manual table, Sesjonsplanlegger canvas, prep-next-shift projection, versioning/diff, M:N procedure↔protocol, token-sweep — these are Phase 2–5.
- **Dependency order:** 1→2 (schema) → 3→4→5 (capability) → 6 (cron) → 7 (web authoring) → 8 (shift loc) → 9 (mobile) → 10 (notif). Tasks 8–9 can parallelize after 6.
- **Type consistency:** `routine_executor_type`, `task_origin`, `task_generated_by` enums defined in Tasks 1–2, consumed in 3/6. `routine_team` PK `(routine_id, team_id)` consistent across 1/4.
