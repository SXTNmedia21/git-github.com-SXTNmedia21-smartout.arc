# Day_line → Shift Tasks (A-ANCHOR + status-gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every location-anchored task — including cron/hook-spawned ones — appear in the assigned employee's mobile shift view only when their shift operates at that location and is active.

**Architecture:** EXTEND-EXISTING (verified in [FINDINGS-dayline-shift-tasks.md](../../modules/task-manager/FINDINGS-dayline-shift-tasks.md)). The receiver pipe (`use-shift-session` + `useDayLineItems` + `task.complete`) already ships. Two gaps remain: (1) **A-ANCHOR** — server-side inserts of `session_task` set `day_line_id` via a tiny SQL helper that mirrors the single-location join already in `ensure_shift_session()`; (2) **status-gate** — mobile only shows day_line tasks when `shift_session.status ∈ {scheduled, clocked_in}`, reusing the already-typed status field. No new resolver/read surface (`fn_list_shift_tasks` was dropped by council — redundant).

**Tech Stack:** Supabase Postgres 17 (SQL functions, pgTAP), Deno Edge Functions (`session-hook-executor`, `engine-dispatch`), React Native + Expo + TanStack Query, Vitest (mobile unit tests).

**Branch:** sub-sortie of `campaign/daily-operation` (`/start-feature task-dayline-anchor`). Supabase Local must be running. Build dist: `pnpm --filter @smartout/ai build`.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `supabase/migrations/<ts>_fn_resolve_single_day_line.sql` | Tiny SECURITY DEFINER helper: single day_line for a department_session, else NULL | Create |
| `supabase/tests/dayline-anchor.spec.sql` | pgTAP for the helper (0/1/N day_lines) | Create |
| `supabase/functions/session-hook-executor/index.ts:161-169` | Set `day_line_id` on hook-spawned `session_task` | Modify |
| `supabase/functions/engine-dispatch/index.ts:787-804` | Set `day_line_id` in `assign_task` insert | Modify |
| `supabase/functions/engine-dispatch/index.ts:2146-2170` | Set `day_line_id` in `create_session_task` insert | Modify |
| `apps/mobile/src/lib/shift-task-visibility.ts` | Pure helper `isShiftActiveForTasks(status)` | Create |
| `apps/mobile/src/lib/__tests__/shift-task-visibility.test.ts` | Vitest for the helper | Create |
| `apps/mobile/src/components/HomeShiftCard.tsx:63-87` | Gate `useDayLineItems` on shift status | Modify |
| `supabase/tests/dayline-shift-visibility.spec.sql` | Integration: active/inactive/second-location | Create |

---

## Task 1: SQL helper `fn_resolve_single_day_line`

Mirrors the `(department_session_id) → day_line` resolution already embedded in `ensure_shift_session()` (`20260620130000:65-70`) and `20260620120700_day_line_backfill.sql`. Single helper (DRY) instead of inlining the query in 3 Edge Functions.

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_fn_resolve_single_day_line.sql` (TIMESTAMP strictly greater than current max — run `ls supabase/migrations/ | sort | tail -1` and pick a larger value, e.g. tip+`000100`)
- Test: `supabase/tests/dayline-anchor.spec.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/dayline-anchor.spec.sql`:

```sql
BEGIN;
SELECT plan(3);

-- Fixtures: a workspace, two locations, one department_session.
-- Reuse seed identity (CLAUDE.md): workspace b0000000-...-0.
\set ws '''b0000000-0000-0000-0000-000000000000'''
INSERT INTO public.department (department_id, workspace_id, name)
  VALUES ('d1000000-0000-0000-0000-000000000001', :ws, 'TestDept')
  ON CONFLICT DO NOTHING;
INSERT INTO public.location (location_id, workspace_id, name)
  VALUES ('10c00000-0000-0000-0000-000000000001', :ws, 'Bar'),
         ('10c00000-0000-0000-0000-000000000002', :ws, 'Kitchen')
  ON CONFLICT DO NOTHING;
INSERT INTO public.department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES ('5e550000-0000-0000-0000-000000000001', :ws, 'd1000000-0000-0000-0000-000000000001', CURRENT_DATE, 'upcoming')
  ON CONFLICT DO NOTHING;

-- Case 0 day_lines → NULL
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  NULL,
  'zero day_lines returns NULL'
);

-- Case 1 day_line → that id
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES ('da110000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000001',
          'd1000000-0000-0000-0000-000000000001', '10c00000-0000-0000-0000-000000000001', CURRENT_DATE, '08:00', '23:00');
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  'da110000-0000-0000-0000-000000000001'::uuid,
  'one day_line returns its id'
);

