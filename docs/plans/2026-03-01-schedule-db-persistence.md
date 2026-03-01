# Schedule DB Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the local useReducer+Context state management with TanStack Query backed by Supabase, with Realtime sync, optimistic updates, and a trigger-based audit log with rollback.

**Architecture:** Full TanStack Query replacement. Each reducer action becomes a `useMutation` with optimistic cache updates. Supabase Realtime invalidates queries for cross-user sync. A single `schedule_audit_log` table with DB triggers captures all changes. UI-only state (selection, clipboard) stays in a lightweight React Context.

**Tech Stack:** @tanstack/react-query, @supabase/supabase-js (existing), Supabase Realtime (postgres_changes), PostgreSQL triggers, Supabase RPC

---

## Task 1: Install TanStack Query

**Files:**

- Modify: `apps/web/package.json`

**Step 1: Install dependencies**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web add @tanstack/react-query @tanstack/react-query-devtools
```

**Step 2: Verify installation**

Run:

```bash
grep "@tanstack/react-query" apps/web/package.json
```

Expected: Two lines — `@tanstack/react-query` and `@tanstack/react-query-devtools`

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(schedule): add @tanstack/react-query dependencies"
```

---

## Task 2: Add QueryClientProvider to Dashboard Layout

**Files:**

- Create: `apps/web/src/app/dashboard/query-provider.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Step 1: Create the client-side QueryProvider wrapper**

Create `apps/web/src/app/dashboard/query-provider.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Step 2: Wrap dashboard layout with QueryProvider**

In `apps/web/src/app/dashboard/layout.tsx`, import `QueryProvider` and wrap the children:

```tsx
// Add import at top:
import { QueryProvider } from "./query-provider";

// Wrap returns — both the workspace path and fallback:
// Where it currently returns:
//   <WorkspaceProvider workspace={workspace}>
//     <DashboardShell>{children}</DashboardShell>
//   </WorkspaceProvider>
// Change to:
//   <QueryProvider>
//     <WorkspaceProvider workspace={workspace}>
//       <DashboardShell>{children}</DashboardShell>
//     </WorkspaceProvider>
//   </QueryProvider>
//
// And the fallback:
//   <QueryProvider>
//     <DashboardShell>{children}</DashboardShell>
//   </QueryProvider>
```

**Step 3: Verify build**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/query-provider.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(schedule): add QueryClientProvider to dashboard layout"
```

---

## Task 3: Create Database Migration — New Tables, Enums, Audit Log

**Files:**

- Create: `supabase/migrations/20260301600000_schedule_persistence_tables.sql`

This is the largest single task. One migration file creates all 7 new tables + 4 enums + audit trigger + rollback RPC + RLS + indexes + Realtime publication.

**Step 1: Write the migration**

Create `supabase/migrations/20260301600000_schedule_persistence_tables.sql`:

```sql
-- ============================================
-- 20260301600000_schedule_persistence_tables.sql
-- Creates all remaining schedule tables for DB persistence:
-- schedule_absence, schedule_template, schedule_template_shift,
-- schedule_open_shift, schedule_day_message, schedule_day_task,
-- schedule_day_booking, schedule_audit_log
-- Plus enums, RLS, indexes, audit trigger, rollback RPC.
-- Connected to: 20260301300000_schedule_shift_table.sql (existing)
-- Connected to: docs/plans/2026-03-01-schedule-db-persistence-design.md
-- ============================================

-- ── New Enums ──────────────────────────────────────────────────

CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE booking_status AS ENUM ('confirmed', 'pending', 'cancelled');
CREATE TYPE message_visibility AS ENUM ('all_day', 'until_16', 'permanent');
CREATE TYPE audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ── schedule_absence ───────────────────────────────────────────

CREATE TABLE public.schedule_absence (
  schedule_absence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  shift_date          DATE NOT NULL,
  absence_type        TEXT NOT NULL, -- maps to AbsenceType enum in TS
  request_type        TEXT,          -- maps to RequestType enum in TS
  reason              TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  is_full_day         BOOLEAN NOT NULL DEFAULT true,
  status              absence_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_absence IS 'Employee absences (sick leave, vacation, etc.) — separate from shifts per MODULE_03 §7.';

ALTER TABLE public.schedule_absence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_absence" ON public.schedule_absence FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_absence" ON public.schedule_absence FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_absence" ON public.schedule_absence FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_absence" ON public.schedule_absence FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_absence" ON public.schedule_absence FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_insert_schedule_absence" ON public.schedule_absence FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_update_schedule_absence" ON public.schedule_absence FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_delete_schedule_absence" ON public.schedule_absence FOR DELETE
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_absence_workspace_date ON public.schedule_absence (workspace_id, shift_date);
CREATE INDEX idx_schedule_absence_employee_date ON public.schedule_absence (employee_id, shift_date);

CREATE TRIGGER set_schedule_absence_updated_at
  BEFORE UPDATE ON public.schedule_absence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_template ──────────────────────────────────────────

CREATE TABLE public.schedule_template (
  schedule_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  department           TEXT NOT NULL,
  include_assignments  BOOLEAN NOT NULL DEFAULT false,
  created_by           UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_template IS 'Reusable shift templates for a day — MODULE_03 §13.1.';

ALTER TABLE public.schedule_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_template" ON public.schedule_template FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_template" ON public.schedule_template FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_template" ON public.schedule_template FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_template" ON public.schedule_template FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_template" ON public.schedule_template FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_insert_schedule_template" ON public.schedule_template FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_update_schedule_template" ON public.schedule_template FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_delete_schedule_template" ON public.schedule_template FOR DELETE
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_template_workspace ON public.schedule_template (workspace_id);

CREATE TRIGGER set_schedule_template_updated_at
  BEFORE UPDATE ON public.schedule_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_template_shift ────────────────────────────────────

CREATE TABLE public.schedule_template_shift (
  schedule_template_shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id                UUID NOT NULL REFERENCES public.schedule_template(schedule_template_id) ON DELETE CASCADE,
  employee_id                UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  role                       TEXT NOT NULL,
  start_time                 TIME NOT NULL,
  end_time                   TIME NOT NULL,
  work_hours                 NUMERIC(4,2) NOT NULL DEFAULT 0,
  breaks                     INTEGER NOT NULL DEFAULT 0,
  day_category               day_category NOT NULL,
  zone                       TEXT,
  indicator                  TEXT NOT NULL DEFAULT 'blue',
  notes                      TEXT
);

COMMENT ON TABLE public.schedule_template_shift IS 'Individual shift entries within a schedule template.';

ALTER TABLE public.schedule_template_shift ENABLE ROW LEVEL SECURITY;

-- Template shifts inherit access from their parent template via join
CREATE POLICY "jwt_read_schedule_template_shift" ON public.schedule_template_shift FOR SELECT
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "jwt_insert_schedule_template_shift" ON public.schedule_template_shift FOR INSERT
  WITH CHECK (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));
CREATE POLICY "jwt_update_schedule_template_shift" ON public.schedule_template_shift FOR UPDATE
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));
CREATE POLICY "jwt_delete_schedule_template_shift" ON public.schedule_template_shift FOR DELETE
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));

