---
title: Sortie B — Task RPC Read-Path (Design Spec)
status: draft
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-b, task-ontology, rpc, read-surface, ADR-0298, ADR-0300]
---

# Sortie B — Task RPC Read-Path — Design Spec

## 1. Goal

Build the single read surface mandated by ADR-0298 §Architecture/Read-surface: a `fn_list_my_tasks` SECURITY DEFINER RPC that UNION-ALLs across four task tables (`session_task`, `schedule_day_task`, `personal_task`, `emma_task`), with caller identity derived internally from `auth.uid()`. Add two normalization helpers (`fn_normalize_session_task_status`, `fn_normalize_priority`) to collapse source-native enums into the 6-value normalized status set and the 4-value normalized priority set. Wire the existing mobile `useMyTasks` hook (currently a direct `session_task` PostgREST query) to the RPC. Backfill `activity_trail.entity_type` for historical `personal_task_action` rows that pre-date Sortie 1 P8's fix. No new capability tools, no new mobile UI, no E2E — those are Sorties 3-5.

## 2. Out of scope

- No new capability tools (Sortie 3 = ADR-0301)
- No new mobile UI / Kalender wiring (Sortie 4 = ADR-0302)
- No Playwright / E2E (Sortie 5)
- No writes to any of the four task tables (read surface only)
- No `engine_state_step` integration (R2 forbids it — workflow runtime, not a task)
- No `collector.ts` task-read wire (R7 deferred to Sortie 3 per ADR-0298 §Migration Plan)
- No `p_workspace_id` filter parameter (defer until single-workspace UI requires it)
- No capability registration for `task` (Sortie 3)
- No telemetry event consolidation (Sortie 3 — entity_type union additions already landed in Sortie 1)

## 3. Canonical reality (pre-flight, verified 2026-05-13)

### 3.1 EntityType union — Sortie 1 work confirmed

`packages/telemetry/src/registry.ts:181-184` carries: `personal_task`, `schedule_day_task`, `emma_task`, `schedule_shift`. Plus `session_task` at line 79. All five present. Sortie B §4.6 is verify-only.

### 3.2 Task tables — schema reality

| Table | Status enum/text | Priority surrogate | Identity column | Workspace column |
|---|---|---|---|---|
| `session_task` | `session_task_status` ENUM: `pending\|available\|in_progress\|completed\|skipped\|overdue\|escalated` (7 values) | `is_compliance_required BOOLEAN` (no priority column) | `assigned_to UUID REFERENCES profile` (nullable — pickup flow) | `workspace_id` direct |
| `schedule_day_task` | `task_status TEXT DEFAULT 'pending'` (free-text, no CHECK) | `highlight BOOLEAN` (no priority column) | `assigned_to UUID REFERENCES profile` (nullable) | `workspace_id` direct |
| `personal_task` | `status TEXT CHECK (open\|done\|cancelled)` | `priority TEXT CHECK (low\|normal\|high\|urgent)` | `profile_id UUID NOT NULL` (owner-only) | `workspace_id` direct |
| `emma_task` | `status TEXT CHECK (pending\|triggered\|done\|dismissed)` | (none — defaults to `normal`) | `profile_id UUID NOT NULL` | `workspace_id` direct |

### 3.3 Six divergences from ADR-0298 wording

1. `personal_task.status` first state is `open`, not `pending`. Normalize: `open → pending`.
2. `personal_task.priority` uses `urgent`, not `critical`. Normalize: `urgent → critical`.
3. `session_task` has no `priority` column. Synthesize in UNION arm: `is_compliance_required=true → 'high'`, else `'normal'`.
4. `schedule_day_task` has no `priority` column. Synthesize: `highlight=true → 'high'`, else `'normal'`.
5. `emma_task` has no `priority` column. Emit constant `'normal'`.
6. `session_task_status` has 7 values vs 6 normalized. Mapping: `available→pending`, `completed→done`, `skipped→cancelled`, `escalated→overdue`. Precision preserved in `raw_status` column.

### 3.4 Existing read sites

| Site | Current behavior | Sortie B action |
|---|---|---|
| `apps/mobile/src/hooks/queries/use-my-tasks.ts` | Direct PostgREST on `session_task` only; flattens `session_hook→procedure→name`; filters by today's `department_session.session_date`; sorts compliance-DESC then created-ASC | **Replace** body with `supabase.rpc('fn_list_my_tasks', {...})`; introduce `MyTaskRow` shape; update 3 consumers |
| `apps/mobile/src/hooks/queries/use-operations-feed.ts` | Re-uses `useMyTasks` output | Adapt to `MyTaskRow` shape |
| `apps/mobile/src/components/task/TaskFeed.tsx` | Renders `SessionTask` rows | Adapt to `MyTaskRow` |
| `apps/mobile/src/components/task/TaskModal.tsx` | Renders single `SessionTask` | Adapt to `MyTaskRow` |

