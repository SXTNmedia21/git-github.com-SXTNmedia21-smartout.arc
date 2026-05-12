---
title: "Sortie 1 — Mobile Session-Task Defense Closure (Implementation Plan v2)"
slug: sortie-1-session-task-defense
status: ready
revision: v2-council-corrected-2026-05-13
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0299
learning_slots_reserved: L-0236, L-0237
target_branch: feat/mobile-session-task-defense
target_worktree: ~/dev/smartout.ai-wt-2
tags: [sortie, plan, mobile, defense, bff, rls, telemetry, task]
council_review_history:
  - "2026-05-13 v1 REJECT (14 blockers across 4 reviewers)"
  - "2026-05-13 v2 corrections applied per Steward Phase 5 synthesis"
---

# Sortie 1 — Mobile Session-Task Defense Closure (Implementation Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.
>
> **READ SPEC §3 FIRST.** `docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md` §3 contains verified canonical patterns (gateAction signature, table PK names, telemetry registry shape, helper function signatures). Build-agent MUST consult spec for every API/table/column reference. Do NOT re-derive.

**Goal:** Close every defense violation on mobile session_task surface — BFF-wrap 5 handlers, tighten 5 Zod schemas, RLS WITH CHECK on session_task (with NULL-tolerance + admin-override), register 2 new telemetry events (reuse existing `session_task completed`), fix entity_type bug, delete 2 orphan routes, repair 3 doc-drift surfaces. Extract resolveMobileActor helper. Update BOTSSON-SYSTEM-MAP + STATE-SUMMARY.

**Architecture:** Mobile mutations route through Bearer-auth BFF routes. Each BFF resolves identity from JWT (ADR-0151), delegates to Server Action. Server Action calls `gateAction` from `./_shared` (NOT `@smartout/ai/gate` — that path doesn't exist), uses correct table PK columns (`id` for session_task, `schedule_shift_id` for schedule_shift, `approval_id` for shift_approval), uses correct timestamp columns (`confirmed_at` for schedule_shift, `approved_at` for shift_approval). Defense-in-depth via RLS WITH CHECK + actor predicate that tolerates unassigned-task pickup flow.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL 17 (RLS + RPC), TypeScript strict, Zod `.strict()`, pnpm + Turborepo, Playwright E2E, React Native + Expo, vitest unit.

---

## Pre-flight

- [ ] **P.1: Verify on main repo development branch**

```bash
pwd
git branch --show-current
git status --short
```

Expected: `/home/sxtnl/dev/smartout.ai`, `development`, dirty tree showing Botsson/voice-agent in-flight files (predates session).

- [ ] **P.2: Verify spec + plan on disk**

```bash
ls -la docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md
ls -la docs/superpowers/plans/2026-05-13-sortie-1-session-task-defense.md
```

Both must exist. If missing: write blocked by hook, escalate to Pontus.

- [ ] **P.3: Stash dirty tree**

```bash
git stash push -u -m "pre-sortie-1 botsson voice-agent in-flight 2026-05-13"
git log --oneline -3
git status --short
```

Note the development HEAD SHA for later stash-pop alignment. After stash, tree should be clean (or show only just-committed ADR/spec/plan files staged).

- [ ] **P.4: Commit ADR-0298 + spec + plan + decision-log to development**

```bash
git add docs/decisions/0298-task-ontology-five-sources.md \
        docs/decisions/0000-decision-log.md \
        docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md \
        docs/superpowers/plans/2026-05-13-sortie-1-session-task-defense.md
git status --short  # verify 4 files staged
git commit -m "$(cat <<'EOF'
docs(adr): ADR-0298 task ontology + Sortie 1 spec + plan v2

ADR-0298 declares 5 task ontologies (session_task D6 cascade,
schedule_day_task D6 ad-hoc, personal_task C2 user-curated,
emma_task C2 agent-curated, engine_state_step C2 workflow runtime).
Hybrid architecture: keep separate tables, add fn_list_my_tasks RPC,
register single `task` capability with 6 tools. Validated by Steward +
Supervisor + Harness + Coordinator 2026-05-13.

Sortie 1 (defense) spec + plan committed. v2 corrections applied
per Council Phase 5 synthesis covering 14 blockers (gateAction
import + signature, engine_authority_config schema, schedule_shift PK,
shift_approval columns, is_admin_in_workspace 2-arg, telemetry event
registration, RLS WITH CHECK NULL-tolerance).

Closes Mobile Oppgaver Council verdict 2026-05-12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin development
```

- [ ] **P.5: Create Sortie 1 worktree**

```bash
~/.claude/scripts/new-feature.sh mobile-session-task-defense 2 cascade
```

Worktree at `~/dev/smartout.ai-wt-2` on branch `feat/mobile-session-task-defense`.

- [ ] **P.6: Switch to worktree + verify**

```bash
cd ~/dev/smartout.ai-wt-2
git branch --show-current
ls docs/superpowers/plans/2026-05-13-sortie-1-session-task-defense.md
ls docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md
```

Both files must be present in worktree.

- [ ] **P.7: Start tmux**

```bash
tmux new -s smartout-2 -c ~/dev/smartout.ai-wt-2
```

All subsequent tasks execute from worktree inside tmux.

- [ ] **P.8: Verify Supabase local + migration tip**

```bash
docker ps -q -f name=supabase_db
ls supabase/migrations/ | tail -3
```

Expected tip: `20260604000008_onboarding_capability_authority_seed.sql` or newer. Sortie 1 migrations will use `20260604120000+` timestamps.

If tip moved beyond `20260604120000`, choose timestamps later in the day (`20260604200000+`) and update §4.4 + §4.5 timestamps accordingly.

- [ ] **P.9: Pre-flight grep verification (canonical patterns from spec §3)**

Run these 5 greps. Each must return the EXACT expected result. If any returns differently, the canonical reality has shifted since spec was written — STOP and escalate.

```bash
# 1. gateAction at _shared, not @smartout/ai/gate
grep -n "export async function gateAction" apps/web/src/app/dashboard/_actions/_shared.ts
# Expected: line 79

# 2. engine_authority_config UNIQUE constraint
grep "uq_workspace_capability\|UNIQUE.*workspace_id.*capability" supabase/migrations/20260302000100_engine_authority_config.sql
# Expected: UNIQUE (workspace_id, capability) — TWO columns only

# 3. schedule_shift PK name
grep -A2 "schedule_shift: {" packages/supabase/src/database.types.ts | head -5
# Expected: Row contains schedule_shift_id (NOT id)

# 4. shift_approval PK name
grep -A2 "shift_approval: {" packages/supabase/src/database.types.ts | head -5
# Expected: Row contains approval_id (NOT id)

# 5. is_admin_in_workspace signature
grep "is_admin_in_workspace" supabase/migrations/00004_rls_policies.sql
# Expected: is_admin_in_workspace(uid uuid, wid uuid) — 2 args
```

All 5 must match spec §3 expectations.

---

## Phase 1 — Telemetry registry foundation

Phase 1 lands BEFORE Phase 7 (entity_type fix) — extends EntityType union + registers 2 new events so subsequent emit() calls typecheck.

### Task 1: Extend `EntityType` union + add 2 new event interfaces + EVENT_ROUTING entries

**Files:**
- Modify: `packages/telemetry/src/registry.ts` (multiple sections)

- [ ] **Step 1.1: Locate EntityType union + verify current contents**

```bash
grep -n "^export type EntityType" packages/telemetry/src/registry.ts
sed -n '65,180p' packages/telemetry/src/registry.ts | grep -E '"(personal_task|schedule_day_task|emma_task|session_task)"'
```

Note: if `personal_task`, `schedule_day_task`, or `emma_task` already exist in union, skip adding those — only add missing ones.

- [ ] **Step 1.2: Add missing EntityType union members**

Use Edit tool. Locate the `EntityType` union (likely ending around `"engine_session"`). Add the 3 new values immediately after `"session_task"` line:

```typescript
  | "session_task"
  | "personal_task"
  | "schedule_day_task"
  | "emma_task"
```

If any of the 3 already exist (per Step 1.1), skip those.

- [ ] **Step 1.3: Add 2 new event interfaces**

Find the existing `SessionTaskCompleted` interface (around line 980). Add immediately after it:

```typescript
export interface ShiftConfirmed extends BaseEvent {
  event: "shift confirmed";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "mobile";
      channel: string;
    };
  };
}

export interface HoursConfirmed extends BaseEvent {
  event: "hours confirmed";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "mobile";
      channel: string;
    };
  };
}
```

- [ ] **Step 1.4: Add to SmartoutEvent discriminated union**

```bash
grep -n "^export type SmartoutEvent" packages/telemetry/src/registry.ts
```

Find the SmartoutEvent union. Add 2 new entries in the alphabetical position (or end if simpler):

```typescript
  | ShiftConfirmed
  | HoursConfirmed
```

- [ ] **Step 1.5: Add EVENT_ROUTING entries**

Find `export const EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta>` (around line 9045). Add 2 entries near the `"session_task completed"` entry:

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

- [ ] **Step 1.6: Typecheck**

```bash
pnpm --filter @smartout/telemetry typecheck
```

Expected: 0 errors.

- [ ] **Step 1.7: Verify EmitEvent union accepts the new strings**

```bash
grep "shift confirmed\|hours confirmed" packages/telemetry/src/registry.ts | head -10
```

Each should appear 2+ times (interface declaration + EVENT_ROUTING entry).

- [ ] **Step 1.8: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): EntityType union + shift confirmed + hours confirmed events

