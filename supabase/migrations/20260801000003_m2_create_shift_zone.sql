-- Migration M2: CREATE TABLE shift_zone + prerequisite UNIQUE indexes + RLS + channel_constraint seed
-- ADR-0430 Rule 1 (denormalized composite FK design) + Rule 2 (schema foundation) + Rule 9 (channel guard).
--
-- Prerequisite indexes on zone and day_line are created WITHOUT CONCURRENTLY because
-- CONCURRENTLY requires a transaction-free context and both tables are small enough
-- that a brief ShareLock is acceptable at migration time. See PLAN-0 AC-0.10 finding.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- Prerequisite: UNIQUE(zone_id, location_id) on zone
-- Required for composite FK: shift_zone.FOREIGN KEY (zone_id, location_id) REFERENCES zone
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_zone_id_location_id
  ON public.zone (zone_id, location_id);

-- ─────────────────────────────────────────────────────────────────
-- Prerequisite: UNIQUE(day_line_id, location_id) on day_line
-- Required for composite FK: shift_zone.FOREIGN KEY (day_line_id, location_id) REFERENCES day_line
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_day_line_id_location_id
  ON public.day_line (day_line_id, location_id);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: shift_zone
-- M:N junction — one shift_session_day_line can cover multiple zones,
-- one zone can host multiple shift_session_day_lines.
-- Denormalized location_id enables composite FK invariants per ADR-0430 Rule 1:
--   zone.location_id = day_line.location_id (enforced by DB, not application code).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.shift_zone (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_session_id      UUID NOT NULL,
  day_line_id           UUID NOT NULL,
  zone_id               UUID NOT NULL,
  location_id           UUID NOT NULL,  -- denormalized — sourced from shift_session.location_id at INSERT
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite FK: parent junction row must exist in shift_session_day_line
  CONSTRAINT fk_shift_zone_parent
    FOREIGN KEY (shift_session_id, day_line_id)
    REFERENCES public.shift_session_day_line(shift_session_id, day_line_id)
    ON DELETE CASCADE,

  -- Composite FK: zone must belong to the denormalized location_id
  -- (requires UNIQUE uq_zone_id_location_id created above)
  CONSTRAINT fk_shift_zone_zone
    FOREIGN KEY (zone_id, location_id)
    REFERENCES public.zone(zone_id, location_id),

  -- Composite FK: day_line must belong to the denormalized location_id
  -- (requires UNIQUE uq_day_line_id_location_id created above)
  CONSTRAINT fk_shift_zone_day_line_location
    FOREIGN KEY (day_line_id, location_id)
    REFERENCES public.day_line(day_line_id, location_id),

  -- Prevent duplicate zone assignments per (shift_session, day_line)
  CONSTRAINT uq_shift_zone_per_dayline
    UNIQUE (shift_session_id, day_line_id, zone_id)
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX ix_shift_zone_workspace  ON public.shift_zone (workspace_id);
CREATE INDEX ix_shift_zone_session    ON public.shift_zone (shift_session_id);
CREATE INDEX ix_shift_zone_day_line   ON public.shift_zone (day_line_id);
CREATE INDEX ix_shift_zone_zone       ON public.shift_zone (zone_id);

-- ─────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────
-- updated_at: use the shared project helper (mirrors all other tables)
CREATE TRIGGER trg_shift_zone_updated_at
  BEFORE UPDATE ON public.shift_zone
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- workspace_id denormalization: sourced from shift_session when not supplied
-- (mirrors set_department_location_workspace_id pattern from department_location)
CREATE OR REPLACE FUNCTION public.set_shift_zone_workspace_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.shift_session
    WHERE shift_session_id = NEW.shift_session_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shift_zone_workspace_id
  BEFORE INSERT ON public.shift_zone
  FOR EACH ROW EXECUTE FUNCTION public.set_shift_zone_workspace_id();

-- ─────────────────────────────────────────────────────────────────
-- RLS — 5-policy mirror of department_location pattern
-- (INSERT+DELETE only for writes; no UPDATE policy — zone assignments
-- are binary: delete + re-insert for changes, per ADR-0133 simplicity)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.shift_zone ENABLE ROW LEVEL SECURITY;

-- JWT SELECT — any workspace member can read zone assignments
CREATE POLICY "jwt_read_shift_zone"
  ON public.shift_zone FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT get_workspace_ids_for_user(auth.uid())
    )
  );

-- API key SELECT — workspace-api gateway (dual-auth per ADR-0039)
CREATE POLICY "api_key_read_shift_zone"
  ON public.shift_zone FOR SELECT
  TO anon
  USING (workspace_id = get_api_workspace_id());

-- JWT INSERT — admin only (zone assignment is admin-authored per ADR-0133)
CREATE POLICY "jwt_insert_shift_zone"
  ON public.shift_zone FOR INSERT
  TO authenticated
  WITH CHECK (
    (workspace_id IN (
      SELECT get_workspace_ids_for_user(auth.uid())
    ))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- JWT DELETE — admin only
CREATE POLICY "jwt_delete_shift_zone"
  ON public.shift_zone FOR DELETE
  TO authenticated
  USING (
    (workspace_id IN (
      SELECT get_workspace_ids_for_user(auth.uid())
    ))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Service role — unrestricted (bulk ops, migrations, cron)
CREATE POLICY "service_role_shift_zone"
  ON public.shift_zone
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────
-- Rule 9 seed: channel_constraint for roster.add_shift_manual
-- Column exists from migration 20260801000001. This seed ensures the
-- channel guard is enforced for ALL existing workspaces.
-- Uses UPSERT so it creates missing rows and updates existing ones.
-- When the capability row doesn't exist yet it gets inserted at
-- 'confirm' level (admin-authored per ADR-0133).
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, channel_constraint)
SELECT
  w.workspace_id,
  'roster.add_shift_manual',
  'confirm',
  'manager',
  'chat_only'
FROM public.workspace w
ON CONFLICT (workspace_id, capability)
DO UPDATE SET channel_constraint = 'chat_only';

COMMIT;