**Shape decision (§4.4):** introduce `MyTaskRow` as canonical normalized shape, update 3 mobile consumers. Backward-compat aliasing would defer work into Sortie 3 and create dual reality. Cut once.

### 3.5 `collector.ts` task-read defer

The file is `packages/ai/src/context/collector.ts` (NOT `collect-context.ts`). Currently joins `engine_memory`, `agent_profile`, `agent_relationship`, `profile`, `schedule_shift` — no `personal_task` query. ADR-0298 R7 mandates the wire but ADR-0298 §Migration Plan row 3 assigns it to Sortie 3. **Sortie B does NOT touch `collector.ts`.** Note as forward-tag in RPC docstring.

### 3.6 `personal/tools.ts:192` Sortie 1 fix landed

Verified: `entity_type: "personal_task"` (correct). Historical pre-Sortie-1 rows in `activity_trail` may carry bad value `"personal_task_action"`. §4.5 backfills.

### 3.7 Helper functions available

`supabase/migrations/00004_rls_policies.sql:28-42`:
- `get_workspace_ids_for_user(uid uuid)` — SETOF uuid, `is_active = true` filter
- `is_admin_in_workspace(uid uuid, wid uuid)` — boolean

`auth.uid()` available inside SECURITY DEFINER as calling user's UUID. Profile lookup: `(SELECT profile_id FROM profile WHERE user_id = auth.uid() AND is_active = true)`.

### 3.8 Latest migration timestamp

`20260605121000_schedule_shift_rls_invariant_assert.sql` (Sortie A). Sortie B uses `20260606120000+`.

### 3.9 ADR-0300 slot

`docs/decisions/0300-*.md` does NOT exist. Latest is `0299-sortie-a-d6-rls-with-check.md`. Slot reserved by ADR-0298 §Migration Plan row 2. Free to claim.

### 3.10 `activity_trail.entity_type` backfill scope (plan-only)

Audit query (do NOT run pre-flight; capture inside migration):

```sql
SELECT entity_type, count(*)
FROM activity_trail
WHERE entity_id IN (SELECT id::text FROM personal_task)
GROUP BY 1;
```

Expected: rows tagged `personal_task` (Sortie-1 forward) + residual `personal_task_action` (pre-Sortie-1). Backfill `WHERE entity_type = 'personal_task_action' AND entity_id IN (...)`. Idempotent.

## 4. Scope items

### 4.1 `fn_list_my_tasks` RPC