CREATE POLICY "api_key_read_schedule_template_shift" ON public.schedule_template_shift FOR SELECT
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_write_schedule_template_shift" ON public.schedule_template_shift FOR ALL
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id = get_api_workspace_id()
  ));

CREATE INDEX idx_schedule_template_shift_template ON public.schedule_template_shift (template_id);

-- ── schedule_open_shift ────────────────────────────────────────

CREATE TABLE public.schedule_open_shift (
  schedule_open_shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,
  department             TEXT,
  role                   TEXT,
  day_category           day_category,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_open_shift IS 'Unassigned shifts available for employees to claim.';

ALTER TABLE public.schedule_open_shift ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_open_shift" ON public.schedule_open_shift FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_open_shift" ON public.schedule_open_shift FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_open_shift" ON public.schedule_open_shift FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_open_shift" ON public.schedule_open_shift FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_open_shift" ON public.schedule_open_shift FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_write_schedule_open_shift" ON public.schedule_open_shift FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_open_shift_workspace ON public.schedule_open_shift (workspace_id);

CREATE TRIGGER set_schedule_open_shift_updated_at
  BEFORE UPDATE ON public.schedule_open_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_message ───────────────────────────────────────

CREATE TABLE public.schedule_day_message (
  schedule_day_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date              DATE NOT NULL,
  title                   TEXT NOT NULL,
  content                 TEXT NOT NULL,
  audience                TEXT NOT NULL DEFAULT 'all', -- 'all', 'leaders', or team name
  visibility              message_visibility NOT NULL DEFAULT 'all_day',
  author_id               UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  is_alert                BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_message IS 'Daily messages visible in schedule day view.';

ALTER TABLE public.schedule_day_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_day_message" ON public.schedule_day_message FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_day_message" ON public.schedule_day_message FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_day_message" ON public.schedule_day_message FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_day_message" ON public.schedule_day_message FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_day_message" ON public.schedule_day_message FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_write_schedule_day_message" ON public.schedule_day_message FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_day_message_workspace_date ON public.schedule_day_message (workspace_id, shift_date);

CREATE TRIGGER set_schedule_day_message_updated_at
  BEFORE UPDATE ON public.schedule_day_message
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_task ──────────────────────────────────────────

CREATE TABLE public.schedule_day_task (
  schedule_day_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date           DATE NOT NULL,
  label                TEXT NOT NULL,
  task_status          TEXT NOT NULL DEFAULT 'pending', -- maps to TaskStatus enum in TS
  category             TEXT NOT NULL DEFAULT 'all',     -- 'all', 'routine', 'delegated'
  assigned_to          UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  highlight            BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_task IS 'Daily operational tasks shown in schedule day view.';

ALTER TABLE public.schedule_day_task ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_day_task" ON public.schedule_day_task FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_day_task" ON public.schedule_day_task FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_day_task" ON public.schedule_day_task FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_day_task" ON public.schedule_day_task FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_day_task" ON public.schedule_day_task FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_write_schedule_day_task" ON public.schedule_day_task FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_day_task_workspace_date ON public.schedule_day_task (workspace_id, shift_date);

CREATE TRIGGER set_schedule_day_task_updated_at
  BEFORE UPDATE ON public.schedule_day_task
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_booking ───────────────────────────────────────

CREATE TABLE public.schedule_day_booking (
  schedule_day_booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date              DATE NOT NULL,
  title                   TEXT NOT NULL,
  guest_count             INTEGER NOT NULL DEFAULT 0,
  menu                    TEXT,
  booking_time            TIME NOT NULL,
  location                TEXT,
  status                  booking_status NOT NULL DEFAULT 'pending',
  is_vip                  BOOLEAN NOT NULL DEFAULT false,
  notes                   TEXT,
  contact_person          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_booking IS 'Reservations and bookings shown in schedule day view.';

ALTER TABLE public.schedule_day_booking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_day_booking" ON public.schedule_day_booking FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_schedule_day_booking" ON public.schedule_day_booking FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_update_schedule_day_booking" ON public.schedule_day_booking FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "jwt_delete_schedule_day_booking" ON public.schedule_day_booking FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_schedule_day_booking" ON public.schedule_day_booking FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_write_schedule_day_booking" ON public.schedule_day_booking FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_day_booking_workspace_date ON public.schedule_day_booking (workspace_id, shift_date);

CREATE TRIGGER set_schedule_day_booking_updated_at
  BEFORE UPDATE ON public.schedule_day_booking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_audit_log ─────────────────────────────────────────

CREATE TABLE public.schedule_audit_log (
  audit_log_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  table_name      TEXT NOT NULL,
  row_id          UUID NOT NULL,
  operation       audit_operation NOT NULL,
  old_data        JSONB,
  new_data        JSONB,
  changed_fields  TEXT[],
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_audit_log IS 'Row-level audit trail for all schedule tables. Written by trigger, read-only for users.';

ALTER TABLE public.schedule_audit_log ENABLE ROW LEVEL SECURITY;

-- Read-only for workspace members (no direct writes — trigger only)
CREATE POLICY "jwt_read_schedule_audit_log" ON public.schedule_audit_log FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_schedule_audit_log" ON public.schedule_audit_log FOR SELECT
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_audit_log_row ON public.schedule_audit_log (table_name, row_id);
CREATE INDEX idx_schedule_audit_log_workspace ON public.schedule_audit_log (workspace_id, created_at DESC);

-- ── Audit trigger function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_schedule_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_row_id UUID;
  v_workspace_id UUID;
  v_changed TEXT[];
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
BEGIN
  -- Determine the PK column name dynamically from the table name
  -- All schedule tables use {table_name}_id as PK
  IF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_row_id := (v_old_json ->> (TG_TABLE_NAME || '_id'))::UUID;
    v_workspace_id := (v_old_json ->> 'workspace_id')::UUID;
  ELSE
    v_new_json := to_jsonb(NEW);
    v_row_id := (v_new_json ->> (TG_TABLE_NAME || '_id'))::UUID;
    v_workspace_id := (v_new_json ->> 'workspace_id')::UUID;
  END IF;

  -- For template_shift, get workspace_id via template join
  IF TG_TABLE_NAME = 'schedule_template_shift' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT st.workspace_id INTO v_workspace_id
      FROM public.schedule_template st
      WHERE st.schedule_template_id = (v_old_json ->> 'template_id')::UUID;
    ELSE
      SELECT st.workspace_id INTO v_workspace_id
      FROM public.schedule_template st
      WHERE st.schedule_template_id = (v_new_json ->> 'template_id')::UUID;
    END IF;
  END IF;

  -- Build changed_fields for UPDATE
  IF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_changed := ARRAY[]::TEXT[];
    FOR v_key IN SELECT jsonb_object_keys(v_new_json) LOOP
      IF v_key NOT IN ('updated_at') AND
         (v_new_json -> v_key) IS DISTINCT FROM (v_old_json -> v_key) THEN
        v_changed := v_changed || v_key;
      END IF;
    END LOOP;
    -- Skip audit if nothing actually changed (besides updated_at)
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  INSERT INTO public.schedule_audit_log (
    workspace_id, table_name, row_id, operation,
    old_data, new_data, changed_fields, user_id
  ) VALUES (
    v_workspace_id,
    TG_TABLE_NAME,
    v_row_id,
    TG_OP::audit_operation,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'UPDATE' THEN v_changed END,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Attach audit triggers to all schedule tables ───────────────

CREATE TRIGGER audit_schedule_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_absence
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_absence
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_template
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_template
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_template_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_template_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_open_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_open_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_day_message
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_message
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_day_task
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_task
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_day_booking
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_booking
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

-- ── Rollback RPC function ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollback_audit_entry(p_audit_log_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_pk_col TEXT;
  v_result JSONB;
BEGIN
  -- Fetch the audit entry
  SELECT * INTO v_entry FROM public.schedule_audit_log WHERE audit_log_id = p_audit_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit entry not found: %', p_audit_log_id;
  END IF;

  -- Admin check
  IF NOT is_admin_in_workspace(auth.uid(), v_entry.workspace_id) THEN
    RAISE EXCEPTION 'Permission denied: admin role required for rollback';
  END IF;

  -- PK column is always {table_name}_id
  v_pk_col := v_entry.table_name || '_id';

  CASE v_entry.operation
    WHEN 'INSERT' THEN
      -- Reverse an INSERT = DELETE the row
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I = $1',
        v_entry.table_name, v_pk_col
      ) USING v_entry.row_id;
      v_result := jsonb_build_object('action', 'deleted', 'row_id', v_entry.row_id);

    WHEN 'UPDATE' THEN
      -- Reverse an UPDATE = restore old_data
      EXECUTE format(
        'UPDATE public.%I SET %s WHERE %I = $1',
        v_entry.table_name,
        (SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
         FROM jsonb_each(v_entry.old_data)
         WHERE key != v_pk_col AND key != 'created_at'),
        v_pk_col
      ) USING v_entry.row_id;
      v_result := jsonb_build_object('action', 'restored', 'row_id', v_entry.row_id);

    WHEN 'DELETE' THEN
      -- Reverse a DELETE = re-INSERT old_data
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(null::public.%I, $1)',
        v_entry.table_name, v_entry.table_name
      ) USING v_entry.old_data;
      v_result := jsonb_build_object('action', 'restored', 'row_id', v_entry.row_id);
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Enable Supabase Realtime on schedule tables ────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.schedule_shift,
  public.schedule_absence,
  public.schedule_open_shift,
  public.schedule_day_message,
  public.schedule_day_task,
  public.schedule_day_booking;
```

**Step 2: Apply the migration locally**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && npx supabase db reset
```

Expected: All migrations apply without errors.

If `supabase db reset` is too slow or disruptive, you can try:

```bash
cd /home/sxtnl/dev/wt-2 && npx supabase migration up
```

**Step 3: Regenerate database types**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4: Verify types generated correctly**

Run:

```bash
grep "schedule_absence" packages/supabase/src/database.types.ts | head -3
grep "schedule_audit_log" packages/supabase/src/database.types.ts | head -3
grep "audit_operation" packages/supabase/src/database.types.ts | head -3
```

Expected: All three tables and the enum appear in generated types.

**Step 5: Commit**

```bash
git add supabase/migrations/20260301600000_schedule_persistence_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(schedule): add persistence tables, audit log, triggers, rollback RPC, and realtime"
```

---

## Task 4: Build Query Key Factory and Type Mappers

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`

**Step 1: Create the `_hooks/` directory**

Run:

```bash
mkdir -p /home/sxtnl/dev/wt-2/apps/web/src/app/dashboard/schedule/_hooks
```

**Step 2: Create schedule-keys.ts**

Create `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`:

```typescript
/**
 * TanStack Query key factory for all schedule queries.
 * Structured for granular invalidation.
 * Connected to: all use-*.ts hooks in this folder
 */
export const scheduleKeys = {
  all: ["schedule"] as const,

  shifts: (workspaceId: string, weekStart: string) =>
    ["schedule", "shifts", workspaceId, weekStart] as const,

  shift: (id: string) => ["schedule", "shift", id] as const,

  absences: (workspaceId: string, weekStart: string) =>
    ["schedule", "absences", workspaceId, weekStart] as const,

  templates: (workspaceId: string) => ["schedule", "templates", workspaceId] as const,

  openShifts: (workspaceId: string) => ["schedule", "open-shifts", workspaceId] as const,

  dayMessages: (workspaceId: string, weekStart: string) =>
    ["schedule", "messages", workspaceId, weekStart] as const,

  dayTasks: (workspaceId: string, weekStart: string) =>
    ["schedule", "tasks", workspaceId, weekStart] as const,

  dayBookings: (workspaceId: string, weekStart: string) =>
    ["schedule", "bookings", workspaceId, weekStart] as const,

  auditLog: (tableAndRowId: string) => ["schedule", "audit", tableAndRowId] as const,
};
```

**Step 3: Create schedule-mappers.ts**

Create `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`:

```typescript
/**
 * Maps between database snake_case rows and frontend camelCase types.
 * Uses the auto-generated Database types from packages/supabase.
 * Connected to: schedule-types.ts (frontend types)
 * Connected to: database.types.ts (DB types)
 */
import type { Database } from "@smartout/supabase/database.types";
import type {
  Absence,
  DayBooking,
  DayMessage,
  DayTask,
  OpenShift,
  Shift,
  ShiftTemplate,
} from "../_components/schedule-types";
import type {
  AbsenceType,
  DayCategory,
  RequestType,
  ShiftStatus,
  TaskStatus,
} from "@smartout/types";

// ── DB Row types ─────────────────────────────────────────────

type DbShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type DbShiftInsert = Database["public"]["Tables"]["schedule_shift"]["Insert"];
type DbShiftUpdate = Database["public"]["Tables"]["schedule_shift"]["Update"];

type DbAbsence = Database["public"]["Tables"]["schedule_absence"]["Row"];
type DbAbsenceInsert = Database["public"]["Tables"]["schedule_absence"]["Insert"];

type DbTemplate = Database["public"]["Tables"]["schedule_template"]["Row"];
type DbTemplateShift = Database["public"]["Tables"]["schedule_template_shift"]["Row"];

type DbOpenShift = Database["public"]["Tables"]["schedule_open_shift"]["Row"];
type DbOpenShiftInsert = Database["public"]["Tables"]["schedule_open_shift"]["Insert"];

type DbDayMessage = Database["public"]["Tables"]["schedule_day_message"]["Row"];
type DbDayMessageInsert = Database["public"]["Tables"]["schedule_day_message"]["Insert"];

type DbDayTask = Database["public"]["Tables"]["schedule_day_task"]["Row"];
type DbDayTaskInsert = Database["public"]["Tables"]["schedule_day_task"]["Insert"];

type DbDayBooking = Database["public"]["Tables"]["schedule_day_booking"]["Row"];
type DbDayBookingInsert = Database["public"]["Tables"]["schedule_day_booking"]["Insert"];

type DbAuditLog = Database["public"]["Tables"]["schedule_audit_log"]["Row"];

export type {
  DbShift,
  DbShiftInsert,
  DbShiftUpdate,
  DbAbsence,
  DbAbsenceInsert,
  DbTemplate,
  DbTemplateShift,
  DbOpenShift,
  DbOpenShiftInsert,
  DbDayMessage,
  DbDayMessageInsert,
  DbDayTask,
  DbDayTaskInsert,
  DbDayBooking,
  DbDayBookingInsert,
  DbAuditLog,
};

// ── Helpers ──────────────────────────────────────────────────

function formatTime(t: string): string {
  // DB TIME comes as "HH:MM:SS", frontend uses "HH:MM"
  return t.slice(0, 5);
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// ── Shift mappers ────────────────────────────────────────────

export function fromDbShift(row: DbShift): Shift {
  return {
    id: row.schedule_shift_id,
    employeeId: row.employee_id,
    dateId: row.shift_date,
    role: row.role,
    positionId: row.position_id ?? undefined,
    teamId: row.team_id ?? undefined,
    time: formatTimeRange(row.start_time, row.end_time),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    workHours: Number(row.work_hours),
    status: row.status as ShiftStatus,
    dayCategory: row.day_category as DayCategory,
    zone: row.zone ?? undefined,
    indicator: row.indicator,
    isPublished: row.is_published,
    breaks: row.breaks,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbShiftInsert(
  shift: Omit<Shift, "id" | "createdAt" | "updatedAt" | "time">,
  workspaceId: string,
): DbShiftInsert {
  return {
    workspace_id: workspaceId,
    employee_id: shift.employeeId,
    shift_date: shift.dateId,
    role: shift.role,
    position_id: shift.positionId ?? null,
    team_id: shift.teamId ?? null,
    start_time: shift.startTime,
    end_time: shift.endTime,
    work_hours: shift.workHours,
    status: shift.status,
    day_category: shift.dayCategory,
    zone: shift.zone ?? null,
    indicator: shift.indicator,
    is_published: shift.isPublished,
    breaks: shift.breaks,
    notes: shift.notes ?? null,
  };
}

export function toDbShiftUpdate(changes: Partial<Shift>): DbShiftUpdate {
  const update: DbShiftUpdate = {};
  if (changes.employeeId !== undefined) update.employee_id = changes.employeeId;
  if (changes.dateId !== undefined) update.shift_date = changes.dateId;
  if (changes.role !== undefined) update.role = changes.role;
  if (changes.positionId !== undefined) update.position_id = changes.positionId ?? null;
  if (changes.teamId !== undefined) update.team_id = changes.teamId ?? null;
  if (changes.startTime !== undefined) update.start_time = changes.startTime;
  if (changes.endTime !== undefined) update.end_time = changes.endTime;
  if (changes.workHours !== undefined) update.work_hours = changes.workHours;
  if (changes.status !== undefined) update.status = changes.status;
  if (changes.dayCategory !== undefined) update.day_category = changes.dayCategory;
  if (changes.zone !== undefined) update.zone = changes.zone ?? null;
  if (changes.indicator !== undefined) update.indicator = changes.indicator;
  if (changes.isPublished !== undefined) update.is_published = changes.isPublished;
  if (changes.breaks !== undefined) update.breaks = changes.breaks;
  if (changes.notes !== undefined) update.notes = changes.notes ?? null;
  return update;
}

// ── Absence mappers ──────────────────────────────────────────

export function fromDbAbsence(row: DbAbsence): Absence {
  return {
    id: row.schedule_absence_id,
    employeeId: row.employee_id,
    dateId: row.shift_date,
    type: row.absence_type as AbsenceType,
    requestType: (row.request_type as RequestType) ?? undefined,
    reason: row.reason ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    isFullDay: row.is_full_day,
    status: row.status as "pending" | "approved" | "rejected",
  };
}

export function toDbAbsenceInsert(
  absence: Omit<Absence, "id">,
  workspaceId: string,
): DbAbsenceInsert {
  return {
    workspace_id: workspaceId,
    employee_id: absence.employeeId,
    shift_date: absence.dateId,
    absence_type: absence.type,
    request_type: absence.requestType ?? null,
    reason: absence.reason ?? null,
    start_date: absence.startDate,
    end_date: absence.endDate,
    is_full_day: absence.isFullDay,
    status: absence.status,
  };
}

// ── Template mappers ─────────────────────────────────────────

export function fromDbTemplate(row: DbTemplate, shifts: DbTemplateShift[]): ShiftTemplate {
  return {
    id: row.schedule_template_id,
    name: row.name,
    department: row.department,
    includeAssignments: row.include_assignments,
    createdBy: row.created_by,
    createdAt: row.created_at,
    shifts: shifts.map((s) => ({
      employeeId: s.employee_id,
      role: s.role,
      time: formatTimeRange(s.start_time, s.end_time),
      startTime: formatTime(s.start_time),
      endTime: formatTime(s.end_time),
      workHours: Number(s.work_hours),
      status: "created" as const,
      dayCategory: s.day_category as DayCategory,
      zone: s.zone ?? undefined,
      indicator: s.indicator,
      breaks: s.breaks,
      notes: s.notes ?? undefined,
    })),
  };
}

// ── Open shift mappers ───────────────────────────────────────

export function fromDbOpenShift(row: DbOpenShift): OpenShift {
  return {
    id: row.schedule_open_shift_id,
    title: row.title,
    time: formatTimeRange(row.start_time, row.end_time),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    department: row.department ?? undefined,
    role: row.role ?? undefined,
    dayCategory: (row.day_category as DayCategory) ?? undefined,
  };
}

export function toDbOpenShiftInsert(
  openShift: Omit<OpenShift, "id" | "time">,
  workspaceId: string,
): DbOpenShiftInsert {
  return {
    workspace_id: workspaceId,
    title: openShift.title,
    start_time: openShift.startTime,
    end_time: openShift.endTime,
    department: openShift.department ?? null,
    role: openShift.role ?? null,
    day_category: openShift.dayCategory ?? null,
  };
}

// ── Day message mappers ──────────────────────────────────────

export function fromDbDayMessage(row: DbDayMessage): DayMessage {
  return {
    id: row.schedule_day_message_id,
    dateId: row.shift_date,
    title: row.title,
    content: row.content,
    audience: row.audience,
    visibility: row.visibility as "all_day" | "until_16" | "permanent",
    author: row.author_id, // Will be resolved to name in UI via profile lookup
    isAlert: row.is_alert,
    createdAt: row.created_at,
  };
}

export function toDbDayMessageInsert(
  msg: Omit<DayMessage, "id" | "createdAt">,
  workspaceId: string,
  authorProfileId: string,
): DbDayMessageInsert {
  return {
    workspace_id: workspaceId,
    shift_date: msg.dateId,
    title: msg.title,
    content: msg.content,
    audience: msg.audience,
    visibility: msg.visibility,
    author_id: authorProfileId,
    is_alert: msg.isAlert,
  };
}

// ── Day task mappers ─────────────────────────────────────────

export function fromDbDayTask(row: DbDayTask): DayTask {
  return {
    id: row.schedule_day_task_id,
    dateId: row.shift_date,
    label: row.label,
    status: row.task_status as TaskStatus,
    category: row.category as "all" | "routine" | "delegated",
    assignedTo: row.assigned_to ?? undefined,
    completedAt: row.completed_at ?? undefined,
    highlight: row.highlight,
  };
}

export function toDbDayTaskInsert(task: Omit<DayTask, "id">, workspaceId: string): DbDayTaskInsert {
  return {
    workspace_id: workspaceId,
    shift_date: task.dateId,
    label: task.label,
    task_status: task.status,
    category: task.category,
    assigned_to: task.assignedTo ?? null,
    completed_at: task.completedAt ?? null,
    highlight: task.highlight,
  };
}

// ── Day booking mappers ──────────────────────────────────────

export function fromDbDayBooking(row: DbDayBooking): DayBooking {
  return {
    id: row.schedule_day_booking_id,
    dateId: row.shift_date,
    title: row.title,
    guestCount: row.guest_count,
    menu: row.menu ?? "",
    time: formatTime(row.booking_time),
    location: row.location ?? "",
    status: row.status as "confirmed" | "pending" | "cancelled",
    isVip: row.is_vip,
    notes: row.notes ?? undefined,
    contactPerson: row.contact_person ?? undefined,
  };
}

export function toDbDayBookingInsert(
  booking: Omit<DayBooking, "id">,
  workspaceId: string,
): DbDayBookingInsert {
  return {
    workspace_id: workspaceId,
    shift_date: booking.dateId,
    title: booking.title,
    guest_count: booking.guestCount,
    menu: booking.menu || null,
    booking_time: booking.time,
    location: booking.location || null,
    status: booking.status,
    is_vip: booking.isVip,
    notes: booking.notes ?? null,
    contact_person: booking.contactPerson ?? null,
  };
}

// ── Audit log mapper ─────────────────────────────────────────

export type AuditLogEntry = {
  id: string;
  tableName: string;
  rowId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[] | null;
  userId: string | null;
  createdAt: string;
};

export function fromDbAuditLog(row: DbAuditLog): AuditLogEntry {
  return {
    id: row.audit_log_id,
    tableName: row.table_name,
    rowId: row.row_id,
    operation: row.operation as "INSERT" | "UPDATE" | "DELETE",
    oldData: row.old_data as Record<string, unknown> | null,
    newData: row.new_data as Record<string, unknown> | null,
    changedFields: row.changed_fields,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}
```

**Step 4: Verify types compile**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

Expected: No errors. If type errors appear for the Database types, the migration types may need column name adjustments — fix to match the generated types.

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/
git commit -m "feat(schedule): add query key factory and DB type mappers"
```

---

## Task 5: Build Shift Hooks (Queries + Mutations + Optimistic Updates)

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`

**Step 1: Create use-shifts.ts**

Create `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`:

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { scheduleKeys } from "./schedule-keys";
import { fromDbShift, toDbShiftInsert, toDbShiftUpdate } from "./schedule-mappers";
import type { Shift } from "../_components/schedule-types";

const supabase = createClient();

// ── Query: fetch shifts for a week ───────────────────────────

export function useShifts(weekStart: string, weekEnd: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: scheduleKeys.shifts(workspaceId, weekStart),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data.map(fromDbShift);
    },
  });
}

// ── Mutation: create shift ───────────────────────────────────

export function useCreateShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (shift: Omit<Shift, "id" | "createdAt" | "updatedAt" | "time">) => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .insert(toDbShiftInsert(shift, workspaceId))
        .select()
        .single();
      if (error) throw error;
      return fromDbShift(data);
    },
    onMutate: async (shift) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      const optimistic: Shift = {
        ...shift,
        id: `optimistic_${Date.now()}`,
        time: `${shift.startTime} - ${shift.endTime}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Shift[]>(scheduleKeys.shifts(workspaceId, weekStart), (old) => [
        ...(old ?? []),
        optimistic,
      ]);

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke opprette vakt");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}

// ── Mutation: update shift ───────────────────────────────────

export function useUpdateShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<Shift> }) => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .update(toDbShiftUpdate(changes))
        .eq("schedule_shift_id", id)
        .select()
        .single();
      if (error) throw error;
      return fromDbShift(data);
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      queryClient.setQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
        (old) =>
          old?.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...changes,
                  time:
                    changes.startTime && changes.endTime
                      ? `${changes.startTime} - ${changes.endTime}`
                      : s.time,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke oppdatere vakt");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}

// ── Mutation: delete shift ───────────────────────────────────

export function useDeleteShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_shift").delete().eq("schedule_shift_id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      queryClient.setQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
        (old) => old?.filter((s) => s.id !== id) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke slette vakt");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}

// ── Mutation: move shift (change employee + date) ────────────

export function useMoveShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      shiftId,
      toEmployeeId,
      toDateId,
    }: {
      shiftId: string;
      toEmployeeId: string;
      toDateId: string;
    }) => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .update({
          employee_id: toEmployeeId,
          shift_date: toDateId,
        })
        .eq("schedule_shift_id", shiftId)
        .select()
        .single();
      if (error) throw error;
      return fromDbShift(data);
    },
    onMutate: async ({ shiftId, toEmployeeId, toDateId }) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      queryClient.setQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
        (old) =>
          old?.map((s) =>
            s.id === shiftId
              ? {
                  ...s,
                  employeeId: toEmployeeId,
                  dateId: toDateId,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke flytte vakt");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}

// ── Mutation: publish shifts (batch) ─────────────────────────

export function usePublishShifts(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const { error } = await supabase
        .from("schedule_shift")
        .update({ status: "published", is_published: true })
        .in("schedule_shift_id", shiftIds);
      if (error) throw error;
    },
    onMutate: async (shiftIds) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      queryClient.setQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
        (old) =>
          old?.map((s) =>
            shiftIds.includes(s.id)
              ? {
                  ...s,
                  status: "published" as const,
                  isPublished: true,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke publisere vakter");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}

// ── Mutation: unpublish shifts (batch) ───────────────────────

export function useUnpublishShifts(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const { error } = await supabase
        .from("schedule_shift")
        .update({ status: "unpublished", is_published: false })
        .in("schedule_shift_id", shiftIds);
      if (error) throw error;
    },
    onMutate: async (shiftIds) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
      const previous = queryClient.getQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
      );

      queryClient.setQueryData<Shift[]>(
        scheduleKeys.shifts(workspaceId, weekStart),
        (old) =>
          old?.map((s) =>
            shiftIds.includes(s.id)
              ? {
                  ...s,
                  status: "unpublished" as const,
                  isPublished: false,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(scheduleKeys.shifts(workspaceId, weekStart), context.previous);
      }
      toast.error("Kunne ikke avpublisere vakter");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(workspaceId, weekStart) });
    },
  });
}
```

**Step 2: Verify types compile**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts
git commit -m "feat(schedule): add shift query and mutation hooks with optimistic updates"
```

---

## Task 6: Build Remaining Entity Hooks

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-templates.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-open-shifts.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-day-content.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-audit-log.ts`

These hooks follow the exact same pattern as `use-shifts.ts`. Each provides:

- A `useQuery` hook for fetching data
- `useMutation` hooks for CRUD with optimistic updates

**Step 1: Create use-absences.ts**

Follow the same pattern as shifts. Key differences:

- Table: `schedule_absence`
- PK: `schedule_absence_id`
- Query filters: `workspace_id`, `shift_date` range
- Mappers: `fromDbAbsence`, `toDbAbsenceInsert`
- Mutations: `useCreateAbsence`, `useDeleteAbsence`

**Step 2: Create use-templates.ts**

Key differences:

- Two tables: `schedule_template` + `schedule_template_shift`
- Query fetches templates with `.select("*, schedule_template_shift(*)")`
- `useSaveTemplate` inserts template + template_shifts in sequence
- `useLoadTemplate` reads template shifts and creates real shifts via `useCreateShift`
- `useDeleteTemplate` cascades to template_shifts

**Step 3: Create use-open-shifts.ts**

Key differences:

- Table: `schedule_open_shift`
- Not date-scoped (workspace-wide), staleTime: 5 minutes
- `useAssignOpenShift` deletes the open shift and creates a real shift (uses both tables)

**Step 4: Create use-day-content.ts**

Three query+mutation sets in one file:

- `useDayMessages` / `useCreateDayMessage` / `useDeleteDayMessage`
- `useDayTasks` / `useCreateDayTask` / `useUpdateDayTaskStatus` / `useDeleteDayTask`
- `useDayBookings` / `useCreateDayBooking`

**Step 5: Create use-audit-log.ts**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import { scheduleKeys } from "./schedule-keys";
import { fromDbAuditLog } from "./schedule-mappers";

const supabase = createClient();

export function useAuditLog(tableName: string, rowId: string) {
  return useQuery({
    queryKey: scheduleKeys.auditLog(`${tableName}:${rowId}`),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_audit_log")
        .select("*")
        .eq("table_name", tableName)
        .eq("row_id", rowId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map(fromDbAuditLog);
    },
    staleTime: 60 * 1000,
  });
}

export function useRollback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (auditLogId: string) => {
      const { data, error } = await supabase.rpc("rollback_audit_entry", {
        p_audit_log_id: auditLogId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Endring rullet tilbake");
    },
    onError: () => {
      toast.error("Kunne ikke rulle tilbake endringen");
    },
  });
}
```

**Step 6: Verify types compile**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

**Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/
git commit -m "feat(schedule): add all entity hooks — absences, templates, open shifts, day content, audit log"
```

---

## Task 7: Build Realtime Subscription Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-realtime.ts`

**Step 1: Create the realtime hook**

Create `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-realtime.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { scheduleKeys } from "./schedule-keys";

const supabase = createClient();

/**
 * Subscribes to Supabase Realtime for all schedule tables.
 * Scoped to workspace. Invalidates relevant queries on remote changes.
 * Call once in the schedule page's provider/layout component.
 */
export function useScheduleRealtime(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  useEffect(() => {
    const channel = supabase
      .channel(`schedule:${workspaceId}:${weekStart}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_shift",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.shifts(workspaceId, weekStart),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_absence",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.absences(workspaceId, weekStart),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_day_message",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.dayMessages(workspaceId, weekStart),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_day_task",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.dayTasks(workspaceId, weekStart),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_day_booking",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.dayBookings(workspaceId, weekStart),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_open_shift",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: scheduleKeys.openShifts(workspaceId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, weekStart, queryClient]);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-schedule-realtime.ts
git commit -m "feat(schedule): add Supabase Realtime subscription hook"
```

---

## Task 8: Build UI-Only State Context and Computed Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/schedule-ui-context.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-computed.ts`

**Step 1: Create schedule-ui-context.tsx**

This replaces the UI state portion of the old schedule-context.tsx. Only ephemeral client state — no DB persistence.

Create `apps/web/src/app/dashboard/schedule/_components/schedule-ui-context.tsx`:

```typescript
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { DayClipboard, Shift } from "./schedule-types";

type ScheduleUIState = {
  selectedShiftId: string | null;
  selectedDayId: string | null;
  clipboard: DayClipboard | null;
  selectedDays: Set<string>;
  createShiftContext: { dateId?: string; employeeId?: string } | null;
  absencePopover: { employeeId: string; dateId: string } | null;
};

type ScheduleUIActions = {
  setSelectedShift: (id: string | null) => void;
  setSelectedDay: (id: string | null) => void;
  setClipboard: (clipboard: DayClipboard | null) => void;
  toggleDaySelection: (dateId: string) => void;
  clearSelectedDays: () => void;
  setCreateShiftContext: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  setAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  copyDay: (dateId: string, dateLabel: string, shifts: Shift[]) => void;
};

type ScheduleUIContextValue = ScheduleUIState & ScheduleUIActions;

const ScheduleUIContext = createContext<ScheduleUIContextValue | null>(null);

export function ScheduleUIProvider({ children }: { children: ReactNode }) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [clipboard, setClipboardState] = useState<DayClipboard | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [createShiftContext, setCreateShiftContextState] = useState<{
    dateId?: string;
    employeeId?: string;
  } | null>(null);
  const [absencePopover, setAbsencePopoverState] = useState<{
    employeeId: string;
    dateId: string;
  } | null>(null);

  const toggleDaySelection = useCallback((dateId: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateId)) next.delete(dateId);
      else next.add(dateId);
      return next;
    });
  }, []);

  const clearSelectedDays = useCallback(() => setSelectedDays(new Set()), []);

  const copyDay = useCallback(
    (dateId: string, dateLabel: string, shifts: Shift[]) => {
      setClipboardState({
        sourceDate: dateId,
        sourceDateLabel: dateLabel,
        shifts: shifts.map(({ id: _id, dateId: _d, createdAt: _c, updatedAt: _u, ...rest }) => rest),
        absences: [],
      });
    },
    [],
  );

  return (
    <ScheduleUIContext.Provider
      value={{
        selectedShiftId,
        selectedDayId,
        clipboard,
        selectedDays,
        createShiftContext,
        absencePopover,
        setSelectedShift: setSelectedShiftId,
        setSelectedDay: setSelectedDayId,
        setClipboard: setClipboardState,
        toggleDaySelection,
        clearSelectedDays,
        setCreateShiftContext: setCreateShiftContextState,
        setAbsencePopover: setAbsencePopoverState,
        copyDay,
      }}
    >
      {children}
    </ScheduleUIContext.Provider>
  );
}

export function useScheduleUI(): ScheduleUIContextValue {
  const ctx = useContext(ScheduleUIContext);
  if (!ctx) throw new Error("useScheduleUI must be used within ScheduleUIProvider");
  return ctx;
}
```

**Step 2: Create use-schedule-computed.ts**

Port the `buildComputed` functions from the old context, now reading from TanStack Query data.

Create `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-computed.ts`:

```typescript
"use client";

import { useMemo } from "react";
import type {
  Absence,
  DayBooking,
  DayMessage,
  DayTask,
  Shift,
  ShiftTemplate,
} from "../_components/schedule-types";
import type {
  DayCoverage,
  DayStats,
  EmployeeStats,
  StatusSummary,
} from "../_components/schedule-context";

const HOURLY_RATE = 250;
const CONTRACTED_HOURS = 37.5;
const AML_MAX_HOURS = 40;

/**
 * Builds computed getters from query data.
 * Memoized — only recomputes when data changes.
 */
export function useScheduleComputed(
  shifts: Shift[],
  absences: Absence[],
  openShiftCount: number,
  templates: ShiftTemplate[],
  dayMessages: DayMessage[],
  dayTasks: DayTask[],
  dayBookings: DayBooking[],
) {
  return useMemo(() => {
    const getShiftsForDay = (dateId: string) => shifts.filter((s) => s.dateId === dateId);

    const getShiftsForEmployee = (employeeId: string) =>
      shifts.filter((s) => s.employeeId === employeeId);

    const getShiftsForCell = (employeeId: string, dateId: string) =>
      shifts.filter((s) => s.employeeId === employeeId && s.dateId === dateId);

    const getAbsencesForCell = (employeeId: string, dateId: string) =>
      absences.filter((a) => a.employeeId === employeeId && a.dateId === dateId);

    const getDayStats = (dateId: string): DayStats => {
      const dayShifts = getShiftsForDay(dateId);
      const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
      const dayAbsences = absences.filter((a) => a.dateId === dateId);
      return {
        staffCount: uniqueEmployees.size,
        shiftCount: dayShifts.length,
        estimatedCost: dayShifts.reduce((sum, s) => sum + s.workHours * HOURLY_RATE, 0),
        publishedCount: dayShifts.filter((s) => s.isPublished).length,
        draftCount: dayShifts.filter((s) => s.status === "created" || s.status === "assigned")
          .length,
        absenceCount: dayAbsences.length,
      };
    };

    const getEmployeeStats = (employeeId: string): EmployeeStats => {
      const empShifts = getShiftsForEmployee(employeeId);
      const totalHours = empShifts.reduce((sum, s) => sum + s.workHours, 0);
      return {
        totalHours,
        shiftCount: empShifts.length,
        isOvertime: totalHours > CONTRACTED_HOURS,
        overtimeHours: Math.max(0, totalHours - CONTRACTED_HOURS),
        contractedHours: CONTRACTED_HOURS,
      };
    };

    const getTemplatesForDepartment = (dept: string) =>
      templates.filter((t) => t.department === dept);

    const getMessagesForDay = (dateId: string) => dayMessages.filter((m) => m.dateId === dateId);

    const getTasksForDay = (dateId: string) => dayTasks.filter((t) => t.dateId === dateId);

    const getBookingsForDay = (dateId: string) => dayBookings.filter((b) => b.dateId === dateId);

    const TEAM_TARGETS: Record<string, number> = {
      Kjøkken: 3,
      "Sal & Service": 2,
      Bar: 2,
      Drift: 1,
    };

    const getCoverageForDay = (dateId: string): DayCoverage => {
      const dayShifts = getShiftsForDay(dateId);
      const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
      const byTeam: Record<string, { target: number; current: number }> = {};
      let hasGaps = false;
      for (const [team, target] of Object.entries(TEAM_TARGETS)) {
        const current = Math.min(
          target,
          dayShifts.length > 0 ? Math.ceil(dayShifts.length / 3) : 0,
        );
        byTeam[team] = { target, current };
        if (current < target) hasGaps = true;
      }
      return { totalStaff: uniqueEmployees.size, byTeam, hasGaps };
    };

    const getStatusSummary = (): StatusSummary => {
      const draftCount = shifts.filter(
        (s) => s.status === "created" || s.status === "assigned",
      ).length;
      const publishedCount = shifts.filter((s) => s.status === "published").length;
      const activeCount = shifts.filter((s) => s.status === "active").length;
      const completedCount = shifts.filter((s) => s.status === "completed").length;

      const uniqueDays = new Set(shifts.map((s) => s.dateId));
      let coverageRisks = 0;
      for (const dateId of uniqueDays) {
        if (getCoverageForDay(dateId).hasGaps) coverageRisks++;
      }

      const employeeHours = new Map<string, number>();
      for (const shift of shifts) {
        if (shift.employeeId) {
          employeeHours.set(
            shift.employeeId,
            (employeeHours.get(shift.employeeId) ?? 0) + shift.workHours,
          );
        }
      }

      let overtimeRisks = 0;
      let complianceRisks = 0;
      for (const hours of employeeHours.values()) {
        if (hours > CONTRACTED_HOURS) overtimeRisks++;
        if (hours > AML_MAX_HOURS) complianceRisks++;
      }

      return {
        coverageRisks,
        overtimeRisks,
        complianceRisks,
        openShiftQueue: openShiftCount,
        draftCount,
        publishedCount,
        activeCount,
        completedCount,
        absenceCount: absences.length,
        publishedState: draftCount > 0 ? "Draft endringer" : "Publisert",
      };
    };

    return {
      getShiftsForDay,
      getShiftsForEmployee,
      getShiftsForCell,
      getAbsencesForCell,
      getDayStats,
      getEmployeeStats,
      getTemplatesForDepartment,
      getMessagesForDay,
      getTasksForDay,
      getBookingsForDay,
      getCoverageForDay,
      getStatusSummary,
    };
  }, [shifts, absences, openShiftCount, templates, dayMessages, dayTasks, dayBookings]);
}
```

**Step 3: Verify types compile**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/schedule-ui-context.tsx apps/web/src/app/dashboard/schedule/_hooks/use-schedule-computed.ts
git commit -m "feat(schedule): add UI-only state context and computed values hook"
```

---

## Task 9: Update page.tsx — Swap Providers and Data Flow

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`

This is the integration task. Replace `ScheduleProvider` + dummy data with the new hooks + `ScheduleUIProvider`. The page component needs to:

1. Remove imports of `ScheduleProvider`, `buildInitialState`, dummy data
2. Import `ScheduleUIProvider` and all hooks
3. Calculate `weekStart`/`weekEnd` from current date
4. Call all query hooks at the top level
5. Pass query data to `useScheduleComputed`
6. Call `useScheduleRealtime` for live sync
7. Replace all `dispatch()` calls with mutation hooks
8. Replace all `state.` references with query data

**Step 1: Read the full page.tsx to understand all dispatch calls and state references**

Read `apps/web/src/app/dashboard/schedule/page.tsx` fully before making changes.

**Step 2: Refactor page.tsx**

Key changes:

- Remove `ScheduleProvider` wrapper and `legacyShifts` prop
- Add `ScheduleUIProvider` wrapper
- Create inner component `SchedulePageContent` that calls all hooks
- Replace `useSchedule()` calls with individual hooks
- Replace `dispatch({ type: 'X', payload })` with `mutationHook.mutate(payload)`

**Step 3: Verify it compiles**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): swap providers — TanStack Query replaces useReducer"
```

---

## Task 10: Update All Components — Replace dispatch() with Mutation Hooks

**Files to modify** (all in `apps/web/src/app/dashboard/schedule/_components/`):

- `shift-modal.tsx` — uses UPDATE_SHIFT, DELETE_SHIFT, SET_SELECTED_SHIFT
- `daily-grid.tsx` — uses SET_SELECTED_DAY, SET_SELECTED_SHIFT, SET_CREATE_SHIFT_CONTEXT
- `day-inspector.tsx` — uses getters, SET_SELECTED_DAY
- `absence-popover.tsx` — uses ADD_ABSENCE, SET_ABSENCE_POPOVER
- `batch-action-bar.tsx` — uses PUBLISH_SELECTED_DAYS, CLEAR_SELECTED_DAYS
- `booking-dialog.tsx` — uses ADD_BOOKING
- `broadcast-dialog.tsx` — no schedule state
- `create-template-dialog.tsx` — uses ADD_TEMPLATE
- `daily-briefing.tsx` — uses getters
- `day-context-menu.tsx` — uses COPY_DAY, SELECT_DAY
- `day-message-dialog.tsx` — uses ADD_MESSAGE
- `edit-template-dialog.tsx` — uses UPDATE_TEMPLATE
- `load-template-sheet.tsx` — uses LOAD_TEMPLATE
- `open-shift-dialog.tsx` — uses ADD_OPEN_SHIFT
- `planner-command-bar.tsx` — uses PUBLISH_ALL_DRAFTS
- `save-template-dialog.tsx` — uses SAVE_DAY_AS_TEMPLATE
- `schedule-toasts.tsx` — may need updates
- `status-strip.tsx` — uses getStatusSummary
- `grid-cards.tsx` — receives props, may use dispatch

**Migration pattern for each file:**

1. Replace `import { useSchedule } from "./schedule-context"` with the relevant hooks
2. Replace `const { state, dispatch, computed } = useSchedule()` with individual hooks
3. For UI-only state: `import { useScheduleUI } from "./schedule-ui-context"`
4. For mutations: import the specific mutation hook and call `.mutate()`
5. For computed: import from the parent or receive as props

**Step 1: Update each component one by one**

Work through each file. Most changes are mechanical — swap `dispatch({ type: 'X', payload })` with `hookName.mutate(payload)` and `useScheduleUI()` for UI state.

**Step 2: Verify all components compile**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/
git commit -m "feat(schedule): migrate all components from dispatch() to TanStack Query mutations"
```

---

## Task 11: Delete Old Files and Clean Up

**Files:**

- Delete: `apps/web/src/app/dashboard/schedule/_components/schedule-context.tsx`
- Delete: `apps/web/src/app/dashboard/schedule/_components/schedule-data.ts`

**Step 1: Verify no remaining imports of old files**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && grep -r "schedule-context" apps/web/src/app/dashboard/schedule/ --include="*.ts" --include="*.tsx"
grep -r "schedule-data" apps/web/src/app/dashboard/schedule/ --include="*.ts" --include="*.tsx"
```

Expected: Only the files themselves — no other imports remain.

**Step 2: Delete the files**

```bash
rm apps/web/src/app/dashboard/schedule/_components/schedule-context.tsx
rm apps/web/src/app/dashboard/schedule/_components/schedule-data.ts
```

**Step 3: Final typecheck**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web typecheck
```

Expected: No errors.

**Step 4: Lint check**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm --filter web lint
```

**Step 5: Commit**

```bash
git add -A apps/web/src/app/dashboard/schedule/
git commit -m "refactor(schedule): remove old useReducer context and dummy data"
```

---

## Task 12: Final Verification and WORKLOG Update

**Step 1: Full build check**

Run:

```bash
cd /home/sxtnl/dev/wt-2 && pnpm typecheck && pnpm lint
```

Expected: All pass.

**Step 2: Update WORKLOG**

Update `docs/WORKLOG.md` — mark Phase 1 tasks as done, add decision and log entries.

**Step 3: Create ADR**

Create an ADR for this architectural change in `docs/decisions/` — documenting the migration from useReducer to TanStack Query with Supabase Realtime.

**Step 4: Final commit**

```bash
git add docs/
git commit -m "docs(schedule): update worklog and add ADR for persistence migration"
```

---

## Summary

| Task | Description                                                 | Est. files |
| ---- | ----------------------------------------------------------- | ---------- |
| 1    | Install TanStack Query                                      | 1          |
| 2    | Add QueryClientProvider                                     | 2          |
| 3    | DB migration (7 tables + audit + triggers + RPC + realtime) | 2          |
| 4    | Query keys + type mappers                                   | 2          |
| 5    | Shift hooks (queries + mutations + optimistic)              | 1          |
| 6    | Remaining entity hooks (5 files)                            | 5          |
| 7    | Realtime subscription hook                                  | 1          |
| 8    | UI context + computed hook                                  | 2          |
| 9    | Update page.tsx (swap providers)                            | 1          |
| 10   | Update all 16 components (dispatch → mutations)             | 16         |
| 11   | Delete old files + cleanup                                  | 2          |
| 12   | Verification + docs                                         | 2          |

**Total: ~35 files touched, 12 tasks, 12 commits**