Extends EntityType union with personal_task, schedule_day_task,
emma_task (preconditions for personal/tools.ts:192 entity_type fix
in Task 7).

Adds 2 new event interfaces + SmartoutEvent union entries +
EVENT_ROUTING entries:
- "shift confirmed" → posthog+logger+activity_trail+engine_event
- "hours confirmed" → posthog+logger+activity_trail+engine_event

Reuses existing "session_task completed" for task complete path
(no new event needed there).

Closes ADR-0298 §3.5 + Sortie 1 spec §4.8.

Refs: ADR-0298, L-0064.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Database migrations (3 migrations, single commit)

### Task 2: RLS WITH CHECK on session_task with NULL-tolerance + admin-override

**Files:**
- Create: `supabase/migrations/20260604120000_session_task_rls_with_check.sql`

- [ ] **Step 2.1: Verify timestamp slot free**

```bash
ls supabase/migrations/ | grep "20260604120"
```

Expected: empty.

- [ ] **Step 2.2: Write migration**

Create `supabase/migrations/20260604120000_session_task_rls_with_check.sql`:

```sql
-- Sortie 1 — Defense closure for session_task UPDATE.
-- Per ADR-0298 R5 + Spec §4.6: session_task UPDATE policy must include
-- WITH CHECK + actor predicate that tolerates unassigned-task pickup flow
-- (D6 cascade state machine — assigned_to flips NULL → caller during pickup).

DROP POLICY IF EXISTS "jwt_update_session_task" ON public.session_task;

CREATE POLICY "jwt_update_session_task" ON public.session_task
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      -- Assignee completes own task
      assigned_to IN (
        SELECT profile_id FROM public.profile
        WHERE user_id = auth.uid() AND is_active = true
      )
      -- OR task is unassigned (pickup flow per D6 cascade — preserves
      -- session_hook_dispatcher cron-creates-then-employee-picks-up)
      OR assigned_to IS NULL
      -- OR admin in workspace (2-arg signature per 00004_rls_policies.sql:33)
      OR public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );
```

- [ ] **Step 2.3: Apply migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres < supabase/migrations/20260604120000_session_task_rls_with_check.sql
```

Expected output: `DROP POLICY` then `CREATE POLICY`.

- [ ] **Step 2.4: Verify policy has both USING + WITH CHECK**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT policyname, cmd, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_with_check FROM pg_policies WHERE tablename='session_task' AND policyname='jwt_update_session_task';"
```

Expected: 1 row, `cmd=UPDATE`, `has_using=t`, `has_with_check=t`.

### Task 3: Gate-action seed (3 capabilities, 1 migration)

**Files:**
- Create: `supabase/migrations/20260604121000_sortie_1_gate_action_seed.sql`

- [ ] **Step 3.1: Write migration**

```sql
-- Sortie 1 — Seed 3 gate-action capabilities for all existing workspaces.
-- Per ADR-0298 §4.4 + Spec §4.7 + canonical seed pattern
-- supabase/migrations/20260428220007_tips_authority_seed.sql.
--
-- COLUMN SCHEMA (verified via 20260302000100 + ALTERs):
--   capability                text    NOT NULL  (dotted slug)
--   level                     text    NOT NULL  (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   min_role                  text    NOT NULL  (DEFAULT 'employee')
--   requires_four_eyes        boolean NOT NULL  (DEFAULT false)
--   observer_escalation_hours integer NOT NULL  (DEFAULT 72)
--   updated_by                uuid    NULL      (platform seed = NULL per 20260414225000)
--
-- UNIQUE CONSTRAINT: uq_workspace_capability (workspace_id, capability) — 2 columns only.
-- Dotted-slug pattern (task.complete_session_task) means each is independent row.

SET search_path TO public, extensions;

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  v.capability,
  v.level,
  v.min_role,
  v.requires_four_eyes,
  v.observer_escalation_hours,
  NULL::uuid
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('task.complete_session_task',  'suggest',   'employee', false, 72),
    ('schedule.confirm_shift',      'suggest',   'employee', false, 72),
    ('timesheet.confirm_hours',     'suggest',   'employee', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added task.complete_session_task + schedule.confirm_shift + timesheet.confirm_hours '
  '2026-05-13 (Sortie 1 mobile-session-task-defense).';
```

- [ ] **Step 3.2: Apply migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres < supabase/migrations/20260604121000_sortie_1_gate_action_seed.sql
```

Expected: `INSERT 0 N` where N = workspace count × 3.

- [ ] **Step 3.3: Verify seed rows**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT capability, COUNT(*) FROM public.engine_authority_config WHERE capability IN ('task.complete_session_task', 'schedule.confirm_shift', 'timesheet.confirm_hours') GROUP BY capability;"
```

Expected: 3 rows, each with count = workspace count.

### Task 4: Regenerate types + commit Phase 2

- [ ] **Step 4.1: Regenerate types (NO op run per L-0064 memory)**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4.2: Verify diff minimal**

```bash
git diff packages/supabase/src/database.types.ts | head -30
```

RLS-only + seed-row migrations shouldn't change types meaningfully. If structural diff: investigate.

- [ ] **Step 4.3: Commit Phase 2**