```sql
CREATE OR REPLACE FUNCTION public.fn_list_my_tasks(
  p_window_start TIMESTAMPTZ DEFAULT (now() - INTERVAL '1 day'),
  p_window_end   TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
)
RETURNS TABLE (
  id              UUID,
  source          TEXT,
  raw_status      TEXT,
  status          TEXT,
  title           TEXT,
  description     TEXT,
  due_at          TIMESTAMPTZ,
  priority        TEXT,
  assigned_to     UUID,
  workspace_id    UUID,
  session_id      UUID,
  hook_id         UUID,
  compliance      BOOLEAN,
  created_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  origin_actor    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller_profiles AS (
    SELECT profile_id, workspace_id
    FROM public.profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  SELECT
    st.id, 'session'::text, st.status::text,
    public.fn_normalize_session_task_status(st.status::text),
    st.title, st.description,
    ds.session_date::timestamptz,
    CASE WHEN st.is_compliance_required THEN 'high' ELSE 'normal' END,
    st.assigned_to, st.workspace_id,
    st.department_session_id, st.session_hook_id,
    st.is_compliance_required, st.created_at, st.completed_at,
    CASE WHEN st.session_hook_id IS NOT NULL THEN 'cascade_cron' ELSE 'human' END
  FROM public.session_task st
  JOIN public.department_session ds ON ds.department_session_id = st.department_session_id
  WHERE st.workspace_id IN (SELECT workspace_id FROM caller_profiles)
    AND (st.assigned_to IN (SELECT profile_id FROM caller_profiles) OR st.assigned_to IS NULL)
    AND ds.session_date::timestamptz BETWEEN p_window_start AND p_window_end

  UNION ALL

  SELECT
    sdt.schedule_day_task_id, 'day_ad_hoc'::text, sdt.task_status,
    CASE sdt.task_status
      WHEN 'pending' THEN 'pending'
      WHEN 'completed' THEN 'done'
      WHEN 'done' THEN 'done'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END,
    sdt.label, NULL::text,
    sdt.shift_date::timestamptz,
    CASE WHEN sdt.highlight THEN 'high' ELSE 'normal' END,
    sdt.assigned_to, sdt.workspace_id,
    NULL::uuid, NULL::uuid,
    false, sdt.created_at, sdt.completed_at, 'human'::text
  FROM public.schedule_day_task sdt
  WHERE sdt.workspace_id IN (SELECT workspace_id FROM caller_profiles)
    AND (sdt.assigned_to IN (SELECT profile_id FROM caller_profiles) OR sdt.assigned_to IS NULL)
    AND sdt.shift_date::timestamptz BETWEEN p_window_start AND p_window_end

  UNION ALL

  SELECT
    pt.id, 'personal'::text, pt.status,
    CASE pt.status
      WHEN 'open' THEN 'pending'
      WHEN 'done' THEN 'done'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END,
    pt.title, NULL::text,
    pt.due_at,
    public.fn_normalize_priority(pt.priority),
    pt.profile_id, pt.workspace_id,
    NULL::uuid, NULL::uuid,
    false, pt.created_at, NULL::timestamptz, 'human'::text
  FROM public.personal_task pt
  WHERE pt.profile_id IN (SELECT profile_id FROM caller_profiles)
    AND (pt.due_at IS NULL OR pt.due_at BETWEEN p_window_start AND p_window_end)

  UNION ALL

  SELECT
    et.id, 'emma'::text, et.status,
    CASE et.status
      WHEN 'pending' THEN 'pending'
      WHEN 'triggered' THEN 'triggered'
      WHEN 'done' THEN 'done'
      WHEN 'dismissed' THEN 'cancelled'
      ELSE 'pending'
    END,
    et.title, et.description,
    et.due_at,
    'normal'::text,
    et.profile_id, et.workspace_id,
    NULL::uuid, NULL::uuid,
    false, et.created_at, et.triggered_at, 'agent_auto'::text
  FROM public.emma_task et
  WHERE et.profile_id IN (SELECT profile_id FROM caller_profiles)
    AND (et.due_at IS NULL OR et.due_at BETWEEN p_window_start AND p_window_end);
$$;

REVOKE ALL ON FUNCTION public.fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.fn_list_my_tasks IS
  'ADR-0298 read surface. UNION ALL across session_task, schedule_day_task, personal_task, emma_task. engine_state_step EXCLUDED (R2). Caller identity from auth.uid(). Multi-workspace profiles receive UNION across workspaces (R8). Forward note: ADR-0298 R7 collect-context wire deferred to Sortie 3 (packages/ai/src/context/collector.ts).';
```

**Security model:** SECURITY DEFINER required so function reads `personal_task` rows across owner-RLS. Self-gates via `caller_profiles` CTE — identity is `auth.uid()`, never parameter. EXECUTE only to `authenticated`.

### 4.2 `fn_normalize_session_task_status(raw text)` helper

```sql
CREATE OR REPLACE FUNCTION public.fn_normalize_session_task_status(p_raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE p_raw
    WHEN 'pending' THEN 'pending'
    WHEN 'available' THEN 'pending'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'done'
    WHEN 'skipped' THEN 'cancelled'
    WHEN 'overdue' THEN 'overdue'
    WHEN 'escalated' THEN 'overdue'
    ELSE 'pending'
  END;
$$;
```

Mapping: `pending|available → pending`, `in_progress → in_progress`, `completed → done`, `skipped → cancelled`, `overdue|escalated → overdue`. Precision in `raw_status`.

### 4.3 `fn_normalize_priority(raw text)` helper

```sql
CREATE OR REPLACE FUNCTION public.fn_normalize_priority(p_raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE lower(p_raw)
    WHEN 'urgent' THEN 'critical'
    WHEN 'critical' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'normal' THEN 'normal'
    WHEN 'medium' THEN 'normal'
    WHEN 'low' THEN 'low'
    ELSE 'normal'
  END;
$$;
```

Used by `personal_task` arm only. Other 3 arms synthesize priority inline (§3.3 divergences 3-5).

### 4.4 `useMyTasks` hook rewire (mobile)

Replace `apps/mobile/src/hooks/queries/use-my-tasks.ts` body with `supabase.rpc("fn_list_my_tasks", ...)` call. Introduce `MyTaskRow` type with 16 columns matching RPC RETURNS TABLE. Preserve MMKV cache + compliance-first sort. Drop procedure-name lookup (defer to Sortie 3 capability tool).

**3 consumers to adapt:**
- `use-operations-feed.ts:68-72` — map `MyTaskRow → FeedItem`
- `TaskFeed.tsx` — row props
- `TaskModal.tsx` — single-row props

**NOT in scope:** Web dashboard task surfaces, DuringShiftView, BeforeShiftView, shift-hub, punch-clock (verified via grep — none call `useMyTasks`).

### 4.5 `activity_trail.entity_type` backfill

