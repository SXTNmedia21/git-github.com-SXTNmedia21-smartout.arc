---
title: Day Line Area-Anchored Runtime Implementation Plan
status: ready
version: 1.0
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [plan, dagslinje, day-line, shift-session, parallel-teams, tri-layer-d6]
---

# Day Line Area-Anchored Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use `- [ ]` for tracking.

**Goal:** Ship ADR-0367 — tri-layer D6 (`department_session` → `day_line` → `shift_session`) with area-anchored runtime, multi-strip Dagslinje UI, mobile shift_session view, and engine-dispatch push pipeline.

**Architecture:** Schema-first (Phase A serial, 9 migrations in causal order). Capabilities + triggers + telemetry parallel (Phase B, 4 teams). Web UI + Mobile + Push parallel (Phase C/D/E, 5 teams). Docs + E2E serial close (Phase F).

**Tech Stack:** PostgreSQL 17 (Supabase Local), Next.js 16 App Router, React 19, TypeScript strict, Zod, Vitest, Playwright, shadcn/ui (new-york), React Native + Expo, Supabase Edge Functions (Deno), `@smartout/telemetry` emit(), Tailwind v4 (CSS config).

**Source spec:** `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` (v1.2, council-accepted)
**Source ADR:** `docs/decisions/0367-day-line-area-anchored-runtime.md` (status `accepted`)
**Council verdict commit:** `6b848d1c5`

---

## Parallel Team Dispatch Matrix

| Phase | Teams in parallel | Agent type | Model | Owns |
|---|---|---|---|---|
| A | 1 (serial) | botsson-harness-builder | sonnet | All 9 migrations + helper + RLS + backfill + capability seed |
| B | 4 | 3× botsson-harness-builder + 1× system-agent-coordinator | sonnet | B-T1 day-line caps; B-T2 routine+org caps + Pattern B; B-T3 triggers + counterpart; B-T4 telemetry + intent-classifier |
| C | 3 | 3× frontend-designer | sonnet | C-T1 TimelineTab multi-strip; C-T2 3 dialogs; C-T3 ScopeFilter+useDayLines+aggregate |
| D | 1 | botsson-harness-builder | sonnet | useShiftSession + day route + push subscribe + telemetry |
| E | 1 | botsson-harness-builder | sonnet | engine-dispatch handler + idempotency |
| F | 1 (serial) | system-steward then docs-tutor | sonnet | 5 journeys + 4 E2E + 8 doc updates + /audit smoke |

**Peak parallelism:** 5 teams concurrent during Phase C+D+E (after Phase B merges).

## Dependency Graph

```
        Phase A (serial, 9 tasks, 1 agent)
                  │
                  ▼
        ┌─────────┼─────────┬─────────┐
        ▼         ▼         ▼         ▼
      B-T1      B-T2      B-T3      B-T4       ← Phase B (4 parallel agents)
        │         │         │         │
        └────┬────┴────┬────┴────┬────┘
             │         │         │
             ▼         ▼         ▼
          ┌──┼──┬──────┼──┬──────┼─────┐
          ▼  ▼  ▼      ▼  ▼      ▼     ▼
        C-T1 C-T2 C-T3 D-T1   E-T1               ← Phase C+D+E (5 parallel agents)
          │  │   │   │   │
          └──┴───┴───┴───┘
                 │
                 ▼
            Phase F (serial)
```

**Hard gates:**
- Phase A merges to `campaign/ui-shell` before Phase B dispatches (B needs schema).
- Phase B merges (all 4 sub-sortier) before Phase C/D/E dispatch (C/D/E need server actions + capability tools + telemetry registry).
- Phase C+D+E merge before Phase F dispatches (F writes journeys against live surfaces).

---

## File Structure

Files created or modified, grouped by sortie boundary. Each entry: path → owner team → responsibility.

### Phase A — Migrations + helper SQL (sequential)

| Path | Owner | Responsibility |
|---|---|---|
| `supabase/migrations/20260620120000_is_admin_or_manager_helper.sql` | A | New SECURITY DEFINER helper |
| `supabase/migrations/20260620120100_day_line_session_enums.sql` | A | `shift_session_status` enum |
| `supabase/migrations/20260620120200_day_line_table.sql` | A | `day_line` table + indexes + RLS |
| `supabase/migrations/20260620120300_shift_session_table.sql` | A | `shift_session` table + indexes + RLS |
| `supabase/migrations/20260620120400_shift_session_day_line_junction.sql` | A | M:N junction |
| `supabase/migrations/20260620120500_department_location_junction.sql` | A | `department_location` + RLS |
| `supabase/migrations/20260620120600_day_line_child_fks.sql` | A | ALTER COLUMN on session_task / schedule_day_booking / deviation + session_task.scheduled_at + session_hook UNIQUE |
| `supabase/migrations/20260620120700_day_line_backfill.sql` | A | One day_line per existing department_session |
| `supabase/migrations/20260620120800_day_line_capability_authority_seed.sql` | A | 5 new capabilities into engine_authority_config |

### Phase B — Capabilities + triggers + telemetry (parallel)

| Path | Owner | Responsibility |
|---|---|---|
| `packages/ai/src/capabilities/day-line/index.ts` | B-T1 | Capability registration |
| `packages/ai/src/capabilities/day-line/gate.ts` | B-T1 | `gate_action` config |
| `packages/ai/src/capabilities/day-line/tools.ts` | B-T1 | 3 tools: `create`, `add_item`, `instantiate_template` |
| `packages/ai/src/capabilities/day-line/__tests__/tools.test.ts` | B-T1 | Deny + allow paths |
| `apps/web/src/app/dashboard/_actions/create-day-line-action.ts` | B-T1 | Server Action wrapper |
| `apps/web/src/app/dashboard/_actions/add-day-line-item-action.ts` | B-T1 | Server Action wrapper |
| `apps/web/src/app/dashboard/_actions/instantiate-template-action.ts` | B-T1 | Server Action wrapper |
| `packages/ai/src/capabilities/routine/index.ts` | B-T2 | Capability registration |
| `packages/ai/src/capabilities/routine/gate.ts` | B-T2 | gate config |
| `packages/ai/src/capabilities/routine/tools.ts` | B-T2 | `attach_to_line` (delegates per ADR-0240) |
| `packages/ai/src/capabilities/routine/__tests__/tools.test.ts` | B-T2 | grep-forbids direct session_task.insert |
| `packages/ai/src/capabilities/org/index.ts` | B-T2 | Capability registration |
| `packages/ai/src/capabilities/org/gate.ts` | B-T2 | gate config |
| `packages/ai/src/capabilities/org/tools.ts` | B-T2 | `update_dept_areas` |
| `packages/ai/src/capabilities/org/__tests__/tools.test.ts` | B-T2 | Allow/deny |
| `packages/ai/src/capabilities/task/tools.ts:360-525` | B-T2 | `create_session` accepts optional `day_line_id` + Pattern B fields |
| `packages/ai/src/capabilities/hms/tools.ts` | B-T2 | `report_deviation` accepts optional `day_line_id` |
| `supabase/migrations/20260620130000_ensure_shift_session_trigger.sql` | B-T3 | `ensure_shift_session()` + trigger |
| `supabase/migrations/20260620130100_day_line_back_populate_trigger.sql` | B-T3 | Counterpart: day_line INSERT → populate junction |
| `packages/telemetry/src/registry.ts` | B-T4 | 9 new events in `SmartoutEvent` + `EVENT_ROUTING` |
| `packages/ai/src/router/check-intent-coverage.ts` | B-T4 | 5 new capabilities into DOCUMENTED_TOOLLESS or system-prompt |
| `packages/ai/src/router/tool-selector.ts` | B-T4 | Same-commit intent-enum entries (ADR-0112 5th recurrence gate) |

### Phase C — Web UI (parallel)

| Path | Owner | Responsibility |
|---|---|---|
| `apps/web/src/components/day/tabs/TimelineTab.tsx` | C-T1 | Refactor — render stack of `<DayLineStrip>` per row |
| `apps/web/src/components/day/DayLineStrip.tsx` | C-T1 | New — single strip wrapper |
| `apps/web/src/components/day/DayLineStripHeader.tsx` | C-T1 | New — area name + open/close + edit btn |
| `apps/web/src/components/day/OpenCloseEditPopover.tsx` | C-T2 | New — two-input editor |
| `apps/web/src/components/day/DayLineCreateSheet.tsx` | C-T2 | New — sheet dialog |
| `apps/web/src/components/day/AttachRoutineDialog.tsx` | C-T2 | New — template picker |
| `apps/web/src/components/day/ScopeFilterPopover.tsx` | C-T3 | Refactor to multi-select OR-within / AND-between |
| `apps/web/src/components/day/_hooks/use-day-lines.ts` | C-T3 | New — `useDayLines(workspaceId, date)` |
| `apps/web/src/components/day/AggregatedDayLineList.tsx` | C-T3 | New — no-scope accordion view |
| `apps/web/src/components/day/SlotPicker.tsx` | C-T1 | Accept `dayLineId` prop, forward to actions |

### Phase D — Mobile (parallel)

| Path | Owner | Responsibility |
|---|---|---|
| `apps/mobile/src/hooks/queries/use-shift-session.ts` | D-T1 | New — read viewer's `shift_session` |
| `apps/mobile/src/hooks/queries/use-day-line-items.ts` | D-T1 | New — items for `shift_session.day_lines[]` |
| `apps/mobile/app/(app)/(calendar)/day/[date].tsx` | D-T1 | Rewire to shift_session → day_lines → items |
| `apps/mobile/src/components/HomeShiftCard.tsx` | D-T1 | Modify — preview next 3 items |
| `apps/mobile/src/lib/push.ts` | D-T1 | Modify — subscribe/unsubscribe on clock-in/out |

### Phase E — Push Pipeline (parallel)

| Path | Owner | Responsibility |
|---|---|---|
| `supabase/functions/engine-dispatch/handlers/day-line-push.ts` | E-T1 | New — 1-min tick handler |
| `supabase/functions/engine-dispatch/index.ts` | E-T1 | Register new handler |
| `supabase/functions/engine-dispatch/_tests/day-line-push.test.ts` | E-T1 | Idempotency + skip-no-token |

### Phase F — Docs + E2E (serial)

| Path | Owner | Responsibility |
|---|---|---|
| `docs/journeys/JOURNEY-day-line-create.md` | F | Manager creates day_line |
| `docs/journeys/JOURNEY-day-line-edit-hours.md` | F | Manager edits open/close |
| `docs/journeys/JOURNEY-day-line-attach-routine.md` | F | Manager attaches timeline_template |
| `docs/journeys/JOURNEY-day-line-employee-view-mobile.md` | F | Employee views shift_session |
| `docs/journeys/JOURNEY-day-line-push.md` | F | Push delivery flow |
| `apps/e2e/tests/day-line/create.spec.ts` | F | Playwright web spec |
| `apps/e2e/tests/day-line/edit-hours.spec.ts` | F | Playwright web spec |
| `apps/e2e/tests/day-line/attach-routine.spec.ts` | F | Playwright web spec |
| `apps/mobile/e2e/day-line/employee-flow.test.ts` | F | Maestro mobile spec |
| `docs/modules/daytimeline/MODULE_DAYTIMELINE.md` | F | Tri-layer update |
| `docs/modules/daytimeline/DATA-MODEL.md` | F | Schema delta confirmation |
| `docs/modules/daytimeline/GAPS-AND-DEBT.md` | F | Close G3.10 |
| `CLAUDE.md` | F | ADR table entry (Modules & ADRs section) |

---

## Phase A — Schema + RLS + Backfill (SOLO, serial)

**Agent:** `botsson-harness-builder` (sonnet). **Branch:** `campaign/ui-shell` (direct, no sub-sortie — migrations land together).
**Pre-flight:** `npx supabase status` shows local running. `psql $LOCAL_DB_URL` ready.
**Post-condition:** `npx supabase db reset` succeeds. 14 schema deny-tests pass.

### Task A1: Helper function `is_admin_or_manager_in_workspace`

**Files:**
- Create: `supabase/migrations/20260620120000_is_admin_or_manager_helper.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120000_is_admin_or_manager_helper.sql
--
-- New SECURITY DEFINER helper extending is_admin_in_workspace to admit
-- the 'manager' role. Signature (uid, wid) mirrors existing helper at
-- 00004_rls_policies.sql:33. Locked search_path per L-0172.

CREATE OR REPLACE FUNCTION public.is_admin_or_manager_in_workspace(uid uuid, wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = uid
      AND workspace_id = wid
      AND role IN ('manager', 'admin', 'owner')
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_manager_in_workspace(uuid, uuid) IS
  'ADR-0367. Returns true if uid has role manager/admin/owner in wid. Used by day_line + department_location RLS.';
```

- [ ] **Step 2: Apply locally + verify**

```bash
cd /home/sxtnl/dev/smartout.ai-ui-shell
npx supabase db reset --debug 2>&1 | tail -20
```

Expected: `Finished supabase db reset` with no error.

- [ ] **Step 3: Smoke-test helper exists**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "SELECT public.is_admin_or_manager_in_workspace('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);"
```

Expected: `false` (no profile matches), exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620120000_is_admin_or_manager_helper.sql
git commit -m "feat(day-line): A1 add is_admin_or_manager_in_workspace helper (ADR-0367)"
```

---

### Task A2: Enum `shift_session_status`

**Files:**
- Create: `supabase/migrations/20260620120100_day_line_session_enums.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120100_day_line_session_enums.sql
--
-- ADR-0367. shift_session_status only. day_line_status DROPPED per
-- Council Phase 5 — derive from parent department_session + daily_reconciliation
-- + day_line.cancelled_at at read time (apps/web/src/lib/cascade/derive-day-line-status.ts).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_session_status') THEN
    CREATE TYPE shift_session_status AS ENUM (
      'scheduled',
      'clocked_in',
      'clocked_out',
      'cancelled'
    );
  END IF;
END$$;

COMMENT ON TYPE shift_session_status IS 'ADR-0367. Lifecycle of per-employee shift runtime. NULL day_line_status by design.';
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db reset 2>&1 | tail -5
psql "$LOCAL_DB_URL" -c "SELECT unnest(enum_range(NULL::shift_session_status));"
```

Expected: 4 rows — scheduled, clocked_in, clocked_out, cancelled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620120100_day_line_session_enums.sql
git commit -m "feat(day-line): A2 add shift_session_status enum (ADR-0367)"
```

---

### Task A3: Table `day_line` + indexes + RLS

**Files:**
- Create: `supabase/migrations/20260620120200_day_line_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120200_day_line_table.sql
--
-- ADR-0367 §4.1. PROGRAM layer — per (department_session, location) anchor.
-- Status DERIVED at read time, not stored. cancelled_at + is_backfilled
-- carry the only mutable lifecycle bits.

