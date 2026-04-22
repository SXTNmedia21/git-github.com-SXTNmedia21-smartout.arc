-- ============================================
-- 20260516000000_journey_version_table.sql
--
-- Purpose:
--   Create the `journey_version` table — the canonical store for versioned
--   JourneyIR payloads. Each row is a draft / testable / publishable snapshot
--   of a journey authored on the admin surface. At this migration the `status`
--   column is plain `text` (with a literal 'draft' default); the
--   `journey_version_status` enum is introduced in 0a and the column is flipped
--   in 0b per L-0075 (0a/0b/0c atomicity pattern).
--
-- ADR Reference:
--   ADR-0172 — `journey_version_status` enum lifecycle (text → enum flip).
--   ADR-0171 — canonical JourneyIR package path (ir_json placeholder column).
--   ADR-0175 — journey telemetry contract (references journey_version.journey_version_id).
--
-- Why `status text` (not enum) in this migration:
--   The sibling `journey_status` enum on the pre-existing `journey` table
--   collides on the `ready_test` value (ADR-0172), so we cannot `ALTER TYPE …
--   ADD VALUE`. A separate `journey_version_status` enum is required, but
--   introducing an enum + column type change + backfill in one migration
--   violates L-0075. Instead: text now, enum in 0a, flip in 0b, tighten in 0c.
--
-- Dependencies (must exist before this migration):
--   - `workspace` table (00001_identity_tables.sql)
--   - `journey` table (20260301140000_journey_system.sql) — FK target
--   - `set_updated_at()` function (00001_identity_tables.sql)
--   - `get_workspace_ids_for_user(uuid)` (identity helpers)
--   - `get_api_workspace_id()` (identity helpers)
--
-- Risk level: LOW
--   New table, no data, no change to sibling tables. Enum flip deferred to 0b.
--
-- ROLLBACK (for reference, not auto-executed):
--   DROP TABLE IF EXISTS public.journey_version CASCADE;
--   -- triggers, policies, indexes are dropped cascadingly with the table.
-- ============================================

SET search_path TO public, extensions;

-- ── Table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.journey_version (
  journey_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  journey_id         UUID NOT NULL REFERENCES public.journey(journey_id) ON DELETE CASCADE,
  version_number     INT NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'draft', -- flipped to journey_version_status in 0b
  ir_json            JSONB, -- JourneyIR payload; package (packages/journey-ir) lands in M2
  created_by         UUID, -- no FK (matches repo convention for other created_by columns)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_journey_version_number
    UNIQUE (workspace_id, journey_id, version_number)
);

COMMENT ON TABLE public.journey_version IS
  'Versioned snapshot of a journey''s IR. status uses journey_version_status enum (ADR-0172).';
COMMENT ON COLUMN public.journey_version.status IS
  'Lifecycle: draft | ready_test | testing | ready_publish | published | archived (ADR-0172). Text in this migration; enum in 0b.';
COMMENT ON COLUMN public.journey_version.ir_json IS
  'JourneyIR payload (ADR-0171). Shape defined by packages/journey-ir in M2.';

-- ── Trigger ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_journey_version_updated_at ON public.journey_version;
CREATE TRIGGER set_journey_version_updated_at
  BEFORE UPDATE ON public.journey_version
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_journey_version_journey_id
  ON public.journey_version (journey_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_journey_version_workspace_status
  ON public.journey_version (workspace_id, status);

-- ── RLS ─────────────────────────────────────────────────

ALTER TABLE public.journey_version ENABLE ROW LEVEL SECURITY;

-- JWT: per-op (select/insert/update/delete) workspace-scoped
DROP POLICY IF EXISTS "jwt_select_journey_version" ON public.journey_version;
CREATE POLICY "jwt_select_journey_version" ON public.journey_version
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_insert_journey_version" ON public.journey_version;
CREATE POLICY "jwt_insert_journey_version" ON public.journey_version
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_update_journey_version" ON public.journey_version;
CREATE POLICY "jwt_update_journey_version" ON public.journey_version
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_delete_journey_version" ON public.journey_version;
CREATE POLICY "jwt_delete_journey_version" ON public.journey_version
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- API key: read access only (writes happen via JWT sessions)
DROP POLICY IF EXISTS "api_key_read_journey_version" ON public.journey_version;
CREATE POLICY "api_key_read_journey_version" ON public.journey_version
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role (Edge Functions, migrations, admin tools)
DROP POLICY IF EXISTS "service_role_journey_version" ON public.journey_version;
CREATE POLICY "service_role_journey_version" ON public.journey_version
  FOR ALL USING (auth.role() = 'service_role');