```sql
-- 20260606121000_activity_trail_personal_task_backfill.sql
DO $$
DECLARE rows_updated INTEGER;
BEGIN
  UPDATE public.activity_trail
  SET entity_type = 'personal_task'
  WHERE entity_type = 'personal_task_action'
    AND entity_id::text IN (SELECT id::text FROM public.personal_task);
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sortie B backfill: % rows updated', rows_updated;
END $$;
```

Idempotent: predicate `personal_task_action` zeros out after first run. Narrow JOIN avoids orphans. RAISE NOTICE for audit.

### 4.6 EntityType union audit — verify-only

Pre-flight Phase 1 re-greps `packages/telemetry/src/registry.ts` for all 5 task entity types. If any missing (defensive — Sortie 1 already added), single-line addition. Expected: no-op.

## 5. Migration plan

| # | File | Scope |
|---|---|---|
| 1 | `20260606120000_fn_normalize_task_status_priority.sql` | Both helpers |
| 2 | `20260606120100_fn_list_my_tasks.sql` | RPC + GRANT + COMMENT |
| 3 | `20260606121000_activity_trail_personal_task_backfill.sql` | Backfill DO block |

Three separate commits. Each commitlint-conformant.

## 6. pgTAP test plan

Two spec files in `supabase/tests/`:

### `sortie-b-fn-list-my-tasks.spec.sql` — 16+ assertions

**Positive (rows MUST return):**
- P1: session_task assigned to E1 in W1 within window
- P2: session_task UNASSIGNED in W1 (pickup flow)
- P3: schedule_day_task assigned to E1 with `highlight=true` → priority='high'
- P4: schedule_day_task `assigned_to=NULL` in W1
- P5: personal_task owned by E1 with `priority='urgent'` → normalized 'critical'
- P6: emma_task owned by E1 with `status='triggered'` → preserved
- P7: Multi-workspace E2: rows from W1 + W2 in single call (R8)
- P8: All 7 session_task_status values map to 6 normalized correctly
- P9: Window boundary — exact match included; 1s before NOT included
- P10: `is_compliance_required=true` → `priority='high'` AND `compliance=true`

**Negative (rows MUST NOT return):**
- N1: session_task in W2 when caller is E1 (W1-only)
- N2: personal_task owned by E2 when caller is E1
- N3: session_task outside window
- N4: No `source='runtime'` rows ever appear (R2)
- N5: Anon caller → permission denied

### `sortie-b-activity-trail-backfill.spec.sql`
- N6: Backfill idempotency — second run touches 0 rows
- Seed: 3 rows `personal_task_action` linking real personal_task; 1 orphan; 1 already-correct
- Post-migration: 3 flipped, 1 orphan untouched, 1 already-correct unchanged

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | UNION ALL p95 > 500ms at scale | EXPLAIN ANALYZE captured in commit; Sortie 5 adds < 500ms gate |
| R2 | `session_task.completed_at` may not exist | Phase 1 grep verifies; substitute `updated_at WHERE status IN (completed,done)` if missing |
| R3 | `schedule_day_task.task_status` free TEXT — unknown values | ELSE 'pending' fallback; pgTAP P8 asserts fallback path |
| R4 | `auth.uid()` NULL when service_role calls RPC | Documented: `authenticated` role only |
| R5 | `MyTaskRow` shape break consumer outside §4.4 | `pnpm turbo typecheck` catches it |
| R6 | `due_at` for session_task derived from `session_date` (date) — timezone shift | `::timestamptz` casts midnight UTC; verify in pgTAP |
| R7 | `activity_trail.entity_id` type may be UUID not TEXT | Phase 1 grep verifies; adjust cast direction |
| R8 | SECURITY DEFINER bypasses future personal_task RLS tightening | Documented in COMMENT + ADR-0300; future tightening syncs CTE |

## 8. Council escalation triggers

1. Phase 1 reveals `session_task.completed_at` missing — substitute strategy
2. `activity_trail.entity_id` is UUID — backfill cast adjust
3. Mobile consumer count >3 — scope expand
4. EXPLAIN shows seq-scan on session_task — index migration needed
5. Non-mobile typecheck failure — web update vs revert
6. Multi-workspace UNION leak — caller_profiles CTE tighten

## 9. Acceptance criteria

- [ ] 3 SQL migrations land
- [ ] `fn_list_my_tasks` callable via PostgREST; returns rows for seed users
- [ ] Both helpers return correct value per mapping tables
- [ ] `useMyTasks` calls RPC; no direct `from("session_task")` query remains
- [ ] 3 mobile consumers adapted to `MyTaskRow`
- [ ] Backfill idempotent (P6 + spec)
- [ ] EntityType audit passes
- [ ] 2 pgTAP spec files green (16+ assertions)
- [ ] `pnpm turbo typecheck` clean
- [ ] Zero capability tool changes (Sortie 3 territory)
- [ ] Zero mobile UI work (Sortie 4 territory)
- [ ] HANDOFF + JOURNEY written, ADR-0300 registered