CREATE TABLE public.day_line (
  day_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  department_id          UUID NOT NULL REFERENCES department(department_id),
  location_id            UUID NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  business_date          DATE NOT NULL,
  planned_open           TIME NOT NULL,
  planned_close          TIME NOT NULL,
  source_template_id     UUID REFERENCES timeline_template(id),
  notes                  TEXT,
  cancelled_at           TIMESTAMPTZ,
  is_backfilled          BOOLEAN NOT NULL DEFAULT false,
  created_by             UUID REFERENCES profile(profile_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_day_line UNIQUE (department_session_id, location_id)
);

CREATE INDEX idx_day_line_workspace_date ON day_line (workspace_id, business_date);
CREATE INDEX idx_day_line_session ON day_line (department_session_id);
CREATE INDEX idx_day_line_location ON day_line (location_id);

CREATE TRIGGER set_day_line_updated_at
  BEFORE UPDATE ON day_line FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE day_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_day_line" ON day_line FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_select_day_line" ON day_line FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "jwt_insert_day_line" ON day_line FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_update_day_line" ON day_line FOR UPDATE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_day_line" ON day_line FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE day_line IS 'ADR-0367. PROGRAM layer — per area daily plan. Status derived at read time.';
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db reset 2>&1 | tail -5
psql "$LOCAL_DB_URL" -c "\d+ public.day_line"
```

Expected: table shows 14 columns + 3 indexes + UNIQUE constraint + 5 policies.

- [ ] **Step 3: RLS deny-test (anonymous role)**

```bash
psql "postgresql://anon:anon@127.0.0.1:54322/postgres" -c \
  "SET ROLE anon; SELECT count(*) FROM public.day_line;"
```

Expected: `0` (RLS denies — no JWT claim).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620120200_day_line_table.sql
git commit -m "feat(day-line): A3 day_line table + RLS dual-auth (ADR-0367)"
```

---

### Task A4: Table `shift_session` + indexes + RLS

**Files:**
- Create: `supabase/migrations/20260620120300_shift_session_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120300_shift_session_table.sql
--
-- ADR-0367 §4.2. RUNTIME layer — per (employee, schedule_shift).
-- schedule_shift PK is schedule_shift_id; assignee column is employee_id.
-- Verified 2026-05-18 against 20260301300000_schedule_shift_table.sql:45.

CREATE TABLE public.shift_session (
  shift_session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id),
  schedule_shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  employee_id            UUID NOT NULL REFERENCES profile(profile_id),
  business_date          DATE NOT NULL,
  location_id            UUID NOT NULL REFERENCES location(location_id),
  department_id          UUID NOT NULL REFERENCES department(department_id),
  status                 shift_session_status NOT NULL DEFAULT 'scheduled',
  clocked_in_at          TIMESTAMPTZ,
  clocked_out_at         TIMESTAMPTZ,
  push_topic             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_session UNIQUE (schedule_shift_id)
);

CREATE INDEX idx_shift_session_employee_active
  ON shift_session (employee_id, status)
  WHERE status IN ('scheduled', 'clocked_in');

CREATE INDEX idx_shift_session_date
  ON shift_session (workspace_id, business_date);

CREATE TRIGGER set_shift_session_updated_at
  BEFORE UPDATE ON shift_session FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shift_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_shift_session_self_or_manager" ON shift_session FOR SELECT
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND (
    employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    OR is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
  )
);

CREATE POLICY "api_key_select_shift_session" ON shift_session FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "service_role_shift_session" ON shift_session FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE shift_session IS 'ADR-0367. RUNTIME layer — per-employee shift lifecycle row.';
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db reset 2>&1 | tail -5
psql "$LOCAL_DB_URL" -c "\d+ public.shift_session"
```

Expected: 14 columns + UNIQUE on schedule_shift_id + 2 indexes + 3 policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620120300_shift_session_table.sql
git commit -m "feat(day-line): A4 shift_session table + RLS (ADR-0367)"
```

---

### Task A5: Junction `shift_session_day_line`

**Files:**
- Create: `supabase/migrations/20260620120400_shift_session_day_line_junction.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120400_shift_session_day_line_junction.sql
-- ADR-0367 §4.3. M:N — shift_session can span multiple day_lines (multi-area shifts).

CREATE TABLE public.shift_session_day_line (
  shift_session_id  UUID NOT NULL REFERENCES shift_session(shift_session_id) ON DELETE CASCADE,
  day_line_id       UUID NOT NULL REFERENCES day_line(day_line_id) ON DELETE CASCADE,
  PRIMARY KEY (shift_session_id, day_line_id)
);

CREATE INDEX idx_ssdl_day_line ON shift_session_day_line (day_line_id);

-- Junction inherits parent RLS — readers go through shift_session SELECT path.
ALTER TABLE shift_session_day_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_ssdl" ON shift_session_day_line FOR SELECT
USING (
  shift_session_id IN (
    SELECT shift_session_id FROM shift_session
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  )
);

CREATE POLICY "service_role_ssdl" ON shift_session_day_line FOR ALL
USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply + commit**

```bash
npx supabase db reset 2>&1 | tail -5
git add supabase/migrations/20260620120400_shift_session_day_line_junction.sql
git commit -m "feat(day-line): A5 shift_session_day_line junction (ADR-0367)"
```

---

### Task A6: Junction `department_location` + RLS

**Files:**
- Create: `supabase/migrations/20260620120500_department_location_junction.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120500_department_location_junction.sql
-- ADR-0367 §4.4. M:N — workspace says which departments operate at which areas.
-- workspace_id denormalized for RLS perf; populated by INSERT trigger.

CREATE TABLE public.department_location (
  department_id  UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id    UUID NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by     UUID REFERENCES profile(profile_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, location_id)
);

CREATE INDEX idx_department_location_department ON department_location (department_id);
CREATE INDEX idx_department_location_location ON department_location (location_id);
CREATE INDEX idx_department_location_workspace ON department_location (workspace_id);

-- Denorm workspace_id from department on INSERT.
CREATE OR REPLACE FUNCTION public.set_department_location_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.department WHERE department_id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_department_location_workspace_id
  BEFORE INSERT ON department_location
  FOR EACH ROW EXECUTE FUNCTION set_department_location_workspace_id();

ALTER TABLE department_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_department_location" ON department_location FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_department_location" ON department_location FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "jwt_insert_department_location" ON department_location FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_delete_department_location" ON department_location FOR DELETE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_department_location" ON department_location FOR ALL
USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply + commit**

```bash
npx supabase db reset 2>&1 | tail -5
git add supabase/migrations/20260620120500_department_location_junction.sql
git commit -m "feat(day-line): A6 department_location junction + RLS (ADR-0367)"
```

---

### Task A7: Child FK additions + session_hook UNIQUE

**Files:**
- Create: `supabase/migrations/20260620120600_day_line_child_fks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120600_day_line_child_fks.sql
-- ADR-0367 §4.6 + Rule 1b. session_hook is template per (workspace, dept, hook_type)
-- — NOT receiving day_line_id. Add UNIQUE constraint to enforce template uniqueness
-- (closes L-0311 schema-invariant-prose-requires-enforcement).

-- 1. day_line_id additions (NOT on session_hook).
ALTER TABLE session_task         ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE schedule_day_booking ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE deviation            ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

-- 2. session_task.scheduled_at — required for push-pipeline time-based items.
ALTER TABLE session_task ADD COLUMN scheduled_at TIMESTAMPTZ;

-- 3. Partial indexes — only index rows that are actually bound.
CREATE INDEX idx_session_task_day_line         ON session_task(day_line_id)         WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_schedule_day_booking_day_line ON schedule_day_booking(day_line_id) WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_deviation_day_line            ON deviation(day_line_id)            WHERE day_line_id IS NOT NULL;

CREATE INDEX idx_session_task_scheduled_pending
  ON session_task (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'pending';

-- 4. session_hook UNIQUE — enforce template invariant per L-0311.
ALTER TABLE session_hook
  ADD CONSTRAINT uq_session_hook_template UNIQUE (workspace_id, department_id, hook_type);

COMMENT ON CONSTRAINT uq_session_hook_template ON session_hook IS
  'ADR-0367 Rule 1b + L-0311. Template invariant: at most one hook per (workspace, dept, type).';
```

- [ ] **Step 2: Apply + verify UNIQUE blocks dupes**

```bash
npx supabase db reset 2>&1 | tail -5
# Verify UNIQUE rejects duplicate insert
psql "$LOCAL_DB_URL" <<'EOF'
DO $$
DECLARE
  v_workspace UUID := (SELECT workspace_id FROM workspace LIMIT 1);
  v_dept      UUID := (SELECT department_id FROM department LIMIT 1);
BEGIN
  IF v_workspace IS NULL OR v_dept IS NULL THEN
    RAISE NOTICE 'skip: no seed data';
    RETURN;
  END IF;
  INSERT INTO session_hook (workspace_id, department_id, hook_type, offset_minutes)
    VALUES (v_workspace, v_dept, 'pre_open', 30)
    ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO session_hook (workspace_id, department_id, hook_type, offset_minutes)
      VALUES (v_workspace, v_dept, 'pre_open', 45);
    RAISE EXCEPTION 'UNIQUE should have blocked this insert';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: uq_session_hook_template enforced';
  END;
END$$;
EOF
```

Expected: `NOTICE:  PASS: uq_session_hook_template enforced`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620120600_day_line_child_fks.sql
git commit -m "feat(day-line): A7 child FKs + session_task.scheduled_at + session_hook UNIQUE (ADR-0367, L-0311)"
```

---

### Task A8: Backfill `day_line` rows from `department_session`

**Files:**
- Create: `supabase/migrations/20260620120700_day_line_backfill.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120700_day_line_backfill.sql
-- ADR-0367 §7.1. One day_line per existing department_session using the first
-- department_location alphabetically. is_backfilled=true so admin can reseat
-- within 7-day window. schedule_day_booking.day_line_id stays NULL — free-text
-- `.location` column cannot auto-resolve. Manager re-pins via admin UI.

INSERT INTO public.day_line (
  workspace_id, department_session_id, department_id, location_id,
  business_date, planned_open, planned_close, is_backfilled
)
SELECT
  ds.workspace_id,
  ds.department_session_id,
  ds.department_id,
  (
    SELECT dl.location_id
    FROM public.department_location dl
    JOIN public.location l ON l.location_id = dl.location_id
    WHERE dl.department_id = ds.department_id
    ORDER BY l.name
    LIMIT 1
  ) AS location_id,
  ds.session_date,
  COALESCE(ds.planned_open_time, '00:00'::time),
  COALESCE(ds.planned_close_time, '23:59'::time),
  true
FROM public.department_session ds
WHERE NOT EXISTS (
  SELECT 1 FROM public.day_line dl
  WHERE dl.department_session_id = ds.department_session_id
)
AND EXISTS (
  -- Skip dept-sessions whose department has no location pairing yet.
  SELECT 1 FROM public.department_location dl WHERE dl.department_id = ds.department_id
);
```

- [ ] **Step 2: Apply + verify counts**

```bash
npx supabase db reset 2>&1 | tail -5
psql "$LOCAL_DB_URL" -c "
SELECT
  (SELECT count(*) FROM department_session WHERE EXISTS (SELECT 1 FROM department_location dl WHERE dl.department_id = department_session.department_id)) AS sessions_eligible,
  (SELECT count(*) FROM day_line) AS day_lines_created,
  (SELECT count(*) FROM day_line WHERE is_backfilled) AS marked_backfill;
"
```

Expected: `sessions_eligible = day_lines_created = marked_backfill`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620120700_day_line_backfill.sql
git commit -m "feat(day-line): A8 backfill day_line from department_session (ADR-0367)"
```

---

### Task A9: Capability authority seed

**Files:**
- Create: `supabase/migrations/20260620120800_day_line_capability_authority_seed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120800_day_line_capability_authority_seed.sql
-- ADR-0367 §B7. 5 new capabilities into engine_authority_config.
-- All start as 'suggest' (require user confirmation per default).
-- Voice / chat allowance: chat-only on mutations (ADR-0078).

INSERT INTO public.engine_authority_config (capability_name, default_authority, allowed_channels, description)
VALUES
  ('day-line.create',                'suggest', ARRAY['chat'], 'ADR-0367. Create day_line for area+session.'),
  ('day-line.add_item',              'suggest', ARRAY['chat'], 'ADR-0367. Delegating dispatcher — V1: task+routine only.'),
  ('day-line.instantiate_template',  'suggest', ARRAY['chat'], 'ADR-0367. Apply timeline_template (scope=location) to day_line.'),
  ('routine.attach_to_line',         'suggest', ARRAY['chat'], 'ADR-0367. Attach routine items as session_task rows.'),
  ('org.update_dept_areas',          'suggest', ARRAY['chat'], 'ADR-0367. Admin updates department_location pairings.')
ON CONFLICT (capability_name) DO NOTHING;
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db reset 2>&1 | tail -5
psql "$LOCAL_DB_URL" -c "
SELECT capability_name, default_authority FROM engine_authority_config
WHERE capability_name LIKE 'day-line.%' OR capability_name IN ('routine.attach_to_line','org.update_dept_areas')
ORDER BY capability_name;
"
```

Expected: 5 rows, all `suggest`.

- [ ] **Step 3: Run full Phase A acceptance**

```bash
# Final clean apply
npx supabase db reset 2>&1 | tail -10
# Confirm no errors across all 9 migrations
pnpm --filter @smartout/supabase gen-types 2>&1 | tail -5
```

Expected: `Finished` and types regenerated.

- [ ] **Step 4: Commit + push**

```bash
git add supabase/migrations/20260620120800_day_line_capability_authority_seed.sql packages/supabase/src/database.types.ts
git commit -m "feat(day-line): A9 capability authority seed + regenerated types (ADR-0367)"
git push origin campaign/ui-shell
```

**Phase A Gate (must all pass before dispatching Phase B):**

- [ ] `npx supabase db reset` clean
- [ ] `gen-types` regenerated; `pnpm --filter web typecheck` green
- [ ] `count(day_line) == count(eligible department_session)` post-backfill
- [ ] `count(schedule_day_booking WHERE day_line_id IS NULL) == count(*)` (all NULL — manager re-pins)
- [ ] RLS deny-test (anon role): 0 rows from day_line / shift_session
- [ ] RLS deny-test (other workspace): 0 rows
- [ ] RLS allow-test (employee viewer): reads own shift_session, NOT others'
- [ ] RLS allow-test (manager): reads all in own workspace
- [ ] L-0042 ordering: every reference exists in earlier migration (helper before policy)
- [ ] L-0311 UNIQUE on session_hook enforces (duplicate insert blocked)

---

## Phase B — Capabilities + Triggers + Telemetry (PARALLEL ×4)

**Dispatch:** 4 sub-sortier in parallel against `campaign/ui-shell`. Each uses worktree pattern (`~/dev/smartout.ai-ui-shell-wt-<N>`).

**Pre-flight (all teams):**
```bash
cd ~/dev/smartout.ai-ui-shell
git pull origin campaign/ui-shell
pnpm install
pnpm --filter @smartout/supabase build
pnpm --filter @smartout/telemetry build  # L-stale-telemetry-dist prevention
```

### B-Team-1: `day-line` capability (3 tools + 3 Server Actions)

**Agent:** `botsson-harness-builder` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-bt1` @ `feat/day-line-caps`.

#### Task BT1-1: Capability index + gate

**Files:**
- Create: `packages/ai/src/capabilities/day-line/index.ts`
- Create: `packages/ai/src/capabilities/day-line/gate.ts`

- [ ] **Step 1: Write `gate.ts`**

```ts
// packages/ai/src/capabilities/day-line/gate.ts
//
// ADR-0367. Gate config for day-line capability.
// All 3 tools require manager+ role. Chat-only per ADR-0078.

import type { GateConfig } from "../../gate/types.js";

export const dayLineGate: GateConfig = {
  capability: "day-line",
  defaultAuthority: "suggest",
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "day_line",
};
```

- [ ] **Step 2: Write `index.ts`**

```ts
// packages/ai/src/capabilities/day-line/index.ts
//
// ADR-0367. Capability registration for day-line.
// Tools: create, add_item, instantiate_template.

import { defineCapability } from "../../types.js";
import { dayLineGate } from "./gate.js";
import { create, addItem, instantiateTemplate } from "./tools.js";

export const dayLineCapability = defineCapability({
  name: "day-line",
  description: "ADR-0367. Day-line program — area-anchored daily plan per (department_session, location).",
  gate: dayLineGate,
  tools: [create, addItem, instantiateTemplate],
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/day-line/index.ts packages/ai/src/capabilities/day-line/gate.ts
git commit -m "feat(day-line): BT1-1 day-line capability index + gate (ADR-0367)"
```

#### Task BT1-2: Tool `create` — failing test first

**Files:**
- Create: `packages/ai/src/capabilities/day-line/__tests__/tools.test.ts`
- Create (stub): `packages/ai/src/capabilities/day-line/tools.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/ai/src/capabilities/day-line/__tests__/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { create } from "../tools.js";
import { makeTestCtx } from "../../../__tests__/_test-helpers.js";

describe("day-line.create", () => {
  it("denies non-manager", async () => {
    const ctx = makeTestCtx({ role: "employee" });
    await expect(
      create.execute(ctx, {
        department_session_id: "00000000-0000-0000-0000-000000000001",
        location_id: "00000000-0000-0000-0000-000000000002",
      }),
    ).rejects.toThrow(/gate_action/i);
  });

  it("inserts day_line on allow + emits day_line.created", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const emitted: string[] = [];
    ctx.emit = vi.fn((e) => { emitted.push(e); });
    const result = await create.execute(ctx, {
      department_session_id: "00000000-0000-0000-0000-000000000001",
      location_id: "00000000-0000-0000-0000-000000000002",
    });
    expect(result.day_line_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(emitted).toContain("day_line.created");
  });

  it("rejects when department_location pairing missing", async () => {
    const ctx = makeTestCtx({
      role: "manager",
      preset: { department_location_present: false },
    });
    await expect(
      create.execute(ctx, {
        department_session_id: "00000000-0000-0000-0000-000000000001",
        location_id: "00000000-0000-0000-0000-000000000099",
      }),
    ).rejects.toThrow(/department_location/);
  });
});
```

- [ ] **Step 2: Write tools.ts stub**

```ts
// packages/ai/src/capabilities/day-line/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import { gatedMutation } from "../../gate/gated-mutation.js";

const CAPABILITY = "day-line";

export const create = defineTool({
  capability: CAPABILITY,
  name: "create",
  description: "Create a day_line for a (department_session, location). Server-resolves workspace+actor. Auto-fills planned_open/close from department_operating_hours.",
  schema: z.object({
    department_session_id: z.string().uuid(),
    location_id: z.string().uuid(),
    planned_open: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    planned_close: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    source_template_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
  }),
  execute: async () => { throw new Error("not implemented"); },
});

export const addItem = defineTool({
  capability: CAPABILITY,
  name: "add_item",
  description: "stub",
  schema: z.object({}),
  execute: async () => { throw new Error("not implemented"); },
});

export const instantiateTemplate = defineTool({
  capability: CAPABILITY,
  name: "instantiate_template",
  description: "stub",
  schema: z.object({}),
  execute: async () => { throw new Error("not implemented"); },
});
```

- [ ] **Step 3: Run test — verify failing**

```bash
pnpm --filter @smartout/ai test capabilities/day-line/__tests__/tools.test.ts 2>&1 | tail -20
```

Expected: 3 tests FAIL (`not implemented` thrown).

- [ ] **Step 4: Commit failing skeleton**

```bash
git add packages/ai/src/capabilities/day-line/tools.ts packages/ai/src/capabilities/day-line/__tests__/tools.test.ts
git commit -m "test(day-line): BT1-2 failing tests + stubs for create/add_item/instantiate_template"
```

#### Task BT1-3: Implement `create` body

- [ ] **Step 1: Replace `create.execute` body**

In `packages/ai/src/capabilities/day-line/tools.ts`, replace the `create` definition:

```ts
export const create = defineTool({
  capability: CAPABILITY,
  name: "create",
  description: "Create a day_line for a (department_session, location). Server-resolves workspace+actor. Auto-fills planned_open/close from department_operating_hours.",
  schema: z.object({
    department_session_id: z.string().uuid(),
    location_id: z.string().uuid(),
    planned_open: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    planned_close: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    source_template_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
  }),
  execute: gatedMutation({
    capability: "day-line.create",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    // 1. Resolve workspace + dept from department_session (server-derived; never body).
    const { data: session, error: sessionErr } = await ctx.sb
      .from("department_session")
      .select("workspace_id, department_id, session_date, planned_open_time, planned_close_time")
      .eq("department_session_id", input.department_session_id)
      .single();
    if (sessionErr || !session) throw new Error("day_line.create: department_session not found");

    // 2. Verify department_location pairing.
    const { data: pairing } = await ctx.sb
      .from("department_location")
      .select("department_id")
      .eq("department_id", session.department_id)
      .eq("location_id", input.location_id)
      .maybeSingle();
    if (!pairing) throw new Error("day_line.create: department_location pairing missing");

    // 3. Resolve hours from session or input.
    const planned_open  = input.planned_open  ?? session.planned_open_time  ?? "00:00";
    const planned_close = input.planned_close ?? session.planned_close_time ?? "23:59";

    // 4. INSERT.
    const { data: row, error: insErr } = await ctx.sb
      .from("day_line")
      .insert({
        workspace_id: session.workspace_id,
        department_session_id: input.department_session_id,
        department_id: session.department_id,
        location_id: input.location_id,
        business_date: session.session_date,
        planned_open,
        planned_close,
        source_template_id: input.source_template_id ?? null,
        notes: input.notes ?? null,
        created_by: ctx.profileId,
      })
      .select("day_line_id")
      .single();
    if (insErr || !row) throw new Error(`day_line.create: insert failed — ${insErr?.message ?? "unknown"}`);

    // 5. Emit.
    await ctx.emit("day_line.created", {
      workspace_id: session.workspace_id,
      actor_id: ctx.profileId,
      entity_id: row.day_line_id,
      day_line_id: row.day_line_id,
      department_session_id: input.department_session_id,
      location_id: input.location_id,
      department_id: session.department_id,
      planned_open,
      planned_close,
    });

    return { day_line_id: row.day_line_id };
  }),
});
```

- [ ] **Step 2: Run test — verify passing**

```bash
pnpm --filter @smartout/ai test capabilities/day-line/__tests__/tools.test.ts 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/day-line/tools.ts
git commit -m "feat(day-line): BT1-3 implement create body (ADR-0151 server-derived)"
```

#### Task BT1-4: Implement `add_item` with per-type dispatch

- [ ] **Step 1: Extend test**

Append to `packages/ai/src/capabilities/day-line/__tests__/tools.test.ts`:

```ts
describe("day-line.add_item", () => {
  it("delegates task type to task.create_session with Pattern B audit fields", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const delegate = vi.fn().mockResolvedValue({ session_task_id: "00000000-0000-0000-0000-000000000010" });
    ctx.delegateCapability = delegate;
    await addItem.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      item_type: "task",
      title: "Stock check",
      scheduled_at: "2026-05-18T15:00:00Z",
    });
    expect(delegate).toHaveBeenCalledWith(
      "task.create_session",
      expect.objectContaining({
        day_line_id: "00000000-0000-0000-0000-000000000001",
        actor_capability: "task",
        delegated_via: "day-line",
      }),
    );
  });

  it("delegates routine type to timeline-template.apply_template", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const delegate = vi.fn().mockResolvedValue({ applied: 3 });
    ctx.delegateCapability = delegate;
    await addItem.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      item_type: "routine",
      template_id: "00000000-0000-0000-0000-000000000020",
    });
    expect(delegate).toHaveBeenCalledWith(
      "timeline-template.apply_template",
      expect.objectContaining({ day_line_id: expect.any(String), actor_capability: "timeline-template", delegated_via: "day-line" }),
    );
  });

  it("rejects V2 types (booking/note/reminder)", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    await expect(
      addItem.execute(ctx, {
        day_line_id: "00000000-0000-0000-0000-000000000001",
        item_type: "booking",
      } as unknown as never),
    ).rejects.toThrow(/V1 supports.*task.*routine/i);
  });
});
```

- [ ] **Step 2: Implement `addItem`**

In `tools.ts`, replace the `addItem` stub:

```ts
const addItemSchema = z.discriminatedUnion("item_type", [
  z.object({
    day_line_id: z.string().uuid(),
    item_type: z.literal("task"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    scheduled_at: z.string().datetime().optional(),
    assigned_to: z.string().uuid().optional(),
  }),
  z.object({
    day_line_id: z.string().uuid(),
    item_type: z.literal("routine"),
    template_id: z.string().uuid(),
  }),
]).superRefine((data, ctx) => {
  const v1Types = ["task", "routine"];
  if (!v1Types.includes(data.item_type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "V1 supports item_type in {task, routine}. Booking/note/reminder DEFERRED V2.",
    });
  }
});

export const addItem = defineTool({
  capability: CAPABILITY,
  name: "add_item",
  description: "Delegating dispatcher. V1 supports item_type=task|routine. Per ADR-0240 cross-namespace: body forwards to owning capability with Pattern B audit fields.",
  schema: addItemSchema,
  execute: gatedMutation({
    capability: "day-line.add_item",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    // Resolve workspace from day_line (server-derived).
    const { data: line } = await ctx.sb
      .from("day_line")
      .select("workspace_id, department_id, location_id, business_date")
      .eq("day_line_id", input.day_line_id)
      .single();
    if (!line) throw new Error("day-line.add_item: day_line not found");

    if (input.item_type === "task") {
      const result = await ctx.delegateCapability("task.create_session", {
        day_line_id: input.day_line_id,
        department_session_id: undefined,  // task capability re-resolves from day_line
        title: input.title,
        description: input.description,
        scheduled_at: input.scheduled_at,
        assigned_to: input.assigned_to,
        actor_capability: "task",
        delegated_via: "day-line",
      });
      await ctx.emit("day_line_item.added", {
        workspace_id: line.workspace_id,
        actor_id: ctx.profileId,
        entity_id: input.day_line_id,
        item_type: "task",
        delegated_to_id: result.session_task_id,
      });
      return result;
    }

    if (input.item_type === "routine") {
      const result = await ctx.delegateCapability("timeline-template.apply_template", {
        template_id: input.template_id,
        day_line_id: input.day_line_id,
        scope_type: "location",
        scope_id: line.location_id,
        target_date: line.business_date,
        actor_capability: "timeline-template",
        delegated_via: "day-line",
      });
      await ctx.emit("routine.attached", {
        workspace_id: line.workspace_id,
        actor_id: ctx.profileId,
        entity_id: input.day_line_id,
        template_id: input.template_id,
        items_applied: result.applied,
      });
      return result;
    }

    throw new Error("day-line.add_item: unreachable — schema validates types");
  }),
});
```

- [ ] **Step 3: Run test — pass**

```bash
pnpm --filter @smartout/ai test capabilities/day-line/__tests__/tools.test.ts 2>&1 | tail -10
```

Expected: 6 tests PASS (3 create + 3 add_item).

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/capabilities/day-line/tools.ts packages/ai/src/capabilities/day-line/__tests__/tools.test.ts
git commit -m "feat(day-line): BT1-4 add_item per-type dispatch + Pattern B audit (ADR-0240, ADR-0356)"
```

#### Task BT1-5: Implement `instantiate_template`

- [ ] **Step 1: Extend test**

Append to test file:

```ts
describe("day-line.instantiate_template", () => {
  it("delegates to timeline-template.apply_template with day_line_id + Pattern B", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const delegate = vi.fn().mockResolvedValue({ applied: 5 });
    ctx.delegateCapability = delegate;
    const result = await instantiateTemplate.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      template_id: "00000000-0000-0000-0000-000000000020",
    });
    expect(result.applied).toBe(5);
    expect(delegate).toHaveBeenCalledWith(
      "timeline-template.apply_template",
      expect.objectContaining({
        day_line_id: "00000000-0000-0000-0000-000000000001",
        scope_type: "location",
        actor_capability: "timeline-template",
        delegated_via: "day-line",
      }),
    );
  });
});
```

- [ ] **Step 2: Implement**

In `tools.ts`, replace `instantiateTemplate` stub:

```ts
export const instantiateTemplate = defineTool({
  capability: CAPABILITY,
  name: "instantiate_template",
  description: "Apply a timeline_template (scope_type=location) to this day_line. Delegates to timeline-template.apply_template per ADR-0240.",
  schema: z.object({
    day_line_id: z.string().uuid(),
    template_id: z.string().uuid(),
  }),
  execute: gatedMutation({
    capability: "day-line.instantiate_template",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    const { data: line } = await ctx.sb
      .from("day_line")
      .select("workspace_id, location_id, business_date")
      .eq("day_line_id", input.day_line_id)
      .single();
    if (!line) throw new Error("day-line.instantiate_template: day_line not found");

    const result = await ctx.delegateCapability("timeline-template.apply_template", {
      template_id: input.template_id,
      day_line_id: input.day_line_id,
      scope_type: "location",
      scope_id: line.location_id,
      target_date: line.business_date,
      actor_capability: "timeline-template",
      delegated_via: "day-line",
    });

    await ctx.emit("routine.attached", {
      workspace_id: line.workspace_id,
      actor_id: ctx.profileId,
      entity_id: input.day_line_id,
      template_id: input.template_id,
      items_applied: result.applied,
    });

    return result;
  }),
});
```

- [ ] **Step 3: Test + commit**

```bash
pnpm --filter @smartout/ai test capabilities/day-line/__tests__/tools.test.ts 2>&1 | tail -10
git add packages/ai/src/capabilities/day-line/tools.ts packages/ai/src/capabilities/day-line/__tests__/tools.test.ts
git commit -m "feat(day-line): BT1-5 instantiate_template (delegate to timeline-template, ADR-0335)"
```

Expected test output: 7 PASS.

#### Task BT1-6: 3 Server Actions

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/create-day-line-action.ts`
- Create: `apps/web/src/app/dashboard/_actions/add-day-line-item-action.ts`
- Create: `apps/web/src/app/dashboard/_actions/instantiate-template-action.ts`