-- Case 2 day_lines → NULL (ambiguous, don't guess)
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES ('da110000-0000-0000-0000-000000000002', :ws, '5e550000-0000-0000-0000-000000000001',
          'd1000000-0000-0000-0000-000000000001', '10c00000-0000-0000-0000-000000000002', CURRENT_DATE, '08:00', '23:00');
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  NULL,
  'multiple day_lines returns NULL (no guess)'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase test db --file supabase/tests/dayline-anchor.spec.sql` (or the repo's pgTAP runner — check `supabase/tests/` for the existing invocation pattern, e.g. `sortie-3-task-capability.spec.sql`).
Expected: FAIL — `function public.fn_resolve_single_day_line(uuid) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/<TIMESTAMP>_fn_resolve_single_day_line.sql`:

```sql
-- Resolve the single day_line for a department_session.
-- Returns the day_line_id when the session has EXACTLY ONE day_line;
-- NULL when zero (no anchor yet) or many (ambiguous — never guess, per ADR-0367 + council Q-C).
-- Mirrors the (department_session_id, location_id) -> day_line resolution in
-- ensure_shift_session() (20260620130000) without re-inlining it across Edge Functions.
CREATE OR REPLACE FUNCTION public.fn_resolve_single_day_line(p_department_session_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dl.day_line_id
  FROM public.day_line dl
  WHERE dl.department_session_id = p_department_session_id
    AND dl.cancelled_at IS NULL
  GROUP BY dl.day_line_id
  HAVING (SELECT count(*) FROM public.day_line d2
          WHERE d2.department_session_id = p_department_session_id
            AND d2.cancelled_at IS NULL) = 1;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_single_day_line(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_resolve_single_day_line(uuid) TO service_role;
```

- [ ] **Step 4: Apply migration + run test to verify it passes**

Run: `npx supabase migration up` (local; NO `op run` wrap — L:op-run-corrupts-gen-types), then re-run the pgTAP file.
Expected: PASS — `ok 1 / ok 2 / ok 3`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_fn_resolve_single_day_line.sql supabase/tests/dayline-anchor.spec.sql
git commit -m "feat(task-manager): fn_resolve_single_day_line helper (single-location attach)"
```

---

## Task 2: `session-hook-executor` sets `day_line_id`

**Files:**
- Modify: `supabase/functions/session-hook-executor/index.ts:161-169` (the `session_task` insert)
- Test: extend `supabase/tests/dayline-shift-visibility.spec.sql` (Task 6) — verified at integration; here add an inline executor-path check.

- [ ] **Step 1: Read the current insert block**

Run: `sed -n '150,175p' supabase/functions/session-hook-executor/index.ts`
Expected: an `await supabase.from("session_task").insert({ workspace_id, department_session_id, session_hook_id, title, description, status, is_compliance_required })` — NO `day_line_id`.

- [ ] **Step 2: Resolve day_line_id before the insert**

Above the insert (after the loop has `state`/`hook` with `department_session_id` in scope), add:

```ts
// A-ANCHOR (ADR-0367): anchor hook-spawned tasks to the session's single day_line.
// NULL when 0 or >1 day_lines (don't guess) — task stays department-level.
const { data: anchoredDayLineId } = await supabase.rpc("fn_resolve_single_day_line", {
  p_department_session_id: departmentSessionId, // the var already used in the insert
});
```

(Use the exact existing variable name for the session id — read it from the insert block; do not rename.)

- [ ] **Step 3: Add `day_line_id` to the insert object**

In the `.insert({ ... })` payload add the field:

```ts
  day_line_id: anchoredDayLineId ?? null,
```

- [ ] **Step 4: Verify it compiles (Deno check)**

Run: `deno check supabase/functions/session-hook-executor/index.ts` (or the repo's EF check — see `supabase/functions/` tooling).
Expected: no type errors. `rpc` returns `{ data: string | null }`; `?? null` keeps it nullable-safe.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/session-hook-executor/index.ts
git commit -m "feat(task-manager): hook-executor anchors session_task to single day_line"
```

---

## Task 3: `engine-dispatch` sets `day_line_id` (both insert sites)

**Files:**
- Modify: `supabase/functions/engine-dispatch/index.ts:787-804` (`assign_task`)
- Modify: `supabase/functions/engine-dispatch/index.ts:2146-2170` (`create_session_task`)

- [ ] **Step 1: Read both insert blocks**

Run: `sed -n '787,804p;2146,2170p' supabase/functions/engine-dispatch/index.ts`
Expected: two `session_task` inserts (one in `assign_task`, one in `create_session_task`), both with `department_session_id` (the `assign_task` one uses `state.entity_id` when `state.entity_type === "department_session"`), neither with `day_line_id`.

- [ ] **Step 2: assign_task — resolve + set day_line_id**

In the `assign_task` handler, inside the `if (state.entity_type === "department_session" && state.entity_id)` block, before the insert, add:

```ts
const { data: anchoredDayLineId } = await supabase.rpc("fn_resolve_single_day_line", {
  p_department_session_id: state.entity_id as string,
});
```

Add to the `.insert({ ... })` payload:

```ts
  day_line_id: (anchoredDayLineId as string | null) ?? null,
```

- [ ] **Step 3: create_session_task — resolve + set day_line_id**

In `create_session_task` (line ~2146), identify the department_session id variable used in its insert (read it). Before the insert add the same `rpc("fn_resolve_single_day_line", { p_department_session_id: <that var> })` call, and add `day_line_id: anchoredDayLineId ?? null` to the payload.

- [ ] **Step 4: Verify compiles**

Run: `deno check supabase/functions/engine-dispatch/index.ts`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "feat(task-manager): engine-dispatch anchors session_task to single day_line"
```

---

## Task 4: Mobile helper `isShiftActiveForTasks`

Pure function — the status gate. Reuses the existing `shift_session.status` union; does NOT use `shift-phase.ts` (time-entry signal, wrong per FINDINGS §2).

**Files:**
- Create: `apps/mobile/src/lib/shift-task-visibility.ts`
- Test: `apps/mobile/src/lib/__tests__/shift-task-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/__tests__/shift-task-visibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isShiftActiveForTasks } from "../shift-task-visibility";

describe("isShiftActiveForTasks", () => {
  it("shows tasks for scheduled (pre-shift prep) and clocked_in", () => {
    expect(isShiftActiveForTasks("scheduled")).toBe(true);
    expect(isShiftActiveForTasks("clocked_in")).toBe(true);
  });
  it("hides tasks for clocked_out and cancelled", () => {
    expect(isShiftActiveForTasks("clocked_out")).toBe(false);
    expect(isShiftActiveForTasks("cancelled")).toBe(false);
  });
  it("hides when status undefined/null (no shift)", () => {
    expect(isShiftActiveForTasks(undefined)).toBe(false);
    expect(isShiftActiveForTasks(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @smartout/mobile test -- shift-task-visibility` (confirm the mobile test runner name from `apps/mobile/package.json`; mobile already has vitest specs e.g. `shift-phase.test.ts`).
Expected: FAIL — cannot find module `../shift-task-visibility`.

- [ ] **Step 3: Write the helper**

Create `apps/mobile/src/lib/shift-task-visibility.ts`:

```ts
/**
 * Status gate for day_line task visibility (FINDINGS §2 Gap 2, council Q-A).
 * Tasks surface for an employee whose shift is scheduled (pre-shift prep) or
 * clocked_in (working). Terminal states (clocked_out, cancelled) hide them.
 * Source signal is shift_session.status — NOT shift-phase.ts (time-entry based).
 */
export type ShiftSessionStatus =
  | "scheduled"
  | "clocked_in"
  | "clocked_out"
  | "cancelled";

const TASK_VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "clocked_in",
]);

export function isShiftActiveForTasks(
  status: ShiftSessionStatus | null | undefined,
): boolean {
  if (status == null) return false;
  return TASK_VISIBLE_STATUSES.has(status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @smartout/mobile test -- shift-task-visibility`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/shift-task-visibility.ts apps/mobile/src/lib/__tests__/shift-task-visibility.test.ts
git commit -m "feat(mobile): isShiftActiveForTasks status gate helper"
```

---

## Task 5: `HomeShiftCard` gates `useDayLineItems` on status

**Files:**
- Modify: `apps/mobile/src/components/HomeShiftCard.tsx:63-87`

- [ ] **Step 1: Read the current hook wiring**

Run: `sed -n '60,90p' apps/mobile/src/components/HomeShiftCard.tsx`
Expected: `const session = useShiftSession(...)`, `const dayLineIds = (session?.day_lines ?? []).map(...)`, `const shiftSessionId = session?.shift_session_id ?? null` (confirm exact names), then `useDayLineItems(dayLineIds, dayLineIds, shiftSessionId)`.

- [ ] **Step 2: Add the import**

At the top of the file, add:

```ts
import { isShiftActiveForTasks } from "@/lib/shift-task-visibility";
```

- [ ] **Step 3: Gate the shiftSessionId passed to the hook**

Replace the `shiftSessionId` value passed into `useDayLineItems` so the query disables (its existing `enabled: ... && shiftSessionId !== null` guard) when the shift is not active:

```ts
// Gate day_line task visibility on shift status (FINDINGS §2 Gap 2).
// When status is terminal, pass null -> useDayLineItems disables -> no tasks shown.
const gatedShiftSessionId = isShiftActiveForTasks(session?.status)
  ? (session?.shift_session_id ?? null)
  : null;

const { data: items = [] } = useDayLineItems(dayLineIds, dayLineIds, gatedShiftSessionId);
```

(Use the exact field names read in Step 1 for `status` and `shift_session_id`.)

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=3584" pnpm --filter @smartout/mobile typecheck`
Expected: 0 errors. (Constrained heap per WSL2 OOM.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/HomeShiftCard.tsx
git commit -m "feat(mobile): HomeShiftCard gates day_line tasks on shift status"
```

---

## Task 6: Integration test — visible on active shift, hidden otherwise (council merge-blocker)

Proves the end-to-end contract incl. the second-location isolation the council required.

**Files:**
- Create: `supabase/tests/dayline-shift-visibility.spec.sql`

- [ ] **Step 1: Write the failing integration test**

Create `supabase/tests/dayline-shift-visibility.spec.sql`:

```sql
BEGIN;
SELECT plan(3);
\set ws '''b0000000-0000-0000-0000-000000000000'''

-- Two locations, one dept_session, two day_lines (Bar + Kitchen).
INSERT INTO public.department (department_id, workspace_id, name)
  VALUES ('d2000000-0000-0000-0000-000000000001', :ws, 'IntDept') ON CONFLICT DO NOTHING;
INSERT INTO public.location (location_id, workspace_id, name)
  VALUES ('20c00000-0000-0000-0000-000000000001', :ws, 'Bar2'),
         ('20c00000-0000-0000-0000-000000000002', :ws, 'Kitchen2') ON CONFLICT DO NOTHING;
INSERT INTO public.department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES ('5e550000-0000-0000-0000-000000000002', :ws, 'd2000000-0000-0000-0000-000000000001', CURRENT_DATE, 'active') ON CONFLICT DO NOTHING;
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES ('da220000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', '20c00000-0000-0000-0000-000000000001', CURRENT_DATE, '08:00','23:00'),
         ('da220000-0000-0000-0000-000000000002', :ws, '5e550000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', '20c00000-0000-0000-0000-000000000002', CURRENT_DATE, '08:00','23:00');

-- A task on the Bar day_line.
INSERT INTO public.session_task (id, workspace_id, department_session_id, day_line_id, title, status)
  VALUES ('ba550000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000002', 'da220000-0000-0000-0000-000000000001', 'Sjekk kjøletemp', 'pending');

-- Assertion 1: the Bar day_line surfaces its task.
SELECT is(
  (SELECT count(*)::int FROM public.session_task st WHERE st.day_line_id = 'da220000-0000-0000-0000-000000000001'),
  1, 'Bar day_line has its task');

-- Assertion 2: the Kitchen day_line (second location) surfaces NONE of it.
SELECT is(
  (SELECT count(*)::int FROM public.session_task st WHERE st.day_line_id = 'da220000-0000-0000-0000-000000000002'),
  0, 'second-location day_line does NOT surface the Bar task');

-- Assertion 3: helper anchors a NEW task created with no day_line via the resolver = NULL (2 day_lines, ambiguous).
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000002'::uuid),
  NULL, 'two day_lines -> resolver NULL (task stays department-level)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run it**

Run: `supabase test db --file supabase/tests/dayline-shift-visibility.spec.sql`
Expected: PASS — 3 ok. (Migration from Task 1 must be applied.)

- [ ] **Step 3: Manual mobile verification (Supabase Local)**

Seed a `shift_session` for an employee at Bar (status `clocked_in`) linked via `shift_session_day_line` to `da220000-...01`. In the mobile app (or `useDayLineItems` query directly): the Bar task shows. Flip the shift_session status to `clocked_out` → `isShiftActiveForTasks` returns false → `HomeShiftCard` passes null → query disabled → task hidden. Record the observation in the journey.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/dayline-shift-visibility.spec.sql
git commit -m "test(task-manager): dayline shift-task visibility + second-location isolation"
```

---

## Final verification (before close-feature)

- [ ] `NODE_OPTIONS="--max-old-space-size=3584" TURBO_CONCURRENCY=1 pnpm turbo typecheck` — 0 errors.
- [ ] Both pgTAP files pass; mobile vitest passes.
- [ ] Regenerate types if any DB type surfaced to TS: `npx supabase gen types` (NO `op run`) → re-typecheck. (The helper returns uuid; no return-table change, so likely no regen needed — verify.)
- [ ] Guardrail: `git diff` touches only the 9 files above. No edits to `evaluateReadinessGate`, `check_readiness`, `season`, `fn_list_my_tasks`, or `list_mine` (this sortie does NOT touch the inbox read surface).
- [ ] Journeys (`/start-feature` declared): `cron-task-anchors-to-day-line`, `task-hidden-when-shift-inactive`, `second-location-task-not-shown` → flip `status: verified`.

## Out of scope (separate plan)
Full "Min dag" surface port from `taskmanager-handoff/components/min-dag.jsx` + `docs/design/day-handoff/source/day/mobile-day.jsx` (sections, day-meter, filter chips, Botsson-nudge). This plan delivers the **functional data pipe**; the prototype forside is a follow-up UI sortie.
