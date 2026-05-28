-- ============================================================================
-- HQ Workspace Location Reshape (ADR-0429 demo fixture)
-- Reshape locations from property-shape (Oslo Downtown Hub / Bergen Harbor /
-- Stavanger Riverside) to area-shape (Sal / Kjøkken / Bar / Eventsal / Frokost).
-- Scoped to HQ Workspace UUID only — other workspaces untouched.
-- ADR-0429: I1 seed shape for new workspaces. This migration patches existing
-- HQ Workspace fixture to match the new area-shape for Dagslinjen parity.
-- ============================================================================

DO $$
DECLARE
  v_ws CONSTANT uuid := 'b0000000-0000-0000-0000-000000000000';
BEGIN
  -- Idempotency gate: only run if workspace exists
  IF NOT EXISTS (SELECT 1 FROM workspace WHERE workspace_id = v_ws) THEN
    RAISE NOTICE 'HQ Workspace not present; migration skipped';
    RETURN;
  END IF;

  -- ── Rename existing 3 locations to area-shape ──────────────────────────
  UPDATE location SET name = 'Sal',     slug = 'sal'     WHERE location_id = 'c0000000-0000-0000-0000-000000000000' AND workspace_id = v_ws;
  UPDATE location SET name = 'Kjøkken', slug = 'kjokken' WHERE location_id = 'c0000000-0000-0000-0000-000000000001' AND workspace_id = v_ws;
  UPDATE location SET name = 'Bar',     slug = 'bar'     WHERE location_id = 'c0000000-0000-0000-0000-000000000002' AND workspace_id = v_ws;

  -- ── Insert 2 additional area-locations (idempotent) ────────────────────
  INSERT INTO location (location_id, workspace_id, name, slug, location_type, is_active, source)
  VALUES
    ('c0000000-0000-0000-0000-000000000003', v_ws, 'Eventsal', 'eventsal', 'event'::location_type, true, 'v3_engine'),
    ('c0000000-0000-0000-0000-000000000004', v_ws, 'Frokost',  'frokost',  'main'::location_type,  true, 'v3_engine')
  ON CONFLICT (location_id) DO NOTHING;

  -- ── Reset dept_location M:N for HQ Workspace ──────────────────────────
  -- Per ADR-0429 hospitality semantics (existing Operations/Kitchen/Service/Bar depts):
  -- Operations × {Sal, Kjøkken, Bar, Eventsal, Frokost}   (cross-cutting admin)
  -- Kitchen    × {Kjøkken, Sal}                            (prep + service-window)
  -- Service    × {Sal, Eventsal, Frokost}                  (front-of-house service)
  -- Bar        × {Bar, Eventsal}                           (bar service)
  --
  -- workspace_id auto-set from department via trigger (set_department_location_workspace_id).
  -- Idempotent: ON CONFLICT DO NOTHING; existing pairings preserved.
  INSERT INTO department_location (department_id, location_id)
  VALUES
    -- Operations × all 5
    ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000000'),
    ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004'),
    -- Kitchen × Kjøkken, Sal
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000'),
    -- Service × Sal, Eventsal, Frokost
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000'),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003'),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004'),
    -- Bar × Bar, Eventsal
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002'),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003')
  ON CONFLICT (department_id, location_id) DO NOTHING;

  -- ── Seed department_session for 2026-05-28 ────────────────────────────
  INSERT INTO department_session (workspace_id, department_id, session_date, status, planned_open, planned_close)
  SELECT v_ws, d.department_id, '2026-05-28'::date, 'active'::department_session_status,
         CASE d.name WHEN 'Operations' THEN TIME '06:00' WHEN 'Kitchen' THEN TIME '07:00' WHEN 'Service' THEN TIME '11:00' WHEN 'Bar' THEN TIME '15:00' END,
         CASE d.name WHEN 'Operations' THEN TIME '11:00' WHEN 'Kitchen' THEN TIME '23:30' WHEN 'Service' THEN TIME '23:00' WHEN 'Bar' THEN TIME '23:59' END
  FROM department d
  WHERE d.workspace_id = v_ws
  ON CONFLICT (workspace_id, department_id, session_date) DO NOTHING;

  -- ── Backfill day_line for 2026-05-28 (one per dept_session × location pairing) ──
  INSERT INTO day_line (workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close, is_backfilled)
  SELECT v_ws, ds.department_session_id, ds.department_id, dl.location_id, '2026-05-28'::date,
         COALESCE(ds.planned_open, TIME '00:00'),
         COALESCE(ds.planned_close, TIME '23:59'),
         true
  FROM department_session ds
  JOIN department_location dl ON dl.department_id = ds.department_id
  WHERE ds.workspace_id = v_ws AND ds.session_date = '2026-05-28'
  ON CONFLICT (department_session_id, location_id) DO NOTHING;

  RAISE NOTICE 'HQ Workspace area-reshape complete: 5 locations, 12 dept_location pairings, day_lines for 2026-05-28 backfilled';
END $$;