- [ ] **Step 1: Write `create-day-line-action.ts`**

```ts
// apps/web/src/app/dashboard/_actions/create-day-line-action.ts
"use server";

import { z } from "zod";
import { getServerContext } from "./helpers/get-server-context";
import { callCapabilityTool } from "@smartout/ai/server";

const InputSchema = z.object({
  department_session_id: z.string().uuid(),
  location_id: z.string().uuid(),
  planned_open: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  planned_close: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  source_template_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createDayLineAction(input: z.infer<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const ctx = await getServerContext();  // server-derived workspace_id + profile_id (ADR-0151)
  return callCapabilityTool({
    capability: "day-line",
    name: "create",
    input: parsed,
    ctx,
  });
}
```

- [ ] **Step 2: Write `add-day-line-item-action.ts`**

```ts
// apps/web/src/app/dashboard/_actions/add-day-line-item-action.ts
"use server";

import { z } from "zod";
import { getServerContext } from "./helpers/get-server-context";
import { callCapabilityTool } from "@smartout/ai/server";

const InputSchema = z.discriminatedUnion("item_type", [
  z.object({
    day_line_id: z.string().uuid(),
    item_type: z.literal("task"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    scheduled_at: z.string().datetime().optional(),
    assigned_to: z.string().uuid().optional(),
  }),
  z.object({
    day_line_id: z.string().uuid(),
    item_type: z.literal("routine"),
    template_id: z.string().uuid(),
  }),
]);

export async function addDayLineItemAction(input: z.infer<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const ctx = await getServerContext();
  return callCapabilityTool({
    capability: "day-line",
    name: "add_item",
    input: parsed,
    ctx,
  });
}
```

- [ ] **Step 3: Write `instantiate-template-action.ts`**

```ts
// apps/web/src/app/dashboard/_actions/instantiate-template-action.ts
"use server";

import { z } from "zod";
import { getServerContext } from "./helpers/get-server-context";
import { callCapabilityTool } from "@smartout/ai/server";

const InputSchema = z.object({
  day_line_id: z.string().uuid(),
  template_id: z.string().uuid(),
});

export async function instantiateTemplateAction(input: z.infer<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const ctx = await getServerContext();
  return callCapabilityTool({
    capability: "day-line",
    name: "instantiate_template",
    input: parsed,
    ctx,
  });
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/app/dashboard/_actions/create-day-line-action.ts \
        apps/web/src/app/dashboard/_actions/add-day-line-item-action.ts \
        apps/web/src/app/dashboard/_actions/instantiate-template-action.ts
git commit -m "feat(day-line): BT1-6 3 Server Actions wrapping capability tools (ADR-0151)"
```

#### Task BT1-7: Close BT1 sub-sortie

- [ ] **Step 1: Re-run capability tests**

```bash
pnpm --filter @smartout/ai test capabilities/day-line 2>&1 | tail -10
pnpm --filter web typecheck 2>&1 | tail -5
```

Expected: 7+ tests PASS; typecheck green.

- [ ] **Step 2: Push sub-sortie**

```bash
git push origin feat/day-line-caps
```

- [ ] **Step 3: Open PR to campaign/ui-shell**

```bash
gh pr create --base campaign/ui-shell --head feat/day-line-caps \
  --title "feat(day-line): BT1 capability + 3 server actions" \
  --body "Phase B Team 1 — day-line capability (create/add_item/instantiate_template) + 3 server actions. ADR-0367 §5.1-5.3."
```

### B-Team-2: `routine` + `org` capabilities + Pattern B extensions

**Agent:** `botsson-harness-builder` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-bt2` @ `feat/day-line-routine-org`.

#### Task BT2-1: `routine.attach_to_line` capability

**Files:**
- Create: `packages/ai/src/capabilities/routine/{index.ts,gate.ts,tools.ts,__tests__/tools.test.ts}`

- [ ] **Step 1: Write all four files**

```ts
// packages/ai/src/capabilities/routine/gate.ts
import type { GateConfig } from "../../gate/types.js";
export const routineGate: GateConfig = {
  capability: "routine",
  defaultAuthority: "suggest",
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "routine",
};
```

```ts
// packages/ai/src/capabilities/routine/index.ts
import { defineCapability } from "../../types.js";
import { routineGate } from "./gate.js";
import { attachToLine } from "./tools.js";

export const routineCapability = defineCapability({
  name: "routine",
  description: "ADR-0367 §5.4. Routine attach — delegates to task.create_session per ADR-0240.",
  gate: routineGate,
  tools: [attachToLine],
});
```

```ts
// packages/ai/src/capabilities/routine/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import { gatedMutation } from "../../gate/gated-mutation.js";

const CAPABILITY = "routine";

export const attachToLine = defineTool({
  capability: CAPABILITY,
  name: "attach_to_line",
  description: "Attach a routine (list of task items) to an existing day_line. Body MUST delegate to task.create_session per ADR-0240 — direct session_task INSERT forbidden.",
  schema: z.object({
    day_line_id: z.string().uuid(),
    items: z.array(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      scheduled_at: z.string().datetime().optional(),
    })).min(1).max(50),
  }),
  execute: gatedMutation({
    capability: "routine.attach_to_line",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    const { data: line } = await ctx.sb
      .from("day_line")
      .select("workspace_id, department_session_id")
      .eq("day_line_id", input.day_line_id)
      .single();
    if (!line) throw new Error("routine.attach_to_line: day_line not found");

    const created: string[] = [];
    for (const item of input.items) {
      const result = await ctx.delegateCapability("task.create_session", {
        day_line_id: input.day_line_id,
        title: item.title,
        description: item.description,
        scheduled_at: item.scheduled_at,
        actor_capability: "task",
        delegated_via: "routine",
      });
      created.push(result.session_task_id);
    }

    await ctx.emit("routine.attached", {
      workspace_id: line.workspace_id,
      actor_id: ctx.profileId,
      entity_id: input.day_line_id,
      items_applied: created.length,
    });

    return { items_applied: created.length, session_task_ids: created };
  }),
});
```

```ts
// packages/ai/src/capabilities/routine/__tests__/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { attachToLine } from "../tools.js";
import { makeTestCtx } from "../../../__tests__/_test-helpers.js";