```bash
git add supabase/migrations/20260604120000_session_task_rls_with_check.sql \
        supabase/migrations/20260604121000_sortie_1_gate_action_seed.sql \
        packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): session_task RLS WITH CHECK + 3 gate-action seeds

Two migrations per ADR-0298 + Spec §4.6 + §4.7:

1. 20260604120000_session_task_rls_with_check.sql
   - Adds WITH CHECK + actor predicate to jwt_update_session_task
   - NULL-tolerance preserves session_hook_dispatcher cron pickup flow
   - Admin-override via is_admin_in_workspace(auth.uid(), workspace_id) — 2-arg
   - Closes Supervisor R2 RLS class-hole finding for session_task only

2. 20260604121000_sortie_1_gate_action_seed.sql
   - Single migration seeds task.complete_session_task,
     schedule.confirm_shift, timesheet.confirm_hours for all workspaces
   - Canonical column set per tips_authority_seed.sql reference
   - ON CONFLICT (workspace_id, capability) matches uq_workspace_capability

Types regenerated. Out-of-band for personal_task FOR ALL split +
emma_task UPDATE WITH CHECK + ≥27 other UPDATE policies (Sortie A).

Refs: ADR-0298 R5, L-0042 (timestamp ordering).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Shared helper extraction

### Task 5: Extract `resolveMobileActor` to shared module

**Files:**
- Create: `apps/web/src/app/api/mobile/_shared/actor.ts`
- Modify: `apps/web/src/app/api/mobile/tasks/route.ts` (replace inline function with import)

- [ ] **Step 5.1: Read existing inline function**

```bash
sed -n '45,80p' apps/web/src/app/api/mobile/tasks/route.ts
```

Capture the full `resolveMobileActor` function body + `ResolvedActor` type.

- [ ] **Step 5.2: Write shared module**

Create `apps/web/src/app/api/mobile/_shared/actor.ts`:

```typescript
/**
 * Shared mobile actor resolver for Bearer-auth BFF routes.
 *
 * Resolves identity from Bearer JWT — workspace_id and profile_id are
 * NEVER accepted from request body (ADR-0151). Returns null on any
 * resolution failure (invalid token, no active profile, empty fields).
 *
 * Per ADR-0298 §4.2 + Spec §3.6: helper functions use canonical signatures
 * from 00004_rls_policies.sql.
 *
 * References: ADR-0078, ADR-0132, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";

export type ResolvedActor = {
  userId: string;
  profileId: string;
  workspaceId: string;
  role: string | null;
};

export async function resolveMobileActor(
  bearerToken: string,
): Promise<ResolvedActor | null> {
  const admin = createAdminClient();

  const { data: userData, error: userErr } = await admin.auth.getUser(bearerToken);
  if (userErr || !userData.user) return null;

  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  // Fail fast on empty identity (ADR-0134 / L-0177).
  if (!profile.profile_id || !profile.workspace_id) return null;

  return {
    userId: userData.user.id,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}
```

- [ ] **Step 5.3: Refactor existing `tasks/route.ts` to import from shared**

```bash
sed -n '1,30p' apps/web/src/app/api/mobile/tasks/route.ts
```

Use Edit tool. Replace inline `resolveMobileActor` function declaration + `ResolvedActor` type with:

```typescript
import { resolveMobileActor, type ResolvedActor } from "../_shared/actor";
```

Remove the local declarations. Keep all other route logic intact.

- [ ] **Step 5.4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: 0 errors.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/app/api/mobile/_shared/actor.ts \
        apps/web/src/app/api/mobile/tasks/route.ts
git commit -m "$(cat <<'EOF'
refactor(api): extract resolveMobileActor to shared module

Per Council Phase 3 finding (Harness G2) + Spec §4.2: prevent
triplication across 3 new BFF routes by extracting helper now.
Existing /api/mobile/tasks/route.ts refactored to import from shared.

Refs: ADR-0151, ADR-0298.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Server Actions (3 TDD)

### Task 6: completeSessionTaskAction

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts`
- Test: `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts`

- [ ] **Step 6.1: Read addTaskAction reference for canonical shape**

```bash
sed -n '1,80p' apps/web/src/app/dashboard/_actions/add-task-action.ts
sed -n '120,140p' apps/web/src/app/dashboard/_actions/add-task-action.ts
```

Note: imports `gateAction` from `./_shared`, returns object with `.allow`, uses `workspaceId/capability/channel/actorProfileId/actionType/entityId` argument shape.

- [ ] **Step 6.2: Write failing test**

Create `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeSessionTaskAction } from "../complete-session-task-action";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

const adminMock = vi.fn();
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminMock }),
}));

const gateMock = vi.fn();
vi.mock("../_shared", async () => {
  const actual = await vi.importActual<typeof import("../_shared")>("../_shared");
  return { ...actual, gateAction: (...args: unknown[]) => gateMock(...args) };
});

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

describe("completeSessionTaskAction", () => {
  const actor: ResolvedActor = {
    userId: "00000000-0000-0000-0000-00000000000A",
    profileId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    role: "employee",
  };

  beforeEach(() => {
    adminMock.mockReset();
    gateMock.mockReset();
    emitMock.mockReset();
  });

  it("returns ok=true and emits when gate allows + workspace+assignee match", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: actor.workspaceId, assigned_to: actor.profileId, title: "Test" },
          error: null,
        }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock }).mockReturnValueOnce({ update: updateMock });
    gateMock.mockResolvedValue({ allow: true });

    const result = await completeSessionTaskAction(taskId, actor, "system");

    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: actor.workspaceId,
        capability: "task.complete_session_task",
        channel: "system",
        actorProfileId: actor.profileId,
        actionType: "complete",
        entityId: taskId,
      })
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session_task completed",
        workspace_id: actor.workspaceId,
        actor_id: actor.profileId,
      })
    );
  });

  it("returns ok=false when row workspace differs", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD", assigned_to: actor.profileId },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/annet arbeidsrom/i);
    expect(gateMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when gate denies", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: actor.workspaceId, assigned_to: actor.profileId },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });
    gateMock.mockResolvedValue({ allow: false, reason: "denied by policy" });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/denied by policy|ikke autorisert/i);
  });

  it("returns ok=false when row not found", async () => {
    const taskId = "00000000-0000-0000-0000-000000000010";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await completeSessionTaskAction(taskId, actor, "system");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/finnes ikke/i);
  });
});
```

- [ ] **Step 6.3: Run test (FAIL expected)**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts
```

Expected: import-not-found.

- [ ] **Step 6.4: Write implementation**

Create `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts`:

```typescript
/**
 * completeSessionTaskAction — Server Action for completing a session_task.
 *
 * Per ADR-0298 §3.1 + Spec §4.3:
 * - Identity pre-resolved via ResolvedActor (ADR-0151)
 * - gateAction from ./_shared with dotted-slug capability + actorProfileId
 *   + entityId (matches add-task-action.ts:123 pattern)
 * - session_task PK is `id`
 * - Emit reuses existing "session_task completed" event
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0287, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type CompleteSessionTaskResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

export async function completeSessionTaskAction(
  taskId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<CompleteSessionTaskResult> {
  const admin = createAdminClient();

  // 1. Load row, verify workspace.
  const { data: row, error: loadErr } = await admin
    .from("session_task")
    .select("workspace_id, assigned_to, title, status")
    .eq("id", taskId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: `Kunne ikke laste oppgaven: ${loadErr.message}` };
  }
  if (!row) {
    return { ok: false, error: "Oppgaven finnes ikke." };
  }
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Oppgaven tilhører et annet arbeidsrom." };
  }

  // 2. Idempotency — already completed.
  if (row.status === "completed") {
    return { ok: true, taskId };
  }

  // 3. Gate check (per add-task-action.ts:123 pattern).
  /* @authority-gate: capability='task.complete_session_task' level='suggest' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "task.complete_session_task",
    channel,
    actorProfileId: actor.profileId,
    actionType: "complete",
    entityId: taskId,
  });

  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 4. Gated UPDATE — RLS WITH CHECK enforces assignee | NULL | admin (Task 2).
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("session_task")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: actor.profileId,
    })
    .eq("id", taskId);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke oppdatere oppgaven: ${updateErr.message}` };
  }

  // 5. Telemetry — reuse existing "session_task completed" event.
  void emit({
    event: "session_task completed",
    workspace_id: actor.workspaceId,
    actor_id: actor.profileId,
    properties: {
      entity: {
        entity_type: "session_task",
        entity_id: taskId,
        entity_label: row.title ?? undefined,
      },
      metadata: {
        source: "session",
        channel,
        completed_via: actor.role === "employee" ? "self" : "manager",
      },
    },
  });

  return { ok: true, taskId };
}
```

Note: emit `properties.entity.entity_label` matches `addTaskAction:166` reference pattern. The exact shape of properties must match the existing `SessionTaskCompleted` interface in registry.ts — if interface defines additional required fields, add them. Run typecheck before declaring done.

- [ ] **Step 6.5: Run test + typecheck**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts
pnpm --filter web typecheck
```

Both PASS.

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/app/dashboard/_actions/complete-session-task-action.ts \
        apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): add completeSessionTaskAction Server Action

Mirrors addTaskAction shape: pre-resolved actor + channel hint, runs
gateAction from ./_shared with dotted-slug capability, verifies workspace +
loads row by id (session_task PK is `id`), executes gated UPDATE with
RLS WITH CHECK enforcement, emits existing "session_task completed"
event with entity_label.

Idempotent — status='completed' already returns 200 with taskId.

Closes ADR-0298 §3.1 + Spec §4.3.

Refs: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0287, ADR-0298.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: confirmShiftAction

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/confirm-shift-action.ts`
- Test: `apps/web/src/app/dashboard/_actions/__tests__/confirm-shift-action.test.ts`

- [ ] **Step 7.1: Write failing test**

Create test mirroring Task 6.2 with these substitutions:
- Function name: `confirmShiftAction`
- ID variable: `shiftId`
- Table mock data: `{ workspace_id, employee_id }` (NOT `assigned_to` — schedule_shift uses `employee_id`)
- Gate expected: `capability: "schedule.confirm_shift", actionType: "confirm"`
- Emit expected: `event: "shift confirmed"`, `entity_type: "schedule_shift"`
- Cross-workspace test data field: `employee_id: actor.profileId`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmShiftAction } from "../confirm-shift-action";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

const adminMock = vi.fn();
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminMock }),
}));

const gateMock = vi.fn();
vi.mock("../_shared", async () => {
  const actual = await vi.importActual<typeof import("../_shared")>("../_shared");
  return { ...actual, gateAction: (...args: unknown[]) => gateMock(...args) };
});

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

describe("confirmShiftAction", () => {
  const actor: ResolvedActor = {
    userId: "00000000-0000-0000-0000-00000000000A",
    profileId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    role: "employee",
  };

  beforeEach(() => {
    adminMock.mockReset();
    gateMock.mockReset();
    emitMock.mockReset();
  });

  it("returns ok=true when shift matches workspace + employee and gate allows", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: actor.workspaceId, employee_id: actor.profileId },
          error: null,
        }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock }).mockReturnValueOnce({ update: updateMock });
    gateMock.mockResolvedValue({ allow: true });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "schedule.confirm_shift",
        actionType: "confirm",
        actorProfileId: actor.profileId,
        entityId: shiftId,
      })
    );
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ event: "shift confirmed" }));
  });

  it("returns ok=false when shift workspace differs", async () => {
    const shiftId = "00000000-0000-0000-0000-000000000020";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD", employee_id: actor.profileId },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmShiftAction(shiftId, actor, "system");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 7.2: Run test (FAIL)**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/confirm-shift-action.test.ts
```

- [ ] **Step 7.3: Write implementation**

Create `apps/web/src/app/dashboard/_actions/confirm-shift-action.ts`:

```typescript
/**
 * confirmShiftAction — Server Action for confirming a schedule_shift.
 *
 * Per ADR-0298 + Spec §4.3:
 * - schedule_shift PK is schedule_shift_id (NOT id)
 * - schedule_shift has confirmed_at + confirmed_by columns (NOT approved_*)
 * - Actor column is employee_id (NOT assigned_to or profile_id)
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type ConfirmShiftResult =
  | { ok: true; shiftId: string }
  | { ok: false; error: string };

export async function confirmShiftAction(
  shiftId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<ConfirmShiftResult> {
  const admin = createAdminClient();

  const { data: row, error: loadErr } = await admin
    .from("schedule_shift")
    .select("workspace_id, employee_id, confirmed_at")
    .eq("schedule_shift_id", shiftId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: `Kunne ikke laste vakten: ${loadErr.message}` };
  if (!row) return { ok: false, error: "Vakten finnes ikke." };
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Vakten tilhører et annet arbeidsrom." };
  }
  if (row.confirmed_at) {
    return { ok: true, shiftId };  // idempotent
  }

  /* @authority-gate: capability='schedule.confirm_shift' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "schedule.confirm_shift",
    channel,
    actorProfileId: actor.profileId,
    actionType: "confirm",
    entityId: shiftId,
  });

  if (!gate.allow) return { ok: false, error: gate.reason ?? "Ikke autorisert." };

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("schedule_shift")
    .update({ confirmed_at: now, confirmed_by: actor.profileId })
    .eq("schedule_shift_id", shiftId);

  if (updateErr) return { ok: false, error: `Kunne ikke bekrefte vakten: ${updateErr.message}` };

  void emit({
    event: "shift confirmed",
    workspace_id: actor.workspaceId,
    actor_id: actor.profileId,
    properties: {
      entity: { entity_type: "schedule_shift", entity_id: shiftId },
      metadata: { source: "session", channel },
    },
  });

  return { ok: true, shiftId };
}
```

- [ ] **Step 7.4: Test + typecheck + commit**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/confirm-shift-action.test.ts
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/_actions/confirm-shift-action.ts \
        apps/web/src/app/dashboard/_actions/__tests__/confirm-shift-action.test.ts
git commit -m "feat(actions): add confirmShiftAction Server Action

Uses canonical schedule_shift PK (schedule_shift_id), correct column
names (confirmed_at + confirmed_by), employee_id for actor.

Refs: ADR-0298 Spec §3.4 + §4.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: confirmHoursAction (JOIN through shift_id)

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/confirm-hours-action.ts`
- Test: `apps/web/src/app/dashboard/_actions/__tests__/confirm-hours-action.test.ts`

shift_approval has no direct profile column. Actor verification = JOIN through `shift_id → schedule_shift.employee_id`.

- [ ] **Step 8.1: Write failing test**

Mirror Task 7.1 with substitutions:
- Function: `confirmHoursAction`
- ID variable: `approvalId`
- Table mock data shape: row contains `{ workspace_id, shift_id }` AND a `schedule_shift` join: `{ workspace_id, shift_id, schedule_shift: { employee_id } }` (use Supabase's foreign-key embed pattern)
- Gate: `capability: "timesheet.confirm_hours", actionType: "confirm"`
- Emit: `event: "hours confirmed"`, `entity_type: "shift_approval"`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmHoursAction } from "../confirm-hours-action";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

const adminMock = vi.fn();
vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminMock }),
}));

const gateMock = vi.fn();
vi.mock("../_shared", async () => {
  const actual = await vi.importActual<typeof import("../_shared")>("../_shared");
  return { ...actual, gateAction: (...args: unknown[]) => gateMock(...args) };
});

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

describe("confirmHoursAction", () => {
  const actor: ResolvedActor = {
    userId: "00000000-0000-0000-0000-00000000000A",
    profileId: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    role: "employee",
  };

  beforeEach(() => {
    adminMock.mockReset();
    gateMock.mockReset();
    emitMock.mockReset();
  });

  it("returns ok=true when approval+shift match actor and gate allows", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            workspace_id: actor.workspaceId,
            shift_id: "00000000-0000-0000-0000-000000000031",
            status: "pending",
            schedule_shift: { employee_id: actor.profileId },
          },
          error: null,
        }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock }).mockReturnValueOnce({ update: updateMock });
    gateMock.mockResolvedValue({ allow: true });

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(true);
    expect(gateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "timesheet.confirm_hours",
        actionType: "confirm",
        entityId: approvalId,
      })
    );
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ event: "hours confirmed" }));
  });

  it("returns ok=false when approval workspace differs", async () => {
    const approvalId = "00000000-0000-0000-0000-000000000030";
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD", shift_id: "ignored", status: "pending", schedule_shift: { employee_id: actor.profileId } },
          error: null,
        }),
      }),
    });
    adminMock.mockReturnValueOnce({ select: selectMock });

    const result = await confirmHoursAction(approvalId, actor, "system");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 8.2: Run test (FAIL)**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/confirm-hours-action.test.ts
```

- [ ] **Step 8.3: Write implementation**

Create `apps/web/src/app/dashboard/_actions/confirm-hours-action.ts`:

```typescript
/**
 * confirmHoursAction — Server Action for confirming a shift_approval.
 *
 * Per ADR-0298 + Spec §3.5 + §4.3:
 * - shift_approval PK is approval_id (NOT id)
 * - shift_approval has approved_at + approved_by (NOT confirmed_*)
 * - Status enum: pending|approved|edited|disputed
 * - No direct profile column — JOIN through shift_id → schedule_shift.employee_id
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type ConfirmHoursResult =
  | { ok: true; approvalId: string }
  | { ok: false; error: string };

export async function confirmHoursAction(
  approvalId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<ConfirmHoursResult> {
  const admin = createAdminClient();

  // JOIN through shift_id → schedule_shift.employee_id for actor verification.
  const { data: row, error: loadErr } = await admin
    .from("shift_approval")
    .select("workspace_id, shift_id, status, schedule_shift:shift_id(employee_id)")
    .eq("approval_id", approvalId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: `Kunne ikke laste timeoppgjøret: ${loadErr.message}` };
  if (!row) return { ok: false, error: "Timeoppgjøret finnes ikke." };
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Timeoppgjøret tilhører et annet arbeidsrom." };
  }
  if (row.status === "approved") {
    return { ok: true, approvalId };  // idempotent
  }

  // Actor must be the employee owning the underlying shift OR admin.
  // RLS WITH CHECK on shift_approval is out-of-scope (Sortie A) — gate handles
  // authorization at app layer.
  const shiftEmployee = (row.schedule_shift as { employee_id: string } | null)?.employee_id;
  const isOwner = shiftEmployee === actor.profileId;
  const isManager = actor.role === "manager" || actor.role === "admin" || actor.role === "owner";
  if (!isOwner && !isManager) {
    return { ok: false, error: "Ikke autorisert: ikke din vakt." };
  }

  /* @authority-gate: capability='timesheet.confirm_hours' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "timesheet.confirm_hours",
    channel,
    actorProfileId: actor.profileId,
    actionType: "confirm",
    entityId: approvalId,
  });

  if (!gate.allow) return { ok: false, error: gate.reason ?? "Ikke autorisert." };

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("shift_approval")
    .update({ status: "approved", approved_at: now, approved_by: actor.profileId })
    .eq("approval_id", approvalId);

  if (updateErr) return { ok: false, error: `Kunne ikke bekrefte timeoppgjøret: ${updateErr.message}` };

  void emit({
    event: "hours confirmed",
    workspace_id: actor.workspaceId,
    actor_id: actor.profileId,
    properties: {
      entity: { entity_type: "shift_approval", entity_id: approvalId },
      metadata: { source: "session", channel },
    },
  });

  return { ok: true, approvalId };
}
```

- [ ] **Step 8.4: Test + typecheck + commit**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/confirm-hours-action.test.ts
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/_actions/confirm-hours-action.ts \
        apps/web/src/app/dashboard/_actions/__tests__/confirm-hours-action.test.ts
git commit -m "feat(actions): add confirmHoursAction Server Action

Uses canonical shift_approval PK (approval_id), correct columns
(approved_at + approved_by + status='approved'), JOIN through
shift_id → schedule_shift.employee_id for actor verification (no
direct profile column).

Refs: ADR-0298 Spec §3.5 + §4.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — BFF routes (3)

### Task 9: PATCH /api/mobile/tasks/[id]/complete

**Files:**
- Create: `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts`

- [ ] **Step 9.1: Write route**

Create `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts`:

```typescript
/**
 * BFF /api/mobile/tasks/[id]/complete — mobile completes a session_task.
 *
 * Per ADR-0132 + ADR-0151 + Spec §4.1:
 * - Bearer JWT only
 * - Body MUST be empty (strict schema rejects unknown keys)
 * - Identity derived from JWT via resolveMobileActor (no body fields)
 * - Delegates to completeSessionTaskAction with channel='system'
 *
 * References: ADR-0078, ADR-0099, ADR-0114, ADR-0132, ADR-0134,
 *             ADR-0151, ADR-0266, ADR-0298.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveMobileActor } from "../../../_shared/actor";
import { completeSessionTaskAction } from "@/app/dashboard/_actions/complete-session-task-action";

export const runtime = "nodejs";

// Strict empty-body schema — rejects ALL unknown keys per ADR-0151.
const RequestSchema = z.object({}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Validate path param via z.string().uuid() (NOT loose regex).
  const { id: taskId } = await params;
  if (!z.string().uuid().safeParse(taskId).success) {
    return NextResponse.json({ ok: false, error: "Ugyldig oppgave-ID" }, { status: 422 });
  }

  // 2. Bearer auth.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse body — strict empty object.
  let bodyRaw: unknown = {};
  try {
    const text = await request.text();
    bodyRaw = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 422 });
  }
  const parsed = RequestSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    const path = parsed.error.errors[0]?.path.join(".") ?? "ukjent";
    return NextResponse.json(
      { ok: false, error: `Body inneholder ulovlige felt: ${path}` },
      { status: 422 },
    );
  }

  // 4. Delegate.
  const result = await completeSessionTaskAction(taskId, actor, "system");
  if (result.ok === false) {
    const isAuth = result.error.startsWith("Ikke autorisert") || result.error.includes("annet arbeidsrom");
    return NextResponse.json({ ok: false, error: result.error }, { status: isAuth ? 403 : 422 });
  }
  return NextResponse.json({ ok: true, taskId: result.taskId }, { status: 200 });
}
```

- [ ] **Step 9.2: Typecheck + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/api/mobile/tasks/\[id\]/complete/route.ts
git commit -m "feat(api): mobile BFF /api/mobile/tasks/[id]/complete

Bearer-auth PATCH. Empty-body strict schema rejects forgeable identity.
Path param validated via z.string().uuid() (not loose regex).
Delegates to completeSessionTaskAction.

Refs: ADR-0132, ADR-0151, ADR-0298 Spec §4.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: PATCH /api/mobile/shifts/[id]/confirm

**Files:**
- Create: `apps/web/src/app/api/mobile/shifts/[id]/confirm/route.ts`

- [ ] **Step 10.1: Write route**

Same structure as Task 9. Substitutions:
- Import: `confirmShiftAction` from `@/app/dashboard/_actions/confirm-shift-action`
- Path var: `shiftId`
- Delegate: `confirmShiftAction(shiftId, actor, "system")`
- Response: `{ ok: true, shiftId: result.shiftId }`
- Error string: `"Ugyldig vakt-ID"`
- Docstring path: `/api/mobile/shifts/[id]/confirm — mobile confirms a schedule_shift`

- [ ] **Step 10.2: Typecheck + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/api/mobile/shifts/\[id\]/confirm/route.ts
git commit -m "feat(api): mobile BFF /api/mobile/shifts/[id]/confirm

Bearer-auth PATCH mirroring tasks/[id]/complete. Delegates to
confirmShiftAction.

Refs: ADR-0132, ADR-0298 Spec §4.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: PATCH /api/mobile/shift-approvals/[id]/confirm

**Files:**
- Create: `apps/web/src/app/api/mobile/shift-approvals/[id]/confirm/route.ts`

- [ ] **Step 11.1: Write route**

Same structure. Substitutions: `confirmHoursAction`, `approvalId`, response `{ ok: true, approvalId }`, error `"Ugyldig timeoppgjør-ID"`.

- [ ] **Step 11.2: Typecheck + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/api/mobile/shift-approvals/\[id\]/confirm/route.ts
git commit -m "feat(api): mobile BFF /api/mobile/shift-approvals/[id]/confirm

Bearer-auth PATCH. Delegates to confirmHoursAction.

Refs: ADR-0132, ADR-0298 Spec §4.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Mobile schema tightening (5)

### Task 12: Convert 3 catchall + tighten 2 bare-object schemas

**Files:**
- Modify: `apps/mobile/src/lib/sync/schemas.ts` (5 schema blocks)

Per Spec §3.9 actual schema state:

| Schema | Line | Action |
|---|---|---|
| `completeTaskSchema` | 82-87 | catchall → strict; drop `status` |
| `completeCheckpointSchema` | 89-95 | bare → strict; drop `status`, `completed_by`, `completed_at`, `evidence`. Keep `task_id` only |
| `signChecklistSchema` | 97-102 | bare → strict; drop `status`, `completed_by`, `completed_at`. Keep `task_ids` only |
| `confirmShiftSchema` | 113-117 | catchall → strict. Keep `schedule_shift_id` only |
| `confirmHoursSchema` | 138-142 | catchall → strict. Keep `approval_id` only |

- [ ] **Step 12.1: Read current state of all 5 schemas**

```bash
sed -n '80,145p' apps/mobile/src/lib/sync/schemas.ts
```

Verify line numbers + current shape.

- [ ] **Step 12.2: Rewrite all 5 schemas via Edit tool**

For `completeTaskSchema`:
```typescript
const completeTaskSchema = z
  .object({
    id: uuid,
  })
  .strict();
```

For `completeCheckpointSchema`:
```typescript
const completeCheckpointSchema = z
  .object({
    task_id: uuid,
  })
  .strict();
```

For `signChecklistSchema`:
```typescript
const signChecklistSchema = z
  .object({
    task_ids: z.array(uuid).min(1),
  })
  .strict();
```

For `confirmShiftSchema`:
```typescript
const confirmShiftSchema = z
  .object({
    schedule_shift_id: uuid,
  })
  .strict();
```

For `confirmHoursSchema`:
```typescript
const confirmHoursSchema = z
  .object({
    approval_id: uuid,
  })
  .strict();
```

- [ ] **Step 12.3: Verify catchall count dropped from 14 to 11**

```bash
grep -c "catchall(z.unknown())" apps/mobile/src/lib/sync/schemas.ts
```

Expected: 11 (was 14, dropped 3 from catchall conversions: completeTaskSchema, confirmShiftSchema, confirmHoursSchema).

Note: completeCheckpointSchema and signChecklistSchema didn't have catchall to begin with — they were already bare `.object()`. Total reduction: 3 catchall removals + 2 strict additions = 5 schemas tightened total.

- [ ] **Step 12.4: Typecheck mobile**

```bash
pnpm --filter @smartout/mobile typecheck
```

- [ ] **Step 12.5: Commit**

```bash
git add apps/mobile/src/lib/sync/schemas.ts
git commit -m "$(cat <<'EOF'
feat(mobile): tighten 5 task-class Zod schemas

Per ADR-0298 Spec §3.9 verified schema state + §4.5:
- completeTaskSchema, confirmShiftSchema, confirmHoursSchema:
  .catchall(z.unknown()) → .strict(). Drop status field (server forces).
- completeCheckpointSchema, signChecklistSchema: already bare object,
  add .strict() + drop forgeable fields (status, completed_by, completed_at).

Identity fields rejected at enqueue per L-0177 / L-0237 class-bug.
Schema field names verified: id (session_task), task_id (checkpoint),
task_ids (checklist), schedule_shift_id, approval_id.

9 remaining catchall schemas in Sortie B.

Refs: ADR-0151, ADR-0298 §3.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Mobile action-map BFF wiring (5)

### Task 13: Wire 5 handlers in single commit

**Files:**
- Modify: `apps/mobile/src/lib/sync/action-map.ts` (5 handler blocks)

- [ ] **Step 13.1: Locate web-API base URL helper**

```bash
grep -n "getMobileTasksUrl\|getWebApiBase\|WEB_API_URL\|getWebApi" apps/mobile/src/lib/sync/action-map.ts | head
```

Note exact name. Use same helper in all 5 new handlers.

- [ ] **Step 13.2: Read existing `create_task` handler (canonical pattern)**

```bash
sed -n '265,310p' apps/mobile/src/lib/sync/action-map.ts
```

- [ ] **Step 13.3: Replace `complete_task` (line 104-110)**

```typescript
  // BFF-wrapped per ADR-0298 R3 (Sortie 1). Identity from JWT (ADR-0151).
  complete_task: async (p) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot complete task via BFF");
    const { id } = p as { id: string };
    if (!id) throw new Error("complete_task: missing task id");
    const url = `${getWebApiBase()}/api/mobile/tasks/${id}/complete`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`complete_task BFF ${res.status}: ${text || res.statusText}`);
    }
  },
```

(Replace `getWebApiBase` with actual helper name from Step 13.1.)

- [ ] **Step 13.4: Replace `complete_checkpoint` (line 336-347)**

Same pattern. Schema field is `task_id` (NOT `id`):

```typescript
  complete_checkpoint: async (p) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot complete checkpoint via BFF");
    const { task_id } = p as { task_id: string };
    if (!task_id) throw new Error("complete_checkpoint: missing task_id");
    const url = `${getWebApiBase()}/api/mobile/tasks/${task_id}/complete`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`complete_checkpoint BFF ${res.status}: ${text || res.statusText}`);
    }
  },
```

- [ ] **Step 13.5: Replace `sign_checklist` (line 350-364)**

Schema field is `task_ids: string[]` array — loop sequentially:

```typescript
  sign_checklist: async (p) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot sign checklist via BFF");
    const { task_ids } = p as { task_ids: string[] };
    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      throw new Error("sign_checklist: task_ids missing or empty");
    }
    const base = getWebApiBase();
    for (const taskId of task_ids) {
      if (!taskId) throw new Error(`sign_checklist: invalid task id ${taskId}`);
      const res = await fetch(`${base}/api/mobile/tasks/${taskId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`sign_checklist BFF item ${taskId} ${res.status}: ${text || res.statusText}`);
      }
    }
  },
```

- [ ] **Step 13.6: Replace `confirm_shift` (line 112-118)**

Schema field is `schedule_shift_id`:

```typescript
  confirm_shift: async (p) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot confirm shift via BFF");
    const { schedule_shift_id } = p as { schedule_shift_id: string };
    if (!schedule_shift_id) throw new Error("confirm_shift: missing schedule_shift_id");
    const url = `${getWebApiBase()}/api/mobile/shifts/${schedule_shift_id}/confirm`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`confirm_shift BFF ${res.status}: ${text || res.statusText}`);
    }
  },
```

- [ ] **Step 13.7: Replace `confirm_hours` (line 122-128)**

Schema field is `approval_id`:

```typescript
  confirm_hours: async (p) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot confirm hours via BFF");
    const { approval_id } = p as { approval_id: string };
    if (!approval_id) throw new Error("confirm_hours: missing approval_id");
    const url = `${getWebApiBase()}/api/mobile/shift-approvals/${approval_id}/confirm`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`confirm_hours BFF ${res.status}: ${text || res.statusText}`);
    }
  },
```

- [ ] **Step 13.8: Verify zero direct mutations remain on 3 tables**

```bash
grep -nE 'supabase\.from\("(session_task|schedule_shift|shift_approval)"\)\.update' apps/mobile/src/lib/sync/action-map.ts
```

Expected: empty.

- [ ] **Step 13.9: Typecheck mobile**

```bash
pnpm --filter @smartout/mobile typecheck
```

- [ ] **Step 13.10: Commit**

```bash
git add apps/mobile/src/lib/sync/action-map.ts
git commit -m "$(cat <<'EOF'
feat(mobile): BFF-wrap 5 direct-mutation handlers

Routes complete_task (session_task.id), complete_checkpoint (task_id),
sign_checklist (task_ids loop), confirm_shift (schedule_shift_id),
confirm_hours (approval_id) through Bearer-auth BFF endpoints.

Each handler:
- Uses schema's canonical PK field name (NOT generic 'id')
- Sends empty {} body — identity server-derived per ADR-0151
- Surfaces non-2xx as sync-queue retry-eligible error

Zero direct .from(...).update(...) remain for session_task,
schedule_shift, shift_approval in mobile.

Refs: ADR-0099, ADR-0132, ADR-0134, ADR-0151, ADR-0287, ADR-0298.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Personal capability entity_type fix

### Task 14: Fix personal/tools.ts:192

**Files:**
- Modify: `packages/ai/src/capabilities/personal/tools.ts:192`

- [ ] **Step 14.1: Read context**

```bash
sed -n '180,210p' packages/ai/src/capabilities/personal/tools.ts
```

- [ ] **Step 14.2: Edit entity_type value + remove "closest" comment**

Use Edit tool. Find:
```typescript
        entity: {
          entity_type: "session_task",  // closest entity_type in registry
          entity_id: data.id,
```

Replace with:
```typescript
        entity: {
          entity_type: "personal_task",
          entity_id: data.id,
```

- [ ] **Step 14.3: Typecheck**

```bash
pnpm --filter @smartout/ai typecheck
```

EntityType union now accepts `"personal_task"` per Task 1.

- [ ] **Step 14.4: Commit**

```bash
git add packages/ai/src/capabilities/personal/tools.ts
git commit -m "$(cat <<'EOF'
fix(personal): create_task emit entity_type personal_task

EntityType union now includes personal_task (Task 1 of Sortie 1).
Closes L-0064 + L-0176 drift for personal.task_created.

Note residual debt: personal/tools.ts:121, 314, 468 also emit
incorrect entity_type ("agent_session" for engine_memory /
engine_delayed_trigger writes). Tracked in HANDOFF for Sortie B.

Refs: ADR-0298 §3.6, L-0064.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 — Orphan route deletion

### Task 15: Delete 2 orphan routes + layout cleanup

**Files:**
- Delete: `apps/mobile/app/(app)/(me)/tasks/[id].tsx`
- Delete: `apps/mobile/app/(app)/(home)/create-task.tsx`
- Modify: `apps/mobile/app/(app)/(me)/_layout.tsx` (remove Stack.Screen)
- Modify: `apps/mobile/app/(app)/(home)/operations.tsx:193` (replace router.push with TODO)

- [ ] **Step 15.1: Verify zero callers**

```bash
grep -rn 'router\.push.*tasks/\|router\.push.*create-task' apps/mobile/ 2>/dev/null
```

Expected: only the operations.tsx:193 hit (to be replaced).

- [ ] **Step 15.2: Read operations.tsx context**

```bash
sed -n '185,210p' apps/mobile/app/\(app\)/\(home\)/operations.tsx
```

- [ ] **Step 15.3: Replace router.push call with TODO**

Use Edit tool. Find:
```tsx
            router.push("/(app)/(home)/create-task");
```

Replace with:
```tsx
            // TODO ADR-0298 Sortie 4: replace with AddSheet trigger when FAB → AddSheet wired.
            // Route removed in Sortie 1 — (home) is href:null per ADR-0268.
            console.warn("operations.tsx: task-create entry pending Sortie 4 AddSheet wiring");
```

- [ ] **Step 15.4: Read me-layout**

```bash
cat apps/mobile/app/\(app\)/\(me\)/_layout.tsx
```

Find the `<Stack.Screen name="tasks/[id]" ... />` line.

- [ ] **Step 15.5: Remove Stack.Screen registration**

Edit `apps/mobile/app/(app)/(me)/_layout.tsx`. Delete the line declaring `tasks/[id]` screen.

- [ ] **Step 15.6: Delete files**

```bash
git rm apps/mobile/app/\(app\)/\(me\)/tasks/\[id\].tsx
git rm apps/mobile/app/\(app\)/\(home\)/create-task.tsx
rmdir apps/mobile/app/\(app\)/\(me\)/tasks 2>/dev/null || true
```

- [ ] **Step 15.7: Typecheck**

```bash
pnpm --filter @smartout/mobile typecheck
```

Expected: 0 errors.

- [ ] **Step 15.8: Commit**

```bash
git add apps/mobile/app/\(app\)/\(me\)/_layout.tsx \
        apps/mobile/app/\(app\)/\(home\)/operations.tsx
git commit -m "$(cat <<'EOF'
chore(mobile): delete 2 orphan task routes

Removed:
- apps/mobile/app/(app)/(me)/tasks/[id].tsx (zero callers, direct
  Supabase update bypassing gate+emit per Mobile Oppgaver Council
  2026-05-12)
- apps/mobile/app/(app)/(home)/create-task.tsx (only callable from
  (home)/operations.tsx which is href:null per ADR-0268)

Stack.Screen registration removed from (me)/_layout.tsx.
operations.tsx:193 router.push replaced with TODO pointing to
Sortie 4 AddSheet wiring (ADR-0298 §3.8).

Refs: ADR-0268, ADR-0298 Spec §4.10, design_handoff_calendar/source/screens.jsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 10 — Doc-drift fixes (3)

### Task 16: 3 doc edits + commit

**Files:**
- Modify: `docs/journeys/JOURNEY-mobile-addsheet-task-bff-wrap.md` (frontmatter)
- Modify: `apps/mobile/src/components/ai/BotssonSheet.tsx` (3 docstring lines)
- Modify: `docs/decisions/0283-task-mobile-bff-wrap.md` (frontmatter)
- Modify: `docs/decisions/0000-decision-log.md` (ADR-0283 row status)

- [ ] **Step 16.1: Update JOURNEY status verified → deferred**

Edit `docs/journeys/JOURNEY-mobile-addsheet-task-bff-wrap.md`:
- Change `status: verified` → `status: deferred`
- Update `updated: 2026-05-13`
- After frontmatter closing `---`, prepend note:

```markdown
> **Status note (2026-05-13, ADR-0298 Sortie 1):** AddSheet component exists in code (`apps/mobile/src/components/calendar/AddSheet.tsx`, 897 lines) but is NOT mounted to FAB (FAB opens BotssonSheet). Wiring scheduled for Sortie 4 (`feat/mobile-kalender-task-wire`) per ADR-0298. Status flipped from `verified` to `deferred`.
```

- [ ] **Step 16.2: Replace Ultravox in BotssonSheet docstring**

```bash
grep -n "Ultravox" apps/mobile/src/components/ai/BotssonSheet.tsx
```

Expected: 3 hits. Edit each:
- `"Voice session powered by Ultravox WebRTC"` → `"Voice session powered by LiveKit (per ADR-0282)"`
- `"Ultravox WebRTC integration will populate it"` → `"LiveKit integration will populate it"`
- `"the real Ultravox session"` → `"the LiveKit session"`

- [ ] **Step 16.3: Flip ADR-0283 to accepted**

Edit `docs/decisions/0283-task-mobile-bff-wrap.md` frontmatter:
- `status: proposed` → `status: accepted`
- Add: `accepted: 2026-05-13 (alongside ADR-0298 Sortie 1 — implementation already shipped 2026-05-04, governance gap closed)`
- `updated: 2026-05-13`

- [ ] **Step 16.4: Update decision-log row**

Edit `docs/decisions/0000-decision-log.md`. Find ADR-0283 row, change trailing `proposed` to `accepted`.

- [ ] **Step 16.5: Verify edits survived (per CLAUDE.md Verification After Lint/Formatter)**

```bash
grep -E "status:.*deferred" docs/journeys/JOURNEY-mobile-addsheet-task-bff-wrap.md
grep -c "Ultravox" apps/mobile/src/components/ai/BotssonSheet.tsx
grep "status: accepted" docs/decisions/0283-task-mobile-bff-wrap.md
```

Expected: 1 hit / 0 / 1 hit.

- [ ] **Step 16.6: Commit**

```bash
git add docs/journeys/JOURNEY-mobile-addsheet-task-bff-wrap.md \
        apps/mobile/src/components/ai/BotssonSheet.tsx \
        docs/decisions/0283-task-mobile-bff-wrap.md \
        docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs: close 3 doc-drift surfaces flagged by Mobile Oppgaver Council

1. JOURNEY-mobile-addsheet status verified→deferred (AddSheet
   built but not FAB-wired; Sortie 4 ships wiring per ADR-0298).
2. BotssonSheet docstring 3× Ultravox → LiveKit (ADR-0282).
3. ADR-0283 proposed → accepted (impl shipped 2026-05-04).

Closes ADR-0298 §3.9 Sortie 1 spec §4.11.

Refs: ADR-0282, ADR-0283, ADR-0298.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 11 — E2E (3 happy-paths)

### Task 17: Write 3 Playwright E2E

**Files:**
- Create: `apps/e2e/tests/sortie-1-mobile-task-complete.spec.ts`
- Create: `apps/e2e/tests/sortie-1-mobile-shift-confirm.spec.ts`
- Create: `apps/e2e/tests/sortie-1-mobile-hours-confirm.spec.ts`

Each spec covers: happy path (200 + DB row + telemetry verify) + forgeable body returns 422 + missing Bearer returns 401.

- [ ] **Step 17.1: Read existing E2E reference**

```bash
ls apps/e2e/tests/ | grep -E "session-task|mobile-task" | head
ls apps/e2e/helpers/ | head -10
```

Pick closest reference (e.g. `journey-shift-session-spine.spec.ts` or `operations-harness-e2e.spec.ts`). Read first 80 lines for shape.

- [ ] **Step 17.2: Write task-complete spec**

Adapt to existing helper conventions. If a `mobileTaskApiSeed` helper exists, use it. Otherwise inline a minimal seeder.

```typescript
import { test, expect } from "@playwright/test";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3060";

test.describe("Sortie 1: mobile task complete", () => {
  test("PATCH with valid Bearer succeeds + emits", async ({ request }) => {
    // Setup: seed a session_task assigned to a test profile, capture Bearer.
    // Use existing operations-harness pattern OR inline supabaseAdmin seed.
    // Adapt based on Step 17.1 findings.
    const { taskId, bearerToken, workspaceId, profileId } = await seedSessionTask();

    const response = await request.patch(`${WEB_URL}/api/mobile/tasks/${taskId}/complete`, {
      headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.taskId).toBe(taskId);

    // Verify DB
    const row = await fetchSessionTask(taskId);
    expect(row.status).toBe("completed");
    expect(row.completed_by).toBe(profileId);

    // Verify telemetry
    await expectActivityTrailRow({
      workspace_id: workspaceId,
      actor_id: profileId,
      entity_id: taskId,
      entity_type: "session_task",
    });
  });

  test("PATCH with forbidden body field returns 422", async ({ request }) => {
    const { taskId, bearerToken } = await seedSessionTask();
    const response = await request.patch(`${WEB_URL}/api/mobile/tasks/${taskId}/complete`, {
      headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
      data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD" },
    });
    expect(response.status()).toBe(422);
    const row = await fetchSessionTask(taskId);
    expect(row.status).not.toBe("completed");
  });

  test("PATCH without Bearer returns 401", async ({ request }) => {
    const { taskId } = await seedSessionTask();
    const response = await request.patch(`${WEB_URL}/api/mobile/tasks/${taskId}/complete`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});

// Helper stubs — adapt to existing apps/e2e/helpers/ patterns. If no
// reusable helper exists, implement inline using @smartout/supabase admin.
async function seedSessionTask(): Promise<{ taskId: string; bearerToken: string; workspaceId: string; profileId: string }> {
  throw new Error("Implement per apps/e2e/helpers/ convention discovered in Step 17.1");
}
async function fetchSessionTask(taskId: string): Promise<{ status: string; completed_by: string | null }> {
  throw new Error("Implement");
}
async function expectActivityTrailRow(_args: { workspace_id: string; actor_id: string; entity_id: string; entity_type: string }): Promise<void> {
  throw new Error("Implement");
}
```

- [ ] **Step 17.3: Replace stub helpers**

Run Step 17.1 grep again, find the canonical seeder pattern, replace the three stub functions with real implementations following the existing convention.

- [ ] **Step 17.4: Write shift-confirm + hours-confirm specs**

Mirror Task 17.2 with substitutions:
- URL: `/api/mobile/shifts/{id}/confirm` and `/api/mobile/shift-approvals/{id}/confirm`
- Seeder: `seedScheduleShift` and `seedShiftApproval`
- DB verify: `confirmed_by` (shift) and `approved_by + status='approved'` (approval)
- Telemetry: `event="shift confirmed", entity_type="schedule_shift"` and `event="hours confirmed", entity_type="shift_approval"`

- [ ] **Step 17.5: Run all 3**

```bash
pnpm --filter @smartout/e2e test apps/e2e/tests/sortie-1-*.spec.ts
```

Expected: 9 tests PASS (3 per spec).

- [ ] **Step 17.6: Commit**

```bash
git add apps/e2e/tests/sortie-1-*.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): Sortie 1 happy-path coverage for 3 BFF routes

Per BFF: happy (Bearer + DB + telemetry) + forgeable body 422 +
no-Bearer 401. 9 tests total.

Closes ADR-0298 Sortie 1 acceptance criterion #12.

Refs: ADR-0298 Spec §7.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 12 — Pre-merge verification

### Task 18: Global checks

- [ ] **Step 18.1: Full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 18.2: Full lint**

```bash
pnpm turbo lint
```

Expected: 0 errors.

- [ ] **Step 18.3: Self-check greps**

```bash
# Catchall reduced
grep -c "catchall(z.unknown())" apps/mobile/src/lib/sync/schemas.ts
# Expected: 11 (14 - 3 conversions)

# Zero direct mutations on 3 tables
grep -nE 'supabase\.from\("(session_task|schedule_shift|shift_approval)"\)\.update' apps/mobile/src/lib/sync/action-map.ts
# Expected: empty

# Entity_type fixed
grep -n 'entity_type: "personal_task"' packages/ai/src/capabilities/personal/tools.ts
# Expected: 1 hit ~line 192

# Ultravox gone
grep -c "Ultravox" apps/mobile/src/components/ai/BotssonSheet.tsx
# Expected: 0

# Orphans deleted
ls apps/mobile/app/\(app\)/\(me\)/tasks/\[id\].tsx 2>&1 | grep -q "No such" && echo OK1
ls apps/mobile/app/\(app\)/\(home\)/create-task.tsx 2>&1 | grep -q "No such" && echo OK2

# Migrations applied
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT policyname, with_check IS NOT NULL FROM pg_policies WHERE tablename='session_task' AND policyname='jwt_update_session_task';"
# Expected: 1 row, t

# Gate seeds present
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT capability FROM public.engine_authority_config WHERE capability IN ('task.complete_session_task','schedule.confirm_shift','timesheet.confirm_hours') ORDER BY capability;"
# Expected: 3 distinct capabilities × workspace count
```

- [ ] **Step 18.4: Run all vitest**

```bash
pnpm --filter web vitest run apps/web/src/app/dashboard/_actions/__tests__/
```

Expected: all PASS.

- [ ] **Step 18.5: Manual PWA smoke**

```bash
pnpm --filter @smartout/mobile dev
```

Open PWA at `localhost:8083` (per memory `feedback_mobile_pwa_for_testing.md` — NEVER Expo Go / iOS simulator). Sign in as test employee with assigned session_task. Tap complete. Verify:
- UI shows completed
- DB updated (re-run grep from Step 18.3)
- activity_trail row exists

---

## Phase 13 — Closure deliverables

### Task 19: Write ADR-0299

**Files:**
- Create: `docs/decisions/0299-mobile-session-task-defense-close.md`

- [ ] **Step 19.1: Verify slot free**

```bash
git log --all --name-only 2>/dev/null | grep "docs/decisions/0299-" | sort -u
```

Expected: empty (this branch's file only).

- [ ] **Step 19.2: Write ADR**

Create per CLAUDE.md ADR template. Title "Sortie 1 Close — Mobile Session-Task Defense". Status accepted. Content covers what shipped, decisions made (R9 delegation pattern verified, R10 hard-cut acknowledged but not needed in Sortie 1, EntityType extension landed safely), consequences (Sortie 2 unblocked, Sortie A + B residual), cross-references all ADRs touched.

- [ ] **Step 19.3: Register in decision-log**

Edit `docs/decisions/0000-decision-log.md`. Insert new row above ADR-0298.

### Task 20: Write L-0236 + L-0237 learning stubs

**Files:**
- Create: `docs/learnings/0236-catchall-z-unknown-forgeable-identity.md`
- Create: `docs/learnings/0237-steward-must-spawn-code-tracer-before-plan-ready.md`

- [ ] **Step 20.1: Verify slots free**

```bash
git log --all --name-only 2>/dev/null | grep -E "docs/learnings/(0236|0237)-" | sort -u
```

Expected: empty.

- [ ] **Step 20.2: Write L-0236**

`.catchall(z.unknown())` accepts forgeable identity fields. Pattern, detection, closure (5 of 14 in Sortie 1, 9 in Sortie B). Sibling to L-0177.

- [ ] **Step 20.3: Write L-0237**

Steward Phase 3 must SPAWN code-tracer subagent before plan-ready verdict (7th L-0147 precedent — in-line grep failed 7 times, out-of-line dispatch is mandatory).

### Task 21: HANDOFF

**Files:**
- Create: `docs/HANDOFF-mobile-session-task-defense.md`

Per CLAUDE.md feature-closure standard. Include: summary, decisions registered (ADR-0298, ADR-0299, ADR-0283 flip), learnings (L-0236, L-0237), known issues (Sortie A + B scope, 3 other personal-tool entity_type drift, `tasks_completed` counter gap), next steps (Sortie 2 unblocked), verification status.

### Task 22: User journey

**Files:**
- Create: `docs/journeys/JOURNEY-mobile-session-task-defense.md`

Cover: employee completes task, employee confirms shift, employee confirms hours, attacker forgery attempt rejected at 3 layers (Zod + identity-derivation + RLS).

### Task 23: Update BOTSSON-SYSTEM-MAP.md (per Harness G1)

**Files:**
- Modify: `docs/architecture/BOTSSON-SYSTEM-MAP.md`

- [ ] **Step 23.1: Check if file exists**

```bash
ls docs/architecture/BOTSSON-SYSTEM-MAP.md 2>&1
```

If missing, skip (not blocking).

- [ ] **Step 23.2: If exists, add to L2 BFF section**

Add 3 new rows for the 3 BFF routes. Add note to L4 personal capability row: "entity_type bug for create_task fixed Sortie 1 2026-05-13; 3 other tools (add_note, set_reminder, update_setting) still drift — Sortie B."

### Task 24: Update STATE-SUMMARY.md (per Steward §6)

**Files:**
- Modify: `docs/STATE-SUMMARY.md`

- [ ] **Step 24.1: Check existence**

```bash
ls docs/STATE-SUMMARY.md 2>&1
```

If missing, skip.

- [ ] **Step 24.2: Bump active-work section**

Move "Sortie 1: Mobile Session-Task Defense" from active to recently-closed. Add "Sortie 2: Task RPC Read-Path" as next active.

### Task 25: Commit Phase 13 closure

- [ ] **Step 25.1: Commit all closure artifacts**

```bash
git add docs/decisions/0299-mobile-session-task-defense-close.md \
        docs/decisions/0000-decision-log.md \
        docs/learnings/0236-catchall-z-unknown-forgeable-identity.md \
        docs/learnings/0237-steward-must-spawn-code-tracer-before-plan-ready.md \
        docs/HANDOFF-mobile-session-task-defense.md \
        docs/journeys/JOURNEY-mobile-session-task-defense.md
# Optional (skip if missing):
git add docs/architecture/BOTSSON-SYSTEM-MAP.md 2>/dev/null || true
git add docs/STATE-SUMMARY.md 2>/dev/null || true
git status --short
git commit -m "$(cat <<'EOF'
docs: ADR-0299 + L-0236 + L-0237 + HANDOFF + journey (Sortie 1 close)

Closure deliverables per CLAUDE.md feature-closure standard:
- ADR-0299 — Sortie 1 close (defense surface shut)
- L-0236 — .catchall(z.unknown()) forgeable-identity class-bug
- L-0237 — Steward must spawn code-tracer before plan-ready
  (7th L-0147 precedent — promoted from in-line grep insufficiency)
- HANDOFF-mobile-session-task-defense.md
- JOURNEY-mobile-session-task-defense.md
- BOTSSON-SYSTEM-MAP.md updated (if present)
- STATE-SUMMARY.md bumped (if present)

Sortie 1 ready for /close-feature merge to development.

Refs: ADR-0298, ADR-0299, L-0147, L-0177.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 26: Run /close-feature

- [ ] **Step 26.1: Final pre-flight**

```bash
git status   # clean
git log --oneline -25
pnpm turbo typecheck
pnpm turbo lint
```

- [ ] **Step 26.2: Invoke /close-feature**

In Claude Code:
```
/close-feature
```

Skill walks close-feature.sh — verifies decisions, journeys, typecheck, merges feat/mobile-session-task-defense → development, pushes, removes worktree. Confirm with Pontus before merge.

---

## Self-Review (per writing-plans skill)

### 1. Spec coverage

| Spec section | Task | Status |
|---|---|---|
| §3 verified patterns (canonical reality) | Pre-flight P.9 enforces verification | ✓ |
| §4.1 3 BFF routes | Tasks 9, 10, 11 | ✓ |
| §4.2 resolveMobileActor extraction | Task 5 | ✓ |
| §4.3 3 Server Actions with correct gateAction signature | Tasks 6, 7, 8 | ✓ |
| §4.4 5 action-map handlers + correct schema field names | Task 13 | ✓ |
| §4.5 5 Zod schemas tightened | Task 12 | ✓ |
| §4.6 session_task RLS WITH CHECK with NULL-tolerance + 2-arg admin | Task 2 | ✓ |
| §4.7 3 gate-action seeds with correct columns + UNIQUE | Task 3 | ✓ |
| §4.8 EntityType + 2 new events + EVENT_ROUTING | Task 1 | ✓ |
| §4.9 entity_type fix | Task 14 | ✓ |
| §4.10 2 orphan routes deleted | Task 15 | ✓ |
| §4.11 3 doc-drift fixes | Task 16 | ✓ |
| §6 error handling | Tasks 6, 7, 8 implementations | ✓ |
| §7 testing | Tasks 6.2, 7.1, 8.1, 17 | ✓ |
| §10 acceptance criteria | Task 18 self-checks + Phase 13 closure | ✓ |

### 2. Placeholder scan

- "TODO" in Task 15.3 (intentional — comment in operations.tsx pointing to Sortie 4)
- "Implement per apps/e2e/helpers/ convention discovered in Step 17.1" — placeholder in Task 17.2 stub. NOT a plan failure — Step 17.1 explicitly instructs the agent to discover the convention. Build-agent has clear instruction: "Run Step 17.1 grep again, find the canonical seeder pattern, replace the three stub functions with real implementations."
- No "TBD" / "fill in details" / "Add appropriate error handling"

### 3. Type consistency

- `ResolvedActor` imported consistently from `@/app/api/mobile/_shared/actor` after Task 5 extraction
- `gateAction` imported from `./_shared` in all 3 Server Actions
- Return shapes: `{ ok: true; taskId: string } | { ok: false; error: string }` consistent across 3 Server Actions
- Event names: `"session_task completed"`, `"shift confirmed"`, `"hours confirmed"` consistent between registry, Server Actions, and E2E
- Capability slugs: `"task.complete_session_task"`, `"schedule.confirm_shift"`, `"timesheet.confirm_hours"` consistent between seed migration + gate calls + tests
- Entity_type strings: `"session_task"`, `"schedule_shift"`, `"shift_approval"`, `"personal_task"` consistent
- PK column names: `id` (session_task), `schedule_shift_id`, `approval_id` — consistent across Server Actions + Zod schemas + action-map handlers

---

## Plan v2 — Council corrections summary

| Council finding | Resolution in plan |
|---|---|
| B1 gateAction import wrong | Task 6.4 imports from `./_shared` |
| B2 gateAction signature wrong | All 3 Server Actions use `actorProfileId`, `.allow`, dotted-slug |
| B3 engine_authority_config schema wrong | Task 3 uses correct columns + UNIQUE pattern |
| B4 schedule_shift PK wrong | Task 7.3 uses `schedule_shift_id`, Task 13.6 same |
| B5 shift_approval columns wrong | Task 8.3 uses `approval_id`, `approved_at`, `approved_by`, JOIN via shift_id |
| B6 shift_approval employee_profile_id missing | Task 8.3 uses JOIN through shift_id → schedule_shift.employee_id |
| B7 test mocks wrong | All test mocks use `actorProfileId` + `.allow` |
| B8 migration tip stale | Pre-flight P.8 verifies + adapts |
| is_admin_in_workspace 1-arg | Task 2.2 uses 2-arg signature |
| RLS breaks unassigned pickup | Task 2.2 adds `OR assigned_to IS NULL` |
| tasks_completed counter coupling | Documented in spec §3.10 as pre-existing gap; NOT Sortie 1 fix |
| Phantom telemetry events | Task 1 registers 2 new + reuses existing for task |
| Spec file missing | Re-written 2026-05-13, plan refs correct path |
| signChecklist/completeCheckpoint no catchall | Task 12 handles bare-object case separately |
| sign_checklist payload shape | Task 13.5 uses `task_ids: string[]` array |
| Schema field names not `id` | Task 13 destructures correct field per schema |
| EntityType already-present check | Task 1.1 grep before adding |
| Learning slot collision | L-0236 + L-0237 (verified free, not 0237/0238) |
| BOTSSON-SYSTEM-MAP missed | Task 23 adds (if file exists) |
| STATE-SUMMARY missed | Task 24 adds (if file exists) |
| resolveMobileActor triplicated | Task 5 extracts to shared module |
| UUID regex loose | Task 9 uses `z.string().uuid()` |
| Other 3 personal tools entity_type drift | Documented in HANDOFF + Sortie B |
| emit entity_label missing | Task 6.4 includes `entity_label: row.title` |
| ADR-0186 cross-ref missing | Spec §11 includes ADR-0186 |

All 14 council findings resolved or explicitly deferred.

---

## Execution

**File saved:** `docs/superpowers/plans/2026-05-13-sortie-1-session-task-defense.md`

**Execution choice:**

1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks. Requires `superpowers:subagent-driven-development` skill.

2. **Inline Execution** — Batch with checkpoints. Requires `superpowers:executing-plans` skill.