describe("routine.attach_to_line", () => {
  it("delegates each item to task.create_session with Pattern B", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const delegate = vi.fn().mockResolvedValue({ session_task_id: "00000000-0000-0000-0000-000000000010" });
    ctx.delegateCapability = delegate;
    await attachToLine.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      items: [{ title: "A" }, { title: "B" }],
    });
    expect(delegate).toHaveBeenCalledTimes(2);
    expect(delegate.mock.calls[0][1]).toMatchObject({ actor_capability: "task", delegated_via: "routine" });
  });

  it("forbids direct session_task.insert in body source", () => {
    // L-0240 mechanical check: cross-namespace direct DML forbidden.
    const source = readFileSync(join(__dirname, "../tools.ts"), "utf-8");
    expect(source).not.toMatch(/\.from\(["']session_task["']\)\s*\.\s*insert/);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @smartout/ai test capabilities/routine 2>&1 | tail -10
git add packages/ai/src/capabilities/routine/
git commit -m "feat(day-line): BT2-1 routine.attach_to_line capability (ADR-0240 delegation)"
```

#### Task BT2-2: `org.update_dept_areas` capability

**Files:**
- Create: `packages/ai/src/capabilities/org/{index.ts,gate.ts,tools.ts,__tests__/tools.test.ts}`

- [ ] **Step 1: Write all four files**

```ts
// packages/ai/src/capabilities/org/gate.ts
import type { GateConfig } from "../../gate/types.js";
export const orgGate: GateConfig = {
  capability: "org",
  defaultAuthority: "suggest",
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "org",
};
```

```ts
// packages/ai/src/capabilities/org/index.ts
import { defineCapability } from "../../types.js";
import { orgGate } from "./gate.js";
import { updateDeptAreas } from "./tools.js";

export const orgCapability = defineCapability({
  name: "org",
  description: "ADR-0367 §5.5. Org-level config — department_location pairings (HVOR×HVEM).",
  gate: orgGate,
  tools: [updateDeptAreas],
});
```

```ts
// packages/ai/src/capabilities/org/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import { gatedMutation } from "../../gate/gated-mutation.js";

const CAPABILITY = "org";

export const updateDeptAreas = defineTool({
  capability: CAPABILITY,
  name: "update_dept_areas",
  description: "Add or remove a (department_id, location_id) pairing. Admin+ only. Own namespace — no cross-namespace concern.",
  schema: z.object({
    department_id: z.string().uuid(),
    location_id: z.string().uuid(),
    action: z.enum(["add", "remove"]),
  }),
  execute: gatedMutation({
    capability: "org.update_dept_areas",
    requiredRole: "admin",
    channel: "chat",
  })(async (ctx, input) => {
    // Verify both belong to viewer's workspace.
    const { data: dept } = await ctx.sb
      .from("department")
      .select("workspace_id")
      .eq("department_id", input.department_id)
      .single();
    if (!dept) throw new Error("org.update_dept_areas: department not found");
    if (dept.workspace_id !== ctx.workspaceId) throw new Error("org.update_dept_areas: cross-workspace forbidden");

    if (input.action === "add") {
      const { error } = await ctx.sb
        .from("department_location")
        .insert({ department_id: input.department_id, location_id: input.location_id });
      if (error && !error.message.includes("duplicate key")) throw error;
    } else {
      await ctx.sb
        .from("department_location")
        .delete()
        .eq("department_id", input.department_id)
        .eq("location_id", input.location_id);
    }

    await ctx.emit("org.dept_areas_updated", {
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity_id: input.department_id,
      department_id: input.department_id,
      location_id: input.location_id,
      action: input.action,
    });

    return { ok: true };
  }),
});
```

```ts
// packages/ai/src/capabilities/org/__tests__/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { updateDeptAreas } from "../tools.js";
import { makeTestCtx } from "../../../__tests__/_test-helpers.js";

describe("org.update_dept_areas", () => {
  it("requires admin role", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    await expect(updateDeptAreas.execute(ctx, {
      department_id: "00000000-0000-0000-0000-000000000001",
      location_id: "00000000-0000-0000-0000-000000000002",
      action: "add",
    })).rejects.toThrow(/gate_action|admin/i);
  });

  it("rejects cross-workspace", async () => {
    const ctx = makeTestCtx({ role: "admin", preset: { other_workspace_dept: true } });
    await expect(updateDeptAreas.execute(ctx, {
      department_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      location_id: "00000000-0000-0000-0000-000000000002",
      action: "add",
    })).rejects.toThrow(/cross-workspace/i);
  });

  it("admin can add pairing + emits org.dept_areas_updated", async () => {
    const ctx = makeTestCtx({ role: "admin" });
    const emitted: string[] = [];
    ctx.emit = vi.fn((e) => { emitted.push(e); });
    const r = await updateDeptAreas.execute(ctx, {
      department_id: "00000000-0000-0000-0000-000000000001",
      location_id: "00000000-0000-0000-0000-000000000002",
      action: "add",
    });
    expect(r.ok).toBe(true);
    expect(emitted).toContain("org.dept_areas_updated");
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @smartout/ai test capabilities/org 2>&1 | tail -10
git add packages/ai/src/capabilities/org/
git commit -m "feat(day-line): BT2-2 org.update_dept_areas capability (ADR-0367 §5.5)"
```

#### Task BT2-3: Extend `task.create_session` for `day_line_id` + Pattern B

**Files:**
- Modify: `packages/ai/src/capabilities/task/tools.ts:360-525` (createSession definition)

- [ ] **Step 1: Add Pattern B fields to schema + extend body**

In `packages/ai/src/capabilities/task/tools.ts`, locate `createSession` (line ~360). Extend its `schema` to add three optional fields:

```ts
// Add these three to the existing z.object inside createSession:
day_line_id: z.string().uuid().optional(),
actor_capability: z.string().optional(),    // ADR-0356 Pattern B — set by delegator
delegated_via: z.string().optional(),       // ADR-0356 Pattern B — set by delegator
```

In `createSession.execute` body, before INSERT, verify Pattern B if `day_line_id` present:

```ts
// Pattern B verification per ADR-0356 — if day_line_id present, audit fields required.
if (input.day_line_id) {
  if (!input.actor_capability || !input.delegated_via) {
    throw new Error("task.create_session: day_line_id requires actor_capability + delegated_via (ADR-0356 Pattern B)");
  }
  // Re-resolve workspace + department_session_id from day_line (server-derived).
  const { data: line } = await ctx.sb
    .from("day_line")
    .select("workspace_id, department_session_id")
    .eq("day_line_id", input.day_line_id)
    .single();
  if (!line) throw new Error("task.create_session: day_line not found");
  // override input.department_session_id from server-resolved
  effectiveDepartmentSessionId = line.department_session_id;
  effectiveWorkspaceId = line.workspace_id;
}
```

Add `day_line_id` to the INSERT row:

```ts
day_line_id: input.day_line_id ?? null,
scheduled_at: input.scheduled_at ?? null,
```

Add Pattern B fields to emit:

```ts
await ctx.emit("task.created_session", {
  ...existingPayload,
  day_line_id: input.day_line_id ?? null,
  actor_capability: input.actor_capability ?? null,
  delegated_via: input.delegated_via ?? null,
});
```

- [ ] **Step 2: Add Pattern B test**

Append to `packages/ai/src/capabilities/task/__tests__/tools.test.ts`:

```ts
describe("task.create_session Pattern B extension", () => {
  it("rejects day_line_id without actor_capability + delegated_via", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    await expect(createSession.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      title: "Test",
    } as never)).rejects.toThrow(/Pattern B/i);
  });

  it("accepts day_line_id with Pattern B fields + emits with audit", async () => {
    const ctx = makeTestCtx({ role: "manager" });
    const emitSpy = vi.fn();
    ctx.emit = emitSpy;
    await createSession.execute(ctx, {
      day_line_id: "00000000-0000-0000-0000-000000000001",
      title: "Test",
      actor_capability: "task",
      delegated_via: "day-line",
    });
    expect(emitSpy).toHaveBeenCalledWith("task.created_session", expect.objectContaining({
      day_line_id: "00000000-0000-0000-0000-000000000001",
      actor_capability: "task",
      delegated_via: "day-line",
    }));
  });
});
```

- [ ] **Step 3: Test + commit**

```bash
pnpm --filter @smartout/ai test capabilities/task 2>&1 | tail -10
git add packages/ai/src/capabilities/task/tools.ts packages/ai/src/capabilities/task/__tests__/tools.test.ts
git commit -m "feat(task): BT2-3 create_session accepts day_line_id + Pattern B audit (ADR-0356, ADR-0367)"
```

#### Task BT2-4: Extend `hms.report_deviation` for `day_line_id`

- [ ] **Step 1: Add optional `day_line_id` + Pattern B to `hms.report_deviation` schema** (file: `packages/ai/src/capabilities/hms/tools.ts`, same shape as BT2-3)

- [ ] **Step 2: Add test + commit**

```bash
pnpm --filter @smartout/ai test capabilities/hms 2>&1 | tail -10
git add packages/ai/src/capabilities/hms/tools.ts packages/ai/src/capabilities/hms/__tests__/tools.test.ts
git commit -m "feat(hms): BT2-4 report_deviation accepts day_line_id + Pattern B (ADR-0367)"
```

#### Task BT2-5: Close BT2 sub-sortie

- [ ] **Step 1: Re-run all touched test files + typecheck**

```bash
pnpm --filter @smartout/ai test capabilities/{routine,org,task,hms} 2>&1 | tail -10
pnpm --filter @smartout/ai typecheck 2>&1 | tail -5
```

- [ ] **Step 2: Push + PR**

```bash
git push origin feat/day-line-routine-org
gh pr create --base campaign/ui-shell --head feat/day-line-routine-org \
  --title "feat(day-line): BT2 routine + org caps + Pattern B extensions" \
  --body "Phase B Team 2 — ADR-0367 §5.4-5.5 + cross-namespace Pattern B (ADR-0356)."
```

### B-Team-3: Triggers + counterpart back-populate

**Agent:** `botsson-harness-builder` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-bt3` @ `feat/day-line-triggers`.

#### Task BT3-1: `ensure_shift_session` trigger

**Files:**
- Create: `supabase/migrations/20260620130000_ensure_shift_session_trigger.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260620130000_ensure_shift_session_trigger.sql
-- ADR-0367 §5.6. NULL-guards for ad-hoc/unassigned shifts.
-- Does NOT create department_session — that path stays with session-open.

CREATE OR REPLACE FUNCTION public.ensure_shift_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id    UUID;
  v_session_id       UUID;
  v_shift_session_id UUID;
BEGIN
  IF NEW.employee_id IS NULL
     OR NEW.location_id IS NULL
     OR NEW.shift_date IS NULL
  THEN
    RETURN NEW;
  END IF;

  v_department_id := COALESCE(
    NEW.department_id,
    (SELECT p.department_id FROM public.position p WHERE p.position_id = NEW.position_id)
  );
  IF v_department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ds.department_session_id INTO v_session_id
  FROM public.department_session ds
  WHERE ds.workspace_id = NEW.workspace_id
    AND ds.department_id = v_department_id
    AND ds.session_date = NEW.shift_date
  LIMIT 1;
  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shift_session (
    workspace_id, department_session_id, schedule_shift_id, employee_id,
    business_date, location_id, department_id, status, push_topic
  )
  VALUES (
    NEW.workspace_id,
    v_session_id,
    NEW.schedule_shift_id,
    NEW.employee_id,
    NEW.shift_date,
    NEW.location_id,
    v_department_id,
    'scheduled',
    'shift_session:' || gen_random_uuid()::text
  )
  ON CONFLICT (schedule_shift_id) DO NOTHING
  RETURNING shift_session_id INTO v_shift_session_id;

  IF v_shift_session_id IS NULL THEN
    SELECT shift_session_id INTO v_shift_session_id
    FROM public.shift_session
    WHERE schedule_shift_id = NEW.schedule_shift_id;
  END IF;

  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT v_shift_session_id, dl.day_line_id
  FROM public.day_line dl
  WHERE dl.department_session_id = v_session_id
    AND dl.location_id = NEW.location_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_shift_session
  AFTER INSERT OR UPDATE OF location_id, position_id, department_id, employee_id, shift_date
    ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.ensure_shift_session();
```

- [ ] **Step 2: Apply + integration test**

```bash
npx supabase db reset 2>&1 | tail -5
# Synthetic test: insert NULL-location shift → no shift_session
# (use psql; full test in BT3-3)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620130000_ensure_shift_session_trigger.sql
git commit -m "feat(day-line): BT3-1 ensure_shift_session trigger with NULL-guards (ADR-0367 §5.6)"
```

#### Task BT3-2: Counterpart trigger — day_line INSERT back-populates junction

**Files:**
- Create: `supabase/migrations/20260620130100_day_line_back_populate_trigger.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260620130100_day_line_back_populate_trigger.sql
-- ADR-0367 §5.6 counterpart. When a day_line is INSERTed, back-populate
-- shift_session_day_line for any already-active shift_sessions at that
-- (department_session_id, location_id).

CREATE OR REPLACE FUNCTION public.back_populate_shift_session_day_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT ss.shift_session_id, NEW.day_line_id
  FROM public.shift_session ss
  WHERE ss.department_session_id = NEW.department_session_id
    AND ss.location_id = NEW.location_id
    AND ss.status IN ('scheduled', 'clocked_in')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_day_line_back_populate
  AFTER INSERT ON public.day_line
  FOR EACH ROW EXECUTE FUNCTION public.back_populate_shift_session_day_line();
```

- [ ] **Step 2: Apply + commit**

```bash
npx supabase db reset 2>&1 | tail -5
git add supabase/migrations/20260620130100_day_line_back_populate_trigger.sql
git commit -m "feat(day-line): BT3-2 day_line INSERT back-populates junction (ADR-0367 §5.6)"
```

#### Task BT3-3: Integration test for triggers

**Files:**
- Create: `apps/e2e/db/triggers/shift-session-trigger.spec.ts`

- [ ] **Step 1: Write test**

```ts
// apps/e2e/db/triggers/shift-session-trigger.spec.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createServiceClient } from "../helpers/clients";

describe("ensure_shift_session trigger", () => {
  const sb = createServiceClient();
  let workspaceId: string;
  let departmentId: string;
  let locationId: string;
  let profileId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Use seed workspace; adjust based on local seed.
    const { data: w } = await sb.from("workspace").select("workspace_id").limit(1).single();
    workspaceId = w!.workspace_id;
    const { data: d } = await sb.from("department").select("department_id").eq("workspace_id", workspaceId).limit(1).single();
    departmentId = d!.department_id;
    const { data: l } = await sb.from("location").select("location_id").eq("workspace_id", workspaceId).limit(1).single();
    locationId = l!.location_id;
    const { data: p } = await sb.from("profile").select("profile_id").eq("workspace_id", workspaceId).limit(1).single();
    profileId = p!.profile_id;
    // Ensure pairing exists
    await sb.from("department_location").insert({ department_id: departmentId, location_id: locationId }).select();
    // Ensure department_session exists
    const { data: ds } = await sb.from("department_session")
      .insert({ workspace_id: workspaceId, department_id: departmentId, session_date: "2026-06-30" })
      .select("department_session_id").single();
    sessionId = ds!.department_session_id;
  });

  it("skips insert when location_id is NULL", async () => {
    const { data } = await sb.from("schedule_shift").insert({
      workspace_id: workspaceId,
      department_id: departmentId,
      employee_id: profileId,
      shift_date: "2026-06-30",
      location_id: null,
      start_time: "08:00", end_time: "16:00",
    }).select("schedule_shift_id").single();
    const { count } = await sb.from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", data!.schedule_shift_id);
    expect(count).toBe(0);
  });

  it("creates shift_session + junction when all fields present", async () => {
    const { data } = await sb.from("schedule_shift").insert({
      workspace_id: workspaceId,
      department_id: departmentId,
      employee_id: profileId,
      shift_date: "2026-06-30",
      location_id: locationId,
      start_time: "10:00", end_time: "18:00",
    }).select("schedule_shift_id").single();
    const { count: ssCount } = await sb.from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", data!.schedule_shift_id);
    expect(ssCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @smartout/e2e test db/triggers/shift-session-trigger.spec.ts 2>&1 | tail -10
git add apps/e2e/db/triggers/shift-session-trigger.spec.ts
git commit -m "test(day-line): BT3-3 integration tests for shift-session triggers"
```

#### Task BT3-4: Close BT3 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-triggers
gh pr create --base campaign/ui-shell --head feat/day-line-triggers \
  --title "feat(day-line): BT3 triggers — shift_session sync + counterpart" \
  --body "Phase B Team 3 — ensure_shift_session + day_line back-populate. ADR-0367 §5.6."
```

### B-Team-4: Telemetry registry + intent-classifier (ADR-0112 5th gate)

**Agent:** `system-agent-coordinator` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-bt4` @ `feat/day-line-telemetry`.

#### Task BT4-1: Add 9 events to `SmartoutEvent` union

**Files:**
- Modify: `packages/telemetry/src/registry.ts` (around line 7889 for union, 10458 for routing)

- [ ] **Step 1: Add union members**

Locate `export type SmartoutEvent =` (line 7889). Append 9 new entries before the closing `;`:

```ts
  | { event: "day_line.created"; workspace_id: string; actor_id: string; entity_id: string; day_line_id: string; department_session_id: string; location_id: string; department_id: string; planned_open: string; planned_close: string }
  | { event: "day_line.opening_changed"; workspace_id: string; actor_id: string; entity_id: string; day_line_id: string; old: string; new: string }
  | { event: "day_line.closing_changed"; workspace_id: string; actor_id: string; entity_id: string; day_line_id: string; old: string; new: string }
  | { event: "day_line_item.added"; workspace_id: string; actor_id: string; entity_id: string; item_type: "task" | "routine"; delegated_to_id: string }
  | { event: "day_line_item.notified"; workspace_id: string; actor_id: string; entity_id: string; item_id: string; shift_session_id: string; employee_id: string }
  | { event: "shift_session.bound"; workspace_id: string; actor_id: string; entity_id: string; shift_session_id: string; day_line_ids: string[] }
  | { event: "shift_session.clocked_in"; workspace_id: string; actor_id: string; entity_id: string; shift_session_id: string; clocked_in_at: string }
  | { event: "shift_session.clocked_out"; workspace_id: string; actor_id: string; entity_id: string; shift_session_id: string; clocked_out_at: string }
  | { event: "routine.attached"; workspace_id: string; actor_id: string; entity_id: string; template_id?: string; items_applied: number }
  | { event: "org.dept_areas_updated"; workspace_id: string; actor_id: string; entity_id: string; department_id: string; location_id: string; action: "add" | "remove" }
  | { event: "shift_session.item_leak_detected"; workspace_id: string; actor_id: string; entity_id: string; offending_day_line_id: string }
```

- [ ] **Step 2: Add `EVENT_ROUTING` entries**

Locate `export const EVENT_ROUTING` (line 10458). Append:

```ts
  "day_line.created":                { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: false },
  "day_line.opening_changed":        { destinations: ["posthog", "logger", "activity_trail"],                  idempotent: false },
  "day_line.closing_changed":        { destinations: ["posthog", "logger", "activity_trail"],                  idempotent: false },
  "day_line_item.added":             { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: false },
  "day_line_item.notified":          { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: true  },
  "shift_session.bound":             { destinations: ["posthog", "logger", "activity_trail"],                  idempotent: false },
  "shift_session.clocked_in":        { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: false },
  "shift_session.clocked_out":       { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: false },
  "routine.attached":                { destinations: ["posthog", "logger", "activity_trail", "engine_event"], idempotent: false },
  "org.dept_areas_updated":          { destinations: ["posthog", "logger", "activity_trail"],                  idempotent: false },
  "shift_session.item_leak_detected": { destinations: ["posthog", "logger", "activity_trail"],                  idempotent: false },
```

- [ ] **Step 3: Build + verify ADR-0377 (emit-coverage script)**

```bash
pnpm --filter @smartout/telemetry build 2>&1 | tail -5
node scripts/check-telemetry-emit-coverage.ts 2>&1 | tail -20
```

Expected: build green; coverage script reports new events with note "emit() call-sites pending in Phase B sub-sorties" (acceptable until other teams merge).

- [ ] **Step 4: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): BT4-1 register 9 day_line/shift_session events (ADR-0377, ADR-0367)"
```

#### Task BT4-2: Add 5 capabilities to intent-classifier (ADR-0112 gate)

**Files:**
- Modify: `packages/ai/src/router/tool-selector.ts` (intent enum)
- Modify: `packages/ai/src/router/check-intent-coverage.ts` (DOCUMENTED_TOOLLESS or system-prompt list)
- Modify: `packages/ai/src/router/system-prompt.ts` (prose mention of new capabilities)

- [ ] **Step 1: Add enum entries**

In `tool-selector.ts`, locate the `INTENT` enum / `Intent` type and add:

```ts
  | "day_line.create"
  | "day_line.add_item"
  | "day_line.instantiate_template"
  | "routine.attach_to_line"
  | "org.update_dept_areas"
```

- [ ] **Step 2: Add system-prompt prose**

In `system-prompt.ts`, append to the "Capabilities" section:

```
- day-line.* — Manager creates per-area daily plans (day_lines), adds task/routine items, instantiates templates.
- routine.attach_to_line — Manager attaches routine items to an existing day_line.
- org.update_dept_areas — Admin pairs departments to locations.
```

- [ ] **Step 3: Run intent-coverage gate**

```bash
pnpm --filter @smartout/ai test router/check-intent-coverage.ts 2>&1 | tail -10
```

Expected: PASS — no missing-intent errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/router/tool-selector.ts packages/ai/src/router/check-intent-coverage.ts packages/ai/src/router/system-prompt.ts
git commit -m "feat(router): BT4-2 5 day-line capabilities in intent-classifier (ADR-0112 L-0292 5th)"
```

#### Task BT4-3: Close BT4 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-telemetry
gh pr create --base campaign/ui-shell --head feat/day-line-telemetry \
  --title "feat(day-line): BT4 telemetry + intent-classifier" \
  --body "Phase B Team 4 — 9 telemetry events + 5 intent enum entries. ADR-0377 + ADR-0112 (L-0292 5th)."
```

**Phase B Gate (must all pass before dispatching Phase C/D/E):**

- [ ] All 4 BT PRs merged to `campaign/ui-shell`
- [ ] `pnpm --filter @smartout/ai test` green across day-line, routine, org, task, hms
- [ ] `pnpm --filter web typecheck` green
- [ ] `node scripts/check-telemetry-emit-coverage.ts` green (with emit-sites now landed by other teams)
- [ ] `pnpm --filter @smartout/e2e test db/triggers/` green
- [ ] No direct `supabase.from("day_line").insert()` outside `packages/ai/src/capabilities/day-line/tools.ts` (grep verify)
- [ ] No direct `supabase.from("session_task").insert()` in `packages/ai/src/capabilities/routine/` (L-0240 gate)
- [ ] ADR-0112 intent-coverage script green

---

## Phase C — Web UI Rewire (PARALLEL ×3)

**Dispatch:** 3 sub-sortier in parallel against `campaign/ui-shell`. Pre-flight: pull post-Phase-B merge.

**Pre-flight (all C teams):**
```bash
cd ~/dev/smartout.ai-ui-shell
git pull origin campaign/ui-shell  # gets BT1-BT4 merged
pnpm install
pnpm --filter @smartout/supabase build && pnpm --filter @smartout/telemetry build && pnpm --filter @smartout/ai build
```

### C-Team-1: TimelineTab multi-strip refactor + SlotPicker wire

**Agent:** `frontend-designer` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-ct1` @ `feat/day-line-timeline-tab`.

**Skill triggers:** `smartout-nordic-split` (mandatory — touches `apps/web/src/components/day/`).

#### Task CT1-1: New `useDayLines` is on C-Team-3 — stub it for typing here

**Files:**
- Create: `apps/web/src/components/day/_hooks/use-day-lines.types.ts` (shared type definition, owned by C-T1 to unblock both C-T1 and C-T3)

- [ ] **Step 1: Create shared type**

```ts
// apps/web/src/components/day/_hooks/use-day-lines.types.ts
// ADR-0367. Shared shape for day_line query result — both useDayLines + DayLineStrip consume.

export type DayLineRow = {
  day_line_id: string;
  workspace_id: string;
  department_session_id: string;
  department_id: string;
  location_id: string;
  business_date: string;
  planned_open: string;
  planned_close: string;
  source_template_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  is_backfilled: boolean;
  // Joined fields:
  location: { name: string };
  department: { name: string };
};

export type DayLineStatus = "draft" | "active" | "closed" | "locked" | "cancelled";
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/day/_hooks/use-day-lines.types.ts
git commit -m "feat(day-line): CT1-1 shared DayLineRow type for use-day-lines + strip components"
```

#### Task CT1-2: `derive-day-line-status.ts` helper

**Files:**
- Create: `apps/web/src/lib/cascade/derive-day-line-status.ts`

- [ ] **Step 1: Write helper + test**

```ts
// apps/web/src/lib/cascade/derive-day-line-status.ts
// ADR-0367 Rule 1 — day_line_status DERIVED at read time from:
//   - parent department_session.status
//   - daily_reconciliation.locked (for the (workspace, date))
//   - day_line.cancelled_at
// No stored column.

import type { DayLineRow, DayLineStatus } from "@/components/day/_hooks/use-day-lines.types";

export type DeriveInput = {
  line: Pick<DayLineRow, "cancelled_at" | "business_date">;
  sessionStatus: "draft" | "open" | "closed";  // department_session.status
  reconciliationLocked: boolean;
};

export function deriveDayLineStatus(input: DeriveInput): DayLineStatus {
  if (input.reconciliationLocked) return "locked";
  if (input.line.cancelled_at) return "cancelled";
  if (input.sessionStatus === "draft")  return "draft";
  if (input.sessionStatus === "closed") return "closed";
  return "active";
}
```

```ts
// apps/web/src/lib/cascade/__tests__/derive-day-line-status.test.ts
import { describe, it, expect } from "vitest";
import { deriveDayLineStatus } from "../derive-day-line-status";

describe("deriveDayLineStatus", () => {
  const base = { line: { cancelled_at: null, business_date: "2026-05-18" }, sessionStatus: "open" as const, reconciliationLocked: false };
  it("locked when reconciliation locked", () => expect(deriveDayLineStatus({ ...base, reconciliationLocked: true })).toBe("locked"));
  it("cancelled when cancelled_at set", () => expect(deriveDayLineStatus({ ...base, line: { ...base.line, cancelled_at: "2026-05-18T00:00:00Z" } })).toBe("cancelled"));
  it("draft when session draft", () => expect(deriveDayLineStatus({ ...base, sessionStatus: "draft" })).toBe("draft"));
  it("closed when session closed", () => expect(deriveDayLineStatus({ ...base, sessionStatus: "closed" })).toBe("closed"));
  it("active when session open + not cancelled + not locked", () => expect(deriveDayLineStatus(base)).toBe("active"));
});
```

- [ ] **Step 2: Test + commit**

```bash
pnpm --filter web test lib/cascade/__tests__/derive-day-line-status.test.ts 2>&1 | tail -10
git add apps/web/src/lib/cascade/derive-day-line-status.ts apps/web/src/lib/cascade/__tests__/derive-day-line-status.test.ts
git commit -m "feat(day-line): CT1-2 derive-day-line-status helper (ADR-0367 Rule 1)"
```

#### Task CT1-3: `DayLineStripHeader` component

**Files:**
- Create: `apps/web/src/components/day/DayLineStripHeader.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/DayLineStripHeader.tsx
"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DayLineRow, DayLineStatus } from "./_hooks/use-day-lines.types";

type Props = {
  line: DayLineRow;
  status: DayLineStatus;
  onEditHours: () => void;
  readOnly: boolean;
};

const STATUS_LABEL: Record<DayLineStatus, string> = {
  draft: "Utkast", active: "Aktiv", closed: "Lukket", locked: "Låst", cancelled: "Avbrutt",
};

export function DayLineStripHeader({ line, status, onEditHours, readOnly }: Props) {
  return (
    <header
      data-testid={`day-line-strip-header-${line.day_line_id}`}
      className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2"
    >
      <div className="flex items-baseline gap-3">
        <h3 className="font-heading text-lg leading-tight text-foreground">{line.location.name}</h3>
        <span className="text-xs text-muted-foreground">{line.department.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-foreground">
          {line.planned_open.slice(0, 5)} – {line.planned_close.slice(0, 5)}
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {STATUS_LABEL[status]}
        </span>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            data-testid={`day-line-edit-hours-${line.day_line_id}`}
            onClick={onEditHours}
            aria-label={`Endre åpningstider for ${line.location.name}`}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/day/DayLineStripHeader.tsx
git commit -m "feat(day-line): CT1-3 DayLineStripHeader (Nordic Split tokens)"
```

#### Task CT1-4: `DayLineStrip` wrapper

**Files:**
- Create: `apps/web/src/components/day/DayLineStrip.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/DayLineStrip.tsx
"use client";

import { useState } from "react";
import { DayLineStripHeader } from "./DayLineStripHeader";
import { OpenCloseEditPopover } from "./OpenCloseEditPopover";
import { SlotPicker } from "./SlotPicker";
import { deriveDayLineStatus } from "@/lib/cascade/derive-day-line-status";
import type { DayLineRow } from "./_hooks/use-day-lines.types";

type Props = {
  line: DayLineRow;
  sessionStatus: "draft" | "open" | "closed";
  reconciliationLocked: boolean;
  canEdit: boolean;
};

export function DayLineStrip({ line, sessionStatus, reconciliationLocked, canEdit }: Props) {
  const [editingHours, setEditingHours] = useState(false);
  const status = deriveDayLineStatus({ line, sessionStatus, reconciliationLocked });
  const readOnly = !canEdit || status === "locked" || status === "closed";

  return (
    <section
      data-testid={`day-line-strip-${line.day_line_id}`}
      className="overflow-hidden rounded-lg border border-border bg-background"
    >
      <DayLineStripHeader
        line={line}
        status={status}
        readOnly={readOnly}
        onEditHours={() => setEditingHours(true)}
      />
      {editingHours && (
        <OpenCloseEditPopover
          line={line}
          onClose={() => setEditingHours(false)}
        />
      )}
      <SlotPicker
        dayLineId={line.day_line_id}
        plannedOpen={line.planned_open}
        plannedClose={line.planned_close}
        readOnly={readOnly}
      />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/day/DayLineStrip.tsx
git commit -m "feat(day-line): CT1-4 DayLineStrip wrapper component"
```

#### Task CT1-5: Refactor `TimelineTab.tsx` to multi-strip stack

**Files:**
- Modify: `apps/web/src/components/day/tabs/TimelineTab.tsx`

- [ ] **Step 1: Read existing TimelineTab**

```bash
sed -n '1,80p' apps/web/src/components/day/tabs/TimelineTab.tsx
```

- [ ] **Step 2: Rewrite TimelineTab body**

Replace the file body with multi-strip rendering. Keep existing props if present.

```tsx
// apps/web/src/components/day/tabs/TimelineTab.tsx
"use client";

import { DayLineStrip } from "../DayLineStrip";
import { useDayLines } from "../_hooks/use-day-lines";
import { Skeleton } from "@/components/ui/skeleton";
import { NoSessionCTA } from "../NoSessionCTA";

type Props = {
  workspaceId: string;
  date: string;
  selectedDepartmentIds: string[];
  selectedLocationIds: string[];
  sessionStatus: "draft" | "open" | "closed";
  reconciliationLocked: boolean;
  canEdit: boolean;
};

export function TimelineTab(props: Props) {
  const { data, isLoading } = useDayLines({
    workspaceId: props.workspaceId,
    date: props.date,
    departmentIds: props.selectedDepartmentIds,
    locationIds: props.selectedLocationIds,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="timeline-tab-loading">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <NoSessionCTA />;
  }

  return (
    <div className="space-y-3" data-testid="timeline-tab-strips">
      {data.map((line) => (
        <DayLineStrip
          key={line.day_line_id}
          line={line}
          sessionStatus={props.sessionStatus}
          reconciliationLocked={props.reconciliationLocked}
          canEdit={props.canEdit}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Modify SlotPicker to accept dayLineId**

In `apps/web/src/components/day/SlotPicker.tsx`, add a required `dayLineId` prop and forward to action calls.

```bash
grep -n "function SlotPicker\|interface .*Props\|type .*Props" apps/web/src/components/day/SlotPicker.tsx | head
```

Add the prop to its props type:

```ts
type SlotPickerProps = {
  dayLineId: string;
  plannedOpen: string;
  plannedClose: string;
  readOnly: boolean;
  // ...existing props
};
```

Forward `dayLineId` when calling `addDayLineItemAction` from inside SlotPicker dialogs.

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -10
git add apps/web/src/components/day/tabs/TimelineTab.tsx apps/web/src/components/day/SlotPicker.tsx
git commit -m "feat(day-line): CT1-5 TimelineTab multi-strip + SlotPicker dayLineId wire"
```

#### Task CT1-6: Close CT1 sub-sortie

- [ ] **Step 1: Visual smoke**

```bash
pnpm --filter web dev
# Open http://localhost:3060/dashboard/day
# Verify multi-strip renders + edit-hours button visible per strip
```

- [ ] **Step 2: Push + PR**

```bash
git push origin feat/day-line-timeline-tab
gh pr create --base campaign/ui-shell --head feat/day-line-timeline-tab \
  --title "feat(day-line): CT1 multi-strip TimelineTab + SlotPicker wire" \
  --body "Phase C Team 1 — ADR-0367 W1-W3 + W6 + W11 (Nordic Split)."
```

### C-Team-2: 3 new dialogs (Create / AttachRoutine / OpenClosePopover)

**Agent:** `frontend-designer` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-ct2` @ `feat/day-line-dialogs`.

#### Task CT2-1: `OpenCloseEditPopover`

**Files:**
- Create: `apps/web/src/components/day/OpenCloseEditPopover.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/OpenCloseEditPopover.tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateDayLineHoursAction } from "@/app/dashboard/_actions/update-day-line-hours-action";
import { toast } from "sonner";
import type { DayLineRow } from "./_hooks/use-day-lines.types";

type Props = { line: DayLineRow; onClose: () => void };

export function OpenCloseEditPopover({ line, onClose }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(line.planned_open.slice(0, 5));
  const [close, setClose] = useState(line.planned_close.slice(0, 5));

  const mutation = useMutation({
    mutationFn: () => updateDayLineHoursAction({ day_line_id: line.day_line_id, planned_open: open, planned_close: close }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["day-lines"] });
      toast.success("Åpningstider oppdatert");
      onClose();
    },
    onError: (e) => toast.error(`Feil: ${(e as Error).message}`),
  });

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverTrigger asChild><span /></PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-64 space-y-3"
        data-testid={`open-close-popover-${line.day_line_id}`}
      >
        <div className="space-y-1">
          <Label htmlFor={`open-${line.day_line_id}`}>Åpner</Label>
          <Input id={`open-${line.day_line_id}`} type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`close-${line.day_line_id}`}>Stenger</Label>
          <Input id={`close-${line.day_line_id}`} type="time" value={close} onChange={(e) => setClose(e.target.value)} />
        </div>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Lagrer…" : "Lagre"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Create the action it depends on**

```ts
// apps/web/src/app/dashboard/_actions/update-day-line-hours-action.ts
"use server";

import { z } from "zod";
import { getServerContext } from "./helpers/get-server-context";
import { callCapabilityTool } from "@smartout/ai/server";

const InputSchema = z.object({
  day_line_id: z.string().uuid(),
  planned_open: z.string().regex(/^\d{2}:\d{2}$/),
  planned_close: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function updateDayLineHoursAction(input: z.infer<typeof InputSchema>) {
  const parsed = InputSchema.parse(input);
  const ctx = await getServerContext();
  return callCapabilityTool({ capability: "day-line", name: "update_hours", input: parsed, ctx });
}
```

> NOTE: This implies a fourth tool `day-line.update_hours`. Add it to BT1 capability tools.ts if not present. C-T2 surfaces this need to B-T1 via comment in PR.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/components/day/OpenCloseEditPopover.tsx apps/web/src/app/dashboard/_actions/update-day-line-hours-action.ts
git commit -m "feat(day-line): CT2-1 OpenCloseEditPopover + update-hours action"
```

#### Task CT2-2: `DayLineCreateSheet`

**Files:**
- Create: `apps/web/src/components/day/DayLineCreateSheet.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/DayLineCreateSheet.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDayLineAction } from "@/app/dashboard/_actions/create-day-line-action";
import { toast } from "sonner";
import { createBrowserClient } from "@smartout/supabase/browser";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departmentId: string;
  departmentSessionId: string;
};

export function DayLineCreateSheet({ open, onOpenChange, departmentId, departmentSessionId }: Props) {
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const sb = createBrowserClient();

  const locationsQ = useQuery({
    queryKey: ["dept-locations", departmentId],
    queryFn: async () => {
      const { data } = await sb
        .from("department_location")
        .select("location:location_id(location_id, name)")
        .eq("department_id", departmentId);
      return data ?? [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => createDayLineAction({
      department_session_id: departmentSessionId,
      location_id: locationId,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["day-lines"] });
      toast.success("Dagslinje opprettet");
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Feil: ${(e as Error).message}`),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-testid="day-line-create-sheet">
        <SheetHeader><SheetTitle>Ny dagslinje</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="location">Område</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location" data-testid="location-picker"><SelectValue placeholder="Velg område" /></SelectTrigger>
              <SelectContent>
                {(locationsQ.data ?? []).map((row) => (
                  <SelectItem key={row.location.location_id} value={row.location.location_id}>
                    {row.location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notater</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button disabled={!locationId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Oppretter…" : "Opprett"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/day/DayLineCreateSheet.tsx
git commit -m "feat(day-line): CT2-2 DayLineCreateSheet"
```

#### Task CT2-3: `AttachRoutineDialog`

**Files:**
- Create: `apps/web/src/components/day/AttachRoutineDialog.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/AttachRoutineDialog.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { instantiateTemplateAction } from "@/app/dashboard/_actions/instantiate-template-action";
import { toast } from "sonner";
import { createBrowserClient } from "@smartout/supabase/browser";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dayLineId: string;
  locationId: string;
};

export function AttachRoutineDialog({ open, onOpenChange, dayLineId, locationId }: Props) {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState<string>("");
  const sb = createBrowserClient();

  const templatesQ = useQuery({
    queryKey: ["templates-for-location", locationId],
    queryFn: async () => {
      const { data } = await sb
        .from("timeline_template")
        .select("id, name, items_json")
        .eq("scope_type", "location")
        .eq("scope_id", locationId);
      return data ?? [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => instantiateTemplateAction({ day_line_id: dayLineId, template_id: templateId }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["day-lines"] });
      qc.invalidateQueries({ queryKey: ["calendar-items"] });
      toast.success(`${result.applied} oppgaver lagt til`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Feil: ${(e as Error).message}`),
  });

  const selectedTemplate = templatesQ.data?.find((t) => t.id === templateId);
  const itemCount = Array.isArray(selectedTemplate?.items_json) ? selectedTemplate.items_json.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="attach-routine-dialog">
        <DialogHeader><DialogTitle>Legg til rutine</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="template">Mal</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="template" data-testid="template-picker"><SelectValue placeholder="Velg mal" /></SelectTrigger>
              <SelectContent>
                {(templatesQ.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {templateId && (
            <p className="text-sm text-muted-foreground" data-testid="template-preview">
              {itemCount} oppgaver vil bli lagt til
            </p>
          )}
          <Button disabled={!templateId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Legger til…" : "Legg til"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/components/day/AttachRoutineDialog.tsx
git commit -m "feat(day-line): CT2-3 AttachRoutineDialog (timeline_template scope=location)"
```

#### Task CT2-4: Close CT2 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-dialogs
gh pr create --base campaign/ui-shell --head feat/day-line-dialogs \
  --title "feat(day-line): CT2 3 dialogs (Create / AttachRoutine / EditHours)" \
  --body "Phase C Team 2 — ADR-0367 W3, W4, W5."
```

### C-Team-3: ScopeFilterPopover multi-select + useDayLines + Aggregated overview

**Agent:** `frontend-designer` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-ct3` @ `feat/day-line-scope-aggregated`.

#### Task CT3-1: Refactor `ScopeFilterPopover` to multi-select

**Files:**
- Modify: `apps/web/src/components/day/ScopeFilterPopover.tsx`

- [ ] **Step 1: Read existing**

```bash
sed -n '1,60p' apps/web/src/components/day/ScopeFilterPopover.tsx
```

- [ ] **Step 2: Rewrite with multi-select per dimension**

Replace the file body:

```tsx
// apps/web/src/components/day/ScopeFilterPopover.tsx
"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";

export type ScopeSelection = {
  departmentIds: string[];
  locationIds: string[];
  shiftIds: string[];  // currently active shift filter
};

type Option = { id: string; name: string };

type Props = {
  selection: ScopeSelection;
  onChange: (next: ScopeSelection) => void;
  departments: Option[];
  locations: Option[];
  shifts: Option[];
};

export function ScopeFilterPopover({ selection, onChange, departments, locations, shifts }: Props) {
  const toggle = (key: keyof ScopeSelection, id: string) => {
    const current = selection[key];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...selection, [key]: next });
  };

  const totalSelected = selection.departmentIds.length + selection.locationIds.length + selection.shiftIds.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="scope-filter-trigger">
          <Filter className="mr-2 size-4" />
          Filter {totalSelected > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{totalSelected}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" data-testid="scope-filter-popover">
        <section className="space-y-3">
          <Dim title="Avdeling" options={departments} selected={selection.departmentIds} onToggle={(id) => toggle("departmentIds", id)} testid="dim-department" />
          <Dim title="Område" options={locations} selected={selection.locationIds} onToggle={(id) => toggle("locationIds", id)} testid="dim-location" />
          <Dim title="Vakt" options={shifts} selected={selection.shiftIds} onToggle={(id) => toggle("shiftIds", id)} testid="dim-shift" />
        </section>
        {totalSelected > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            data-testid="scope-filter-clear"
            onClick={() => onChange({ departmentIds: [], locationIds: [], shiftIds: [] })}
          >
            Nullstill
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Dim({ title, options, selected, onToggle, testid }: { title: string; options: Option[]; selected: string[]; onToggle: (id: string) => void; testid: string }) {
  return (
    <div className="space-y-2" data-testid={testid}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-2">
            <Checkbox
              id={`${testid}-${o.id}`}
              checked={selected.includes(o.id)}
              onCheckedChange={() => onToggle(o.id)}
            />
            <label htmlFor={`${testid}-${o.id}`} className="text-sm">{o.name}</label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/components/day/ScopeFilterPopover.tsx
git commit -m "feat(day-line): CT3-1 ScopeFilterPopover multi-select (OR within / AND between)"
```

#### Task CT3-2: `useDayLines` hook

**Files:**
- Create: `apps/web/src/components/day/_hooks/use-day-lines.ts`

- [ ] **Step 1: Write hook**

```ts
// apps/web/src/components/day/_hooks/use-day-lines.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@smartout/supabase/browser";
import type { DayLineRow } from "./use-day-lines.types";

type Params = {
  workspaceId: string;
  date: string;
  departmentIds?: string[];
  locationIds?: string[];
};

export function useDayLines(p: Params) {
  const sb = createBrowserClient();
  return useQuery({
    queryKey: ["day-lines", { wid: p.workspaceId, date: p.date, depts: p.departmentIds, locs: p.locationIds }],
    queryFn: async (): Promise<DayLineRow[]> => {
      let q = sb
        .from("day_line")
        .select(`
          day_line_id, workspace_id, department_session_id, department_id, location_id,
          business_date, planned_open, planned_close, source_template_id, notes,
          cancelled_at, is_backfilled,
          location:location_id(name),
          department:department_id(name)
        `)
        .eq("workspace_id", p.workspaceId)
        .eq("business_date", p.date)
        .order("location(name)", { ascending: true })
        .order("planned_open", { ascending: true });

      if (p.departmentIds?.length) q = q.in("department_id", p.departmentIds);
      if (p.locationIds?.length)   q = q.in("location_id",   p.locationIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DayLineRow[];
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/components/day/_hooks/use-day-lines.ts
git commit -m "feat(day-line): CT3-2 useDayLines hook"
```

#### Task CT3-3: `AggregatedDayLineList` (no-scope overview)

**Files:**
- Create: `apps/web/src/components/day/AggregatedDayLineList.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/components/day/AggregatedDayLineList.tsx
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDayLines } from "./_hooks/use-day-lines";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { workspaceId: string; date: string };

export function AggregatedDayLineList({ workspaceId, date }: Props) {
  const { data, isLoading } = useDayLines({ workspaceId, date });

  if (isLoading) return <Skeleton className="h-48" />;
  if (!data || data.length === 0) return <p className="text-muted-foreground">Ingen dagslinjer.</p>;

  return (
    <Accordion type="multiple" data-testid="aggregated-day-line-list">
      {data.map((line) => (
        <AccordionItem key={line.day_line_id} value={line.day_line_id}>
          <AccordionTrigger data-testid={`agg-trigger-${line.day_line_id}`}>
            <span className="flex w-full items-center justify-between pr-2">
              <span className="font-medium">{line.location.name}</span>
              <span className="text-xs text-muted-foreground">{line.department.name} · {line.planned_open.slice(0,5)}–{line.planned_close.slice(0,5)}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">Forhåndsvisning av neste 3 oppgaver kommer her (Phase D).</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

- [ ] **Step 2: Commit**

```bash
pnpm --filter web typecheck 2>&1 | tail -5
git add apps/web/src/components/day/AggregatedDayLineList.tsx
git commit -m "feat(day-line): CT3-3 AggregatedDayLineList (no-scope accordion overview)"
```

#### Task CT3-4: Close CT3 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-scope-aggregated
gh pr create --base campaign/ui-shell --head feat/day-line-scope-aggregated \
  --title "feat(day-line): CT3 ScopeFilter multi-select + useDayLines + Aggregated overview" \
  --body "Phase C Team 3 — ADR-0367 W7, W8, W9."
```

**Phase C Gate:**

- [ ] All 3 CT PRs merged
- [ ] `pnpm --filter web typecheck` green
- [ ] `pnpm --filter web lint` green (Nordic Split tokens, no OKLCH literals)
- [ ] Manual smoke: `/dashboard/day` renders N strips for N day_lines
- [ ] Manual smoke: ScopeFilter multi-select works OR-within / AND-between
- [ ] Manual smoke: No-scope aggregated view collapses cleanly on small viewport

---

## Phase D — Mobile (PARALLEL ×1)

**Agent:** `botsson-harness-builder` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-dt1` @ `feat/day-line-mobile`.

**Skill triggers:** `vercel-react-native-skills` (mobile patterns).
**ADR invariants:** ADR-0133 (web composes, mobile executes — NO authoring), ADR-0134 (telemetry contract — `workspace_id`+`actor_id` MUST resolve via `getProfileContext()` fail-fast).

#### Task DT1-1: `useShiftSession` hook

**Files:**
- Create: `apps/mobile/src/hooks/queries/use-shift-session.ts`

- [ ] **Step 1: Write hook**

```ts
// apps/mobile/src/hooks/queries/use-shift-session.ts
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";

export type ShiftSessionRow = {
  shift_session_id: string;
  workspace_id: string;
  schedule_shift_id: string;
  business_date: string;
  status: "scheduled" | "clocked_in" | "clocked_out" | "cancelled";
  push_topic: string | null;
  day_lines: { day_line_id: string; location: { name: string }; planned_open: string; planned_close: string }[];
};

export function useShiftSession(profileId: string, date: string) {
  const sb = getSupabase();
  return useQuery({
    queryKey: ["shift-session", profileId, date],
    queryFn: async (): Promise<ShiftSessionRow | null> => {
      const { data, error } = await sb
        .from("shift_session")
        .select(`
          shift_session_id, workspace_id, schedule_shift_id, business_date, status, push_topic,
          day_lines:shift_session_day_line(
            day_line:day_line_id(day_line_id, planned_open, planned_close, location:location_id(name))
          )
        `)
        .eq("employee_id", profileId)
        .eq("business_date", date)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        day_lines: (data.day_lines ?? []).map((j: any) => j.day_line),
      };
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
pnpm --filter @smartout/mobile typecheck 2>&1 | tail -5
git add apps/mobile/src/hooks/queries/use-shift-session.ts
git commit -m "feat(day-line): DT1-1 useShiftSession hook (mobile, ADR-0133 read-side)"
```

#### Task DT1-2: `use-day-line-items` hook

**Files:**
- Create: `apps/mobile/src/hooks/queries/use-day-line-items.ts`

- [ ] **Step 1: Write hook**

```ts
// apps/mobile/src/hooks/queries/use-day-line-items.ts
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

export type DayLineItemRow = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: string;
  day_line_id: string;
};

export function useDayLineItems(dayLineIds: string[], shiftSessionDayLineIds: Set<string>) {
  const sb = getSupabase();
  return useQuery({
    queryKey: ["day-line-items", [...dayLineIds].sort()],
    enabled: dayLineIds.length > 0,
    queryFn: async (): Promise<DayLineItemRow[]> => {
      const { data, error } = await sb
        .from("session_task")
        .select("id, title, description, scheduled_at, status, day_line_id")
        .in("day_line_id", dayLineIds)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;

      // Defensive client-side filter — drop items where day_line_id not in viewer's bound set.
      const safe: DayLineItemRow[] = [];
      for (const row of data ?? []) {
        if (row.day_line_id && shiftSessionDayLineIds.has(row.day_line_id)) {
          safe.push(row as DayLineItemRow);
        } else if (row.day_line_id) {
          // Telemetry: leak detected.
          const { workspaceId, profileId } = await getProfileContext();
          await emit("shift_session.item_leak_detected", {
            workspace_id: workspaceId,
            actor_id: profileId,
            entity_id: row.id,
            offending_day_line_id: row.day_line_id,
          });
        }
      }
      return safe;
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
pnpm --filter @smartout/mobile typecheck 2>&1 | tail -5
git add apps/mobile/src/hooks/queries/use-day-line-items.ts
git commit -m "feat(day-line): DT1-2 useDayLineItems with defensive client-side filter (ADR-0134)"
```

#### Task DT1-3: Rewire `(calendar)/day/[date].tsx` to shift_session

**Files:**
- Modify: `apps/mobile/app/(app)/(calendar)/day/[date].tsx`

- [ ] **Step 1: Read existing**

```bash
sed -n '1,60p' apps/mobile/app/\(app\)/\(calendar\)/day/\[date\].tsx 2>&1 | head -60
```

- [ ] **Step 2: Replace the render path with shift_session-driven flow**

Replace body to use `useShiftSession` + `useDayLineItems`:

```tsx
// apps/mobile/app/(app)/(calendar)/day/[date].tsx
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useShiftSession } from "@/hooks/queries/use-shift-session";
import { useDayLineItems } from "@/hooks/queries/use-day-line-items";
import { useProfile } from "@/hooks/use-profile";
import { useMemo } from "react";

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: profile } = useProfile();
  const profileId = profile?.profile_id ?? "";
  const shiftQ = useShiftSession(profileId, date as string);

  const dayLineIds = useMemo(() => (shiftQ.data?.day_lines ?? []).map((d) => d.day_line_id), [shiftQ.data]);
  const boundSet = useMemo(() => new Set(dayLineIds), [dayLineIds]);
  const itemsQ = useDayLineItems(dayLineIds, boundSet);

  if (shiftQ.isLoading) return <ActivityIndicator />;
  if (!shiftQ.data) return <View><Text>Ingen vakt på {date}</Text></View>;

  return (
    <View testID="mobile-day-screen">
      {shiftQ.data.day_lines.map((dl) => (
        <View key={dl.day_line_id} testID={`mobile-day-line-${dl.day_line_id}`}>
          <Text>{dl.location.name}</Text>
          <Text>{dl.planned_open.slice(0, 5)}–{dl.planned_close.slice(0, 5)}</Text>
        </View>
      ))}
      <FlatList
        data={itemsQ.data ?? []}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View testID={`mobile-item-${item.id}`}>
            <Text>{item.title}</Text>
            {item.scheduled_at && <Text>{new Date(item.scheduled_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}</Text>}
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
pnpm --filter @smartout/mobile typecheck 2>&1 | tail -5
git add apps/mobile/app/\(app\)/\(calendar\)/day/\[date\].tsx
git commit -m "feat(day-line): DT1-3 mobile day route reads shift_session + day_lines (ADR-0367 §M2)"
```

#### Task DT1-4: Push subscribe/unsubscribe on clock-in/out

**Files:**
- Modify: `apps/mobile/src/lib/push.ts`

- [ ] **Step 1: Add subscribe + unsubscribe helpers**

Append to `apps/mobile/src/lib/push.ts`:

```ts
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

export async function subscribeShiftSessionTopic(shiftSessionId: string, pushTopic: string) {
  // Expo doesn't have a per-topic API; we register a Notification subscription whose data carries the topic.
  // Server-side filtering by push_topic gates which devices receive each push.
  const { workspaceId, profileId } = await getProfileContext();
  await emit("shift_session.bound", {
    workspace_id: workspaceId,
    actor_id: profileId,
    entity_id: shiftSessionId,
    shift_session_id: shiftSessionId,
    day_line_ids: [],
  });
  // (token already registered at app-init; topic gating is server-side)
}

export async function unsubscribeShiftSessionTopic(shiftSessionId: string) {
  const { workspaceId, profileId } = await getProfileContext();
  // No-op on client; server-side flips shift_session.status → 'clocked_out' which gates push.
  // We still emit for audit symmetry.
  await emit("shift_session.clocked_out", {
    workspace_id: workspaceId,
    actor_id: profileId,
    entity_id: shiftSessionId,
    shift_session_id: shiftSessionId,
    clocked_out_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Wire into existing clock-in/out flow**

Locate `apps/mobile/src/components/ClockInButton.tsx` (or whatever clock-in surface exists — confirm via grep). After successful `shift-lifecycle.clock_in` capability response, call `subscribeShiftSessionTopic(shift_session_id, push_topic)`. After clock-out, call `unsubscribeShiftSessionTopic`.

```bash
grep -rn "shift-lifecycle\|clock_in" apps/mobile/src/components/ 2>&1 | head -5
```

Then add the subscribe call inline.

- [ ] **Step 3: Commit**

```bash
pnpm --filter @smartout/mobile typecheck 2>&1 | tail -5
git add apps/mobile/src/lib/push.ts apps/mobile/src/components/  # actual modified file(s)
git commit -m "feat(day-line): DT1-4 mobile push subscribe on clock-in (ADR-0367 §M4)"
```

#### Task DT1-5: `HomeShiftCard` next-3 items preview

**Files:**
- Modify: `apps/mobile/src/components/HomeShiftCard.tsx`

- [ ] **Step 1: Read existing + add preview slot**

After the card body, add:

```tsx
{shiftSession && upcomingItems.length > 0 && (
  <View testID="home-shift-card-preview">
    <Text className="text-xs uppercase text-muted-foreground">Neste</Text>
    {upcomingItems.slice(0, 3).map((it) => (
      <Text key={it.id} className="text-sm">{it.title}</Text>
    ))}
  </View>
)}
```

Where `upcomingItems` is sourced from `useDayLineItems` filtered to `scheduled_at >= now` and sliced to 3.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/HomeShiftCard.tsx
git commit -m "feat(day-line): DT1-5 HomeShiftCard preview next 3 items (ADR-0367 §M3)"
```

#### Task DT1-6: Close DT1 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
pnpm --filter @smartout/mobile test 2>&1 | tail -10
git push origin feat/day-line-mobile
gh pr create --base campaign/ui-shell --head feat/day-line-mobile \
  --title "feat(day-line): DT1 mobile shift_session + push" \
  --body "Phase D Team 1 — ADR-0367 §M1-M7. Read-side + execute-side per ADR-0133."
```

**Phase D Gate:**

- [ ] `pnpm --filter @smartout/mobile typecheck` green
- [ ] Manual smoke: PWA on localhost:8083 renders day route with shift_session
- [ ] Synthetic test: foreign-day_line_id insert → mobile filter drops + emits `shift_session.item_leak_detected`
- [ ] No `gate_action` calls in mobile (grep verify ADR-0133)

---

## Phase E — Push Pipeline (PARALLEL ×1)

**Agent:** `botsson-harness-builder` (sonnet). **Worktree:** `~/dev/smartout.ai-ui-shell-wt-et1` @ `feat/day-line-push`.

**Skill triggers:** `smartout-edge-function-guide` (mandatory — touches `supabase/functions/engine-dispatch/`).

#### Task ET1-1: New handler `day-line-push.ts`

**Files:**
- Create: `supabase/functions/engine-dispatch/handlers/day-line-push.ts`

- [ ] **Step 1: Write handler**

```ts
// supabase/functions/engine-dispatch/handlers/day-line-push.ts
// ADR-0367 §5.7. Tick handler: select session_task rows with scheduled_at in
// the current minute window, fan out push to clocked-in receivers, idempotent
// via engine_event.idempotency_key composite '<task_id>:<shift_session_id>'.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/expo.ts";

export type DispatchCtx = { sb: SupabaseClient; emit: (event: string, payload: Record<string, unknown>) => Promise<void> };

export async function dispatchDayLinePush(ctx: DispatchCtx): Promise<{ pushes_sent: number }> {
  const nowMs = Date.now();
  const windowStartIso = new Date(nowMs - 60_000).toISOString();
  const windowEndIso   = new Date(nowMs + 60_000).toISOString();

  const { data: items, error } = await ctx.sb.from("session_task").select(`
    id, title, description, day_line_id, scheduled_at, workspace_id,
    receivers:shift_session_day_line(
      shift_session:shift_session_id(
        shift_session_id, workspace_id, employee_id, status,
        profile:employee_id(expo_push_token)
      )
    )
  `)
  .gte("scheduled_at", windowStartIso)
  .lt("scheduled_at", windowEndIso)
  .not("day_line_id", "is", null)
  .eq("status", "pending");

  if (error) throw error;
  let pushesSent = 0;

  for (const item of (items ?? []) as any[]) {
    for (const r of (item.receivers ?? []) as any[]) {
      const ss = r.shift_session;
      if (!ss || ss.status !== "clocked_in") continue;
      const token = ss.profile?.expo_push_token;
      if (!token) continue;

      const idempotencyKey = `${item.id}:${ss.shift_session_id}`;
      const { data: existing } = await ctx.sb.from("engine_event")
        .select("id")
        .eq("event_type", "day_line_item.notified")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) continue;

      await sendExpoPush(token, { title: item.title, body: item.description ?? "" });

      await ctx.emit("day_line_item.notified", {
        workspace_id: ss.workspace_id,
        actor_id: "system:engine-dispatch",
        entity_id: idempotencyKey,
        item_id: item.id,
        shift_session_id: ss.shift_session_id,
        employee_id: ss.employee_id,
      });
      pushesSent++;
    }
  }

  return { pushes_sent: pushesSent };
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/engine-dispatch/handlers/day-line-push.ts
git commit -m "feat(day-line): ET1-1 engine-dispatch day-line-push handler (idempotent via engine_event.idempotency_key)"
```

#### Task ET1-2: Register handler in `engine-dispatch/index.ts`

**Files:**
- Modify: `supabase/functions/engine-dispatch/index.ts`

- [ ] **Step 1: Import + call handler in tick loop**

Locate the tick dispatch (likely a switch on handler name or an array of registered handlers). Add:

```ts
import { dispatchDayLinePush } from "./handlers/day-line-push.ts";

// inside tick():
const dayLineResult = await dispatchDayLinePush({ sb, emit });
console.log(`day-line-push: sent ${dayLineResult.pushes_sent}`);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "feat(day-line): ET1-2 register day-line-push handler in engine-dispatch"
```

#### Task ET1-3: Idempotency + skip-no-token test

**Files:**
- Create: `supabase/functions/engine-dispatch/_tests/day-line-push.test.ts`

- [ ] **Step 1: Write test**

```ts
// supabase/functions/engine-dispatch/_tests/day-line-push.test.ts
// Run with: deno test --allow-all supabase/functions/engine-dispatch/_tests/day-line-push.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dispatchDayLinePush } from "../handlers/day-line-push.ts";

Deno.test("dispatchDayLinePush: skips when push_token is null", async () => {
  const events: string[] = [];
  const result = await dispatchDayLinePush({
    sb: makeMockSb([
      { id: "t1", title: "T", description: "", day_line_id: "d1", scheduled_at: new Date().toISOString(), workspace_id: "w1",
        receivers: [{ shift_session: { shift_session_id: "s1", workspace_id: "w1", employee_id: "e1", status: "clocked_in", profile: { expo_push_token: null } } }] },
    ]),
    emit: async (event: string) => { events.push(event); },
  } as never);
  assertEquals(result.pushes_sent, 0);
  assertEquals(events.length, 0);
});

Deno.test("dispatchDayLinePush: skips when status is scheduled (not clocked_in)", async () => {
  const events: string[] = [];
  const result = await dispatchDayLinePush({
    sb: makeMockSb([
      { id: "t1", title: "T", description: "", day_line_id: "d1", scheduled_at: new Date().toISOString(), workspace_id: "w1",
        receivers: [{ shift_session: { shift_session_id: "s1", workspace_id: "w1", employee_id: "e1", status: "scheduled", profile: { expo_push_token: "tk" } } }] },
    ]),
    emit: async (e) => { events.push(e); },
  } as never);
  assertEquals(result.pushes_sent, 0);
});

Deno.test("dispatchDayLinePush: idempotency_key skip on retry", async () => {
  const seenKey = "t1:s1";
  let pushCount = 0;
  const result = await dispatchDayLinePush({
    sb: makeMockSb(
      [{ id: "t1", title: "T", description: "", day_line_id: "d1", scheduled_at: new Date().toISOString(), workspace_id: "w1",
         receivers: [{ shift_session: { shift_session_id: "s1", workspace_id: "w1", employee_id: "e1", status: "clocked_in", profile: { expo_push_token: "tk" } } }] }],
      seenKey,
    ),
    emit: async () => { pushCount++; },
  } as never);
  assertEquals(result.pushes_sent, 0);
});

function makeMockSb(items: any[], idempotencyHit?: string) { /* stub — implement against fake client */ return null as never; }
```

- [ ] **Step 2: Implement `makeMockSb` stub minimally OR run integration test against Supabase Local**

For Phase E, prefer real integration test (mocking SupabaseClient is brittle):

```bash
# Run integration: seed shift_session with clocked_in + session_task with scheduled_at=now+1min, then call dispatchDayLinePush via deno
deno run --allow-all supabase/functions/engine-dispatch/_tests/integration.ts
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/engine-dispatch/_tests/
git commit -m "test(day-line): ET1-3 idempotency + skip-no-token tests for day-line-push"
```

#### Task ET1-4: Close ET1 sub-sortie

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-push
gh pr create --base campaign/ui-shell --head feat/day-line-push \
  --title "feat(day-line): ET1 engine-dispatch push handler" \
  --body "Phase E — ADR-0367 §5.7. Idempotency via engine_event.idempotency_key."
```

**Phase E Gate:**

- [ ] Local integration test: insert task with scheduled_at=now+30s → push delivered within 1 min
- [ ] Restart engine-dispatch mid-tick: no duplicate push (`SELECT count(*) FROM engine_event WHERE event_type='day_line_item.notified' AND idempotency_key='...';` = 1)
- [ ] Synthetic case: shift_session.status='scheduled' (not clocked_in) → push skipped
- [ ] Profile with NULL expo_push_token → push skipped

---

## Phase F — Journeys + E2E + Docs (SOLO, serial)

**Agent (lead):** `system-steward` (sonnet) for E2E + docs verification. **Co-agent:** `task-assistant` for journey writing. **Worktree:** `~/dev/smartout.ai-ui-shell-wt-ft1` @ `feat/day-line-journeys-e2e`.

**Pre-flight:** All Phase B/C/D/E PRs merged to `campaign/ui-shell`. `git pull origin campaign/ui-shell`.

#### Task FT1-1: 5 journey docs

**Files:**
- Create: `docs/journeys/JOURNEY-day-line-create.md`
- Create: `docs/journeys/JOURNEY-day-line-edit-hours.md`
- Create: `docs/journeys/JOURNEY-day-line-attach-routine.md`
- Create: `docs/journeys/JOURNEY-day-line-employee-view-mobile.md`
- Create: `docs/journeys/JOURNEY-day-line-push.md`

- [ ] **Step 1: Write JOURNEY-day-line-create.md**

```markdown
---
title: Manager creates a day_line for an area
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, manager]
---

# Journey: Manager creates a day_line for an area

**Precondition:**
- Manager signed in, viewing `/dashboard/day` for a session-open department
- At least one `department_location` pairing exists for that department

## Happy path

1. Manager clicks "Ny dagslinje" button on TimelineTab toolbar → System opens `DayLineCreateSheet` (right-side sheet)
2. Manager selects area from "Område" dropdown → Dropdown lists locations from `department_location` for the active department
3. Manager (optionally) writes notes → Textarea accepts up to 2000 chars
4. Manager clicks "Opprett" → System calls `createDayLineAction` → Server Action calls `day-line.create` capability tool
5. Capability tool gate-passes (manager role + chat channel) → INSERT day_line → emit `day_line.created`
6. System invalidates `["day-lines"]` query → TimelineTab re-renders with the new strip → toast "Dagslinje opprettet"

**Postcondition:**
- One new row in `public.day_line` for `(department_session_id, location_id)`
- `activity_trail` row for `day_line.created`
- `engine_event` row for `day_line.created`
- TimelineTab shows new `<DayLineStrip>` at the bottom (sorted by location name then planned_open)

## Error paths

- **No `department_location` pairing**: capability tool throws `"day_line.create: department_location pairing missing"` → toast error, sheet stays open
- **Duplicate `(department_session_id, location_id)`**: UNIQUE constraint violates → capability tool re-throws with normalized error → toast "Dagslinje finnes allerede for dette området"
- **Non-manager**: `gate_action` denies → 403-equivalent → toast "Du har ikke tilgang"

## E2E coverage
- `apps/e2e/tests/day-line/create.spec.ts`

## ADR refs
- ADR-0367 §B7 + §5.1
- ADR-0151 (server-derived workspace + actor)
- ADR-0078 (chat-only mutation)
```

- [ ] **Step 2: Write JOURNEY-day-line-edit-hours.md**

```markdown
---
title: Manager edits open/close hours for a day_line
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, manager]
---

# Journey: Manager edits open/close hours

**Precondition:** Manager on `/dashboard/day`, day_line strip visible, status != `locked` and != `closed`.

## Happy path

1. Manager clicks pencil icon on `DayLineStripHeader` → System opens `OpenCloseEditPopover`
2. Manager edits "Åpner" or "Stenger" `<input type="time">` → Local state updates
3. Manager clicks "Lagre" → System calls `updateDayLineHoursAction` → `day-line.update_hours` capability tool
4. UPDATE day_line; emit `day_line.opening_changed` or `day_line.closing_changed` (one per field changed)
5. Invalidate `["day-lines"]` query → header re-renders new hours → toast "Åpningstider oppdatert"

**Postcondition:** `day_line.planned_open` / `planned_close` updated; activity_trail rows for each changed field.

## Error paths
- **status=locked or closed**: edit button hidden (`readOnly=true` derived from `derive-day-line-status.ts`)
- **Invalid time format**: HTML5 validation blocks submit

## E2E coverage
- `apps/e2e/tests/day-line/edit-hours.spec.ts`

## ADR refs
- ADR-0367 §5.1 (extend tool — `update_hours`)
- ADR-0156 (Day Control Panel multi-strip stack amendment)
```

- [ ] **Step 3: Write JOURNEY-day-line-attach-routine.md**

```markdown
---
title: Manager attaches a routine (template) to a day_line
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, manager, routine]
---

# Journey: Manager attaches a routine to a day_line

**Precondition:** Manager on `/dashboard/day`, day_line strip visible, `timeline_template` rows exist with `scope_type='location'` and `scope_id=<day_line.location_id>`.

## Happy path

1. Manager clicks "Legg til rutine" on `DayLineStrip` → System opens `AttachRoutineDialog`
2. Manager selects template from "Mal" dropdown → Preview shows "N oppgaver vil bli lagt til"
3. Manager clicks "Legg til" → System calls `instantiateTemplateAction` → `day-line.instantiate_template` capability
4. Capability delegates to `timeline-template.apply_template` with `day_line_id` + Pattern B fields (`actor_capability="timeline-template"`, `delegated_via="day-line"`)
5. `apply_template` body iterates items, calls `task.create_session` per item with `day_line_id` + Pattern B
6. Each `task.create_session` INSERTs `session_task` with `day_line_id` set; emits `task.created_session` with audit fields
7. After batch, `day-line.instantiate_template` emits `routine.attached` once
8. System invalidates `["day-lines"]` + `["calendar-items"]` → toast "N oppgaver lagt til"

**Postcondition:** `session_task` rows created with `day_line_id` set; `activity_trail` shows full delegation chain (`actor_capability` + `delegated_via`).

## Error paths
- **No templates for location**: dropdown empty, "Legg til" disabled
- **Cross-namespace direct write attempted**: forbidden by ADR-0240 — body must delegate

## E2E coverage
- `apps/e2e/tests/day-line/attach-routine.spec.ts`

## ADR refs
- ADR-0367 §5.3 + Rule 7 (Pattern B mandatory)
- ADR-0240 (cross-namespace delegation)
- ADR-0335 (timeline_template scope=location)
- ADR-0356 (cascade Pattern B audit-symmetry)
```

- [ ] **Step 4: Write JOURNEY-day-line-employee-view-mobile.md**

```markdown
---
title: Employee views shift_session + day_lines on mobile
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, employee, mobile]
---

# Journey: Employee views shift_session on mobile

**Precondition:** Employee signed in to mobile PWA, has at least one `shift_session` row for today.

## Happy path

1. Employee opens app → Home shows `HomeShiftCard` with today's shift summary + next 3 items preview
2. Employee taps shift card → System routes to `/(calendar)/day/[date]`
3. `useShiftSession` query fires → returns `shift_session` row + joined `day_lines[]`
4. Screen renders one section per `day_line` (multi-area shifts show multiple)
5. `useDayLineItems` query fires for all `day_line_id` in scope → filtered through defensive client-side check
6. List renders items sorted by `scheduled_at` ascending
7. Employee taps an item → existing detail sheet opens (no authoring)

**Postcondition:** Employee sees only items bound to their own `shift_session.day_lines[]`. RLS on `shift_session` prevents reading others' rows.

## Defensive flow (item leak)

- Synthetic foreign-line item appears (e.g. cache-staleness across workspaces)
- Client filter drops the row
- Telemetry emits `shift_session.item_leak_detected` with `offending_day_line_id`
- Operator alerts via heartbeat audit

## Error paths
- **No shift_session today**: screen shows "Ingen vakt på {date}"
- **Network error on shift_session query**: React Query retry, fall back to cached snapshot from `ADR-0297 workforce_snapshot`

## E2E coverage
- `apps/mobile/e2e/day-line/employee-flow.test.ts` (Maestro)

## ADR refs
- ADR-0367 §M1-M7
- ADR-0133 (mobile read+execute; NO authoring)
- ADR-0134 (telemetry contract — `workspace_id` + `actor_id` resolved via `getProfileContext()`)
- ADR-0297 (workforce_snapshot fallback)
```

- [ ] **Step 5: Write JOURNEY-day-line-push.md**

```markdown
---
title: Time-based push notification flow
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, push, engine-dispatch]
---

# Journey: Time-based push notification flow

**Precondition:**
- `engine-dispatch` Edge Function running on 1-min cron
- Employee `shift_session.status='clocked_in'`, `profile.expo_push_token` present
- `session_task` row exists with `day_line_id` set, `scheduled_at` within next minute, `status='pending'`

## Happy path

1. Cron fires (every 60s) → `engine-dispatch` tick begins
2. Tick calls `dispatchDayLinePush({sb, emit})`
3. Handler selects `session_task` rows where `scheduled_at` in [now-60s, now+60s), `day_line_id` NOT NULL, `status='pending'`
4. For each item: fan out across `shift_session_day_line` junction
5. Per receiver: skip if `status != clocked_in` OR `expo_push_token IS NULL`
6. Compute `idempotency_key = '<task_id>:<shift_session_id>'`
7. Check `engine_event` for prior row with same key + event_type → skip if present (idempotency gate)
8. `sendExpoPush(token, {title, body})` → push delivered to device
9. `emit("day_line_item.notified", {entity_id: idempotencyKey, ...})` → activity_trail + engine_event rows

**Postcondition:** One push per (item, shift_session) pair; idempotent on retry; only clocked-in employees receive.

## Error paths
- **Tick restarts mid-batch**: idempotency_key skip prevents duplicate
- **Expo push API 429**: handler logs + retries on next tick
- **No clocked_in employees**: handler completes with `pushes_sent: 0`

## E2E coverage
- `supabase/functions/engine-dispatch/_tests/day-line-push.test.ts` (Deno integration)

## ADR refs
- ADR-0367 §5.7
- L-0309 (engine_event.idempotency_key reuse)
- ADR-0078 (chat-only on mutations — push is read-side notification, not capability call)
```

- [ ] **Step 6: Commit all 5 journeys**

```bash
git add docs/journeys/JOURNEY-day-line-*.md
git commit -m "docs(day-line): FT1-1 5 journey docs (ADR-0367)"
```

#### Task FT1-2: Web E2E specs (3)

**Files:**
- Create: `apps/e2e/tests/day-line/create.spec.ts`
- Create: `apps/e2e/tests/day-line/edit-hours.spec.ts`
- Create: `apps/e2e/tests/day-line/attach-routine.spec.ts`

- [ ] **Step 1: Write create.spec.ts**

```ts
// apps/e2e/tests/day-line/create.spec.ts
import { test, expect } from "@playwright/test";
import { signInAsManager } from "../helpers/auth";

test("manager creates day_line for area", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/dashboard/day");

  await page.getByTestId("day-line-create-trigger").click();
  await expect(page.getByTestId("day-line-create-sheet")).toBeVisible();

  await page.getByTestId("location-picker").click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: "Opprett" }).click();
  await expect(page.getByText("Dagslinje opprettet")).toBeVisible();
  await expect(page.locator('[data-testid^="day-line-strip-"]')).toHaveCount({ minimum: 1 } as never);
});
```

- [ ] **Step 2: Write edit-hours.spec.ts**

```ts
// apps/e2e/tests/day-line/edit-hours.spec.ts
import { test, expect } from "@playwright/test";
import { signInAsManager } from "../helpers/auth";

test("manager edits day_line open/close hours", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/dashboard/day");
  const strip = page.locator('[data-testid^="day-line-strip-"]').first();
  await strip.locator('[data-testid^="day-line-edit-hours-"]').click();

  const popover = page.locator('[data-testid^="open-close-popover-"]');
  await expect(popover).toBeVisible();
  await popover.locator('input[type="time"]').first().fill("09:00");
  await popover.locator('input[type="time"]').nth(1).fill("17:00");
  await popover.getByRole("button", { name: "Lagre" }).click();
  await expect(page.getByText("Åpningstider oppdatert")).toBeVisible();
});
```

- [ ] **Step 3: Write attach-routine.spec.ts**

```ts
// apps/e2e/tests/day-line/attach-routine.spec.ts
import { test, expect } from "@playwright/test";
import { signInAsManager } from "../helpers/auth";

test("manager attaches a routine to day_line", async ({ page }) => {
  await signInAsManager(page);
  await page.goto("/dashboard/day");

  const strip = page.locator('[data-testid^="day-line-strip-"]').first();
  await strip.getByRole("button", { name: /Legg til rutine/i }).click();

  await expect(page.getByTestId("attach-routine-dialog")).toBeVisible();
  await page.getByTestId("template-picker").click();
  await page.getByRole("option").first().click();
  await expect(page.getByTestId("template-preview")).toContainText(/oppgaver/);
  await page.getByRole("button", { name: "Legg til" }).click();
  await expect(page.getByText(/oppgaver lagt til/)).toBeVisible();
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @smartout/e2e test tests/day-line/ 2>&1 | tail -20
git add apps/e2e/tests/day-line/
git commit -m "test(day-line): FT1-2 3 Playwright E2E specs (create/edit-hours/attach-routine)"
```

#### Task FT1-3: Mobile E2E (Maestro)

**Files:**
- Create: `apps/mobile/e2e/day-line/employee-flow.test.ts`

- [ ] **Step 1: Write spec** (Maestro YAML or Detox TS — match existing tooling in repo)

```bash
ls apps/mobile/e2e/ 2>&1 | head -5
```

Use existing pattern. If Maestro:

```yaml
# apps/mobile/e2e/day-line/employee-flow.yaml
appId: ai.smartout.mobile
---
- launchApp
- tapOn: "Logg inn"
- inputText: "employee@test.local"
- tapOn: "Fortsett"
- assertVisible:
    id: "home-shift-card-preview"
- tapOn:
    id: "home-shift-card-preview"
- assertVisible:
    id: "mobile-day-screen"
- assertVisible:
    text: "Bar"  # depends on seed
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/e2e/day-line/
git commit -m "test(day-line): FT1-3 mobile employee-flow E2E"
```

#### Task FT1-4: Module doc updates + CLAUDE.md ADR entry

**Files:**
- Modify: `docs/modules/daytimeline/MODULE_DAYTIMELINE.md`
- Modify: `docs/modules/daytimeline/DATA-MODEL.md`
- Modify: `docs/modules/daytimeline/GAPS-AND-DEBT.md` (close G3.10)
- Modify: `CLAUDE.md` (ADR section)

- [ ] **Step 1: Confirm module docs reflect tri-layer model**

These were updated during ADR-0367 commit `6b848d1c5`. Re-verify and tighten:

```bash
grep -n "tri-layer\|day_line\|shift_session" docs/modules/daytimeline/MODULE_DAYTIMELINE.md | head -20
```

If any gap → patch.

- [ ] **Step 2: Append ADR-0367 to CLAUDE.md ADR table**

Find the "Modules & ADRs" section in `CLAUDE.md` and confirm "163 ADRs … latest ADR-0164" updated to "165 ADRs … latest ADR-0367" (or however the campaign already counted).

- [ ] **Step 3: Commit**

```bash
git add docs/modules/daytimeline/*.md CLAUDE.md
git commit -m "docs(day-line): FT1-4 module + CLAUDE.md doc updates (ADR-0367)"
```

#### Task FT1-5: `/audit smoke` post-merge

- [ ] **Step 1: Run audit**

```bash
~/.claude/skills/adr-contract-audit/run-smoke.sh 2>&1 | tail -30
```

Expected: zero drift on `day_line` / `shift_session` surfaces.

- [ ] **Step 2: Capture results**

```bash
ls docs/audits/2026-05-* | tail -3
```

If clean → record commit. If drift → spawn fix sortie.

#### Task FT1-6: Close Phase F + final push

- [ ] **Step 1: Push + PR**

```bash
git push origin feat/day-line-journeys-e2e
gh pr create --base campaign/ui-shell --head feat/day-line-journeys-e2e \
  --title "feat(day-line): FT1 journeys + E2E + docs" \
  --body "Phase F — closes ADR-0367. 5 journeys, 3 web E2E + 1 mobile E2E, doc updates, /audit smoke green."
```

**Phase F Gate (closes ADR-0367 implementation):**

- [ ] All 5 journey docs landed
- [ ] All 4 E2E specs green
- [ ] `docs/modules/daytimeline/*` reflects tri-layer model
- [ ] `CLAUDE.md` ADR table mentions ADR-0367
- [ ] `/audit smoke` shows zero drift on day_line surfaces
- [ ] G3.10 closed in GAPS-AND-DEBT.md

---

## Self-Review

### Spec coverage check

| Spec section | Plan tasks |
|---|---|
| §B1 day_line table | A3 |
| §B2 shift_session table | A4 |
| §B3 junction | A5 |
| §B4 department_location | A6 |
| §B5 child FKs + session_task.scheduled_at + session_hook UNIQUE | A7 |
| §B6 backfill | A8 |
| §B7 capability authority seed | A9 |
| §B8 RLS | A3, A4, A6 (embedded) |
| §B9 trigger ensure_shift_session | BT3-1 |
| §B10 day_line back-populate trigger | BT3-2 |
| §B11 3 capability folders (day-line, routine, org) | BT1-1..5, BT2-1, BT2-2 |
| §B12 task.create_session + hms.report_deviation extensions | BT2-3, BT2-4 |
| §B13 3 Server Actions | BT1-6 |
| §B14 engine-dispatch handler | ET1-1, ET1-2 |
| §B15 workforce snapshot extension | _NOT_in_this_plan_ — separate sortie per ADR-0297 amendment |
| §W1 TimelineTab refactor | CT1-5 |
| §W2 DayLineStripHeader | CT1-3 |
| §W3 OpenCloseEditPopover | CT2-1 |
| §W4 DayLineCreateSheet | CT2-2 |
| §W5 AttachRoutineDialog | CT2-3 |
| §W6 SlotPicker wire | CT1-5 |
| §W7 ScopeFilterPopover | CT3-1 |
| §W8 useDayLines | CT3-2 |
| §W9 aggregated overview | CT3-3 |
| §W10 telemetry emit | BT4-1 + capability bodies (BT1, BT2) |
| §W11 Nordic Split audit | implicit in CT1/CT2/CT3 typecheck + lint |
| §M1 useShiftSession | DT1-1 |
| §M2 day route rewire | DT1-3 |
| §M3 HomeShiftCard preview | DT1-5 |
| §M4 push subscribe | DT1-4 |
| §M5 detail sheet | _existing_ (no plan task) |
| §M6 telemetry via getProfileContext | DT1-2 (emit), DT1-4 |
| §M7 defensive filter + leak telemetry | DT1-2 |
| §S1 9 telemetry events | BT4-1 |
| §S2 activity_trail + engine_event routing | BT4-1 (EVENT_ROUTING entries) |
| §S3 5 journey docs | FT1-1 |
| §S4 3 web E2E | FT1-2 |
| §S5 mobile E2E | FT1-3 |
| §S6 /audit smoke | FT1-5 |
| §S7 module doc updates | FT1-4 |
| §S8 CLAUDE.md ADR entry | FT1-4 |

**Gap surfaced:** §B15 workforce snapshot extension (ADR-0297 amendment to include `day_lines[]` + `my_shift_session{}`) is out of scope for this plan. It lives in a separate sortie since it touches the stage-engine snapshot pipeline and voice-context mirror (L-0233 two-LLM-context). Tracked in HANDOFF / next plan.

### Placeholder scan

Searched for: TBD, TODO, "fill in", "implement later", "similar to Task N", "Add appropriate error handling", "handle edge cases", "Write tests for the above".

Found one explicit forward reference: CT2-1 mentions `day-line.update_hours` tool. This implies BT1 should ship a 4th tool. **Patch BT1 file structure:** add Task BT1-5b (between BT1-5 and BT1-6) that implements `update_hours`. Adding now:

#### Task BT1-5b (patch): `day-line.update_hours` tool

Append after BT1-5 in your dispatch:

- Add `update_hours` to `tools.ts`:

```ts
export const updateHours = defineTool({
  capability: CAPABILITY,
  name: "update_hours",
  description: "Update planned_open and/or planned_close on a day_line. Manager+ only.",
  schema: z.object({
    day_line_id: z.string().uuid(),
    planned_open: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    planned_close: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  }).refine((d) => d.planned_open || d.planned_close, { message: "At least one of planned_open / planned_close required" }),
  execute: gatedMutation({
    capability: "day-line.update_hours",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    const { data: existing } = await ctx.sb.from("day_line")
      .select("workspace_id, planned_open, planned_close")
      .eq("day_line_id", input.day_line_id).single();
    if (!existing) throw new Error("day-line.update_hours: day_line not found");

    const patch: Record<string, string> = {};
    if (input.planned_open  && input.planned_open  !== existing.planned_open)  patch.planned_open  = input.planned_open;
    if (input.planned_close && input.planned_close !== existing.planned_close) patch.planned_close = input.planned_close;
    if (Object.keys(patch).length === 0) return { ok: true, no_op: true };

    await ctx.sb.from("day_line").update(patch).eq("day_line_id", input.day_line_id);

    if (patch.planned_open) {
      await ctx.emit("day_line.opening_changed", {
        workspace_id: existing.workspace_id, actor_id: ctx.profileId, entity_id: input.day_line_id,
        day_line_id: input.day_line_id, old: existing.planned_open, new: patch.planned_open,
      });
    }
    if (patch.planned_close) {
      await ctx.emit("day_line.closing_changed", {
        workspace_id: existing.workspace_id, actor_id: ctx.profileId, entity_id: input.day_line_id,
        day_line_id: input.day_line_id, old: existing.planned_close, new: patch.planned_close,
      });
    }
    return { ok: true };
  }),
});
```

- Register in `index.ts` `tools: [...]` array.
- Add Task A9 supplement: include `day-line.update_hours` in capability authority seed (`suggest`, `chat`).
- Add intent enum entry in BT4-2.

### Type consistency check

- `DayLineRow` defined once in `apps/web/src/components/day/_hooks/use-day-lines.types.ts`, consumed by CT1, CT2, CT3 — ✅
- `ShiftSessionRow` defined in mobile hook (DT1-1), consumed locally — ✅
- `day_line_id` always `string` (uuid) across web + mobile — ✅
- Tool names BARE (e.g. `create`, not `day-line.create`) in `defineTool` body — ✅ verified against task convention
- Capability name in `gate` is `"day-line"`, in event-namespace via `emitPrefix: "day_line"` — distinct strings, consistent

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-day-line-area-anchored.md`.

Two execution options:

**1. Subagent-Driven (recommended for parallel teams)**
- Dispatch each Phase B sub-sortie (BT1-BT4) in 4 parallel `Agent()` calls with `subagent_type: "botsson-harness-builder"` (3×) + `"system-agent-coordinator"` (1×), all `model: "sonnet"`. Each gets one BT block + worktree pre-flight.
- After Phase B merge, dispatch Phase C (3 parallel `frontend-designer` agents) + Phase D + Phase E (independent, dispatch alongside C).
- Phase A runs solo before any parallel work; Phase F runs solo after.

**2. Inline Execution (single Claude session)**
- Execute tasks in order, all phases sequential. Total ~4-6 wall days. Use `superpowers:executing-plans` for batch checkpoints.

**Recommended:** option 1. Parallel team dispatch shaves 50-60% wall time on Phase B + C+D+E.

**Pre-flight before any dispatch:**

```bash
# Confirm clean campaign tip + skills + worktree slots
cd ~/dev/smartout.ai-ui-shell
git status                  # clean
git log -1 --oneline        # should be 6b848d1c5 (council-accepted)
git worktree list           # free slots in ~/dev/smartout.ai-ui-shell-wt-*
~/.claude/scripts/preflight-check.sh  # if exists
```

**Which approach?**
