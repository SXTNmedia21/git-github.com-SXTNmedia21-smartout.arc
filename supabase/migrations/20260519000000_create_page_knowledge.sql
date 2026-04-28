-- Page Knowledge engine — per-route metadata for the page-polish workflow
-- and for Botsson runtime context lookups.
--
-- workspace_id NULL = platform default (visible to all authenticated users)
-- workspace_id non-null = workspace-specific override (only members of that workspace)
--
-- Source of truth for header/description/empty-copy/error-copy/datapoints/api_routes/harness_tools.
-- Surfaced in `.claude/page-polish/<route>.run.yml` worksheets (which then sync to this table).
--
-- Migration ordering: tip at write time was 20260518230000 (journey_guide_table).
-- L-0042 — timestamps are causal, must be strictly greater than tip.

CREATE TABLE public.page_knowledge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route           TEXT NOT NULL,
  workspace_id    UUID NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  -- Display copy
  header          TEXT,
  description     TEXT,
  empty_copy      TEXT,
  error_copy      TEXT,

  -- Structured arrays (validated by app code, not DB)
  datapoints      JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{name, source_table, hook, type}]
  api_routes      JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{method, path, role, used_by}]
  harness_tools   JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{key, description, parameters}]

  -- Snapshot fields
  components      INTEGER,                                -- count of .tsx components in route dir
  metrics         JSONB,                                  -- {lcp_ms, cls, tti_ms, captured_at}

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per (route, workspace) pair. NULLS NOT DISTINCT (Postgres 15+) treats
  -- NULL workspace_id as a single value, so only ONE platform default per route.
  CONSTRAINT page_knowledge_route_workspace_unique
    UNIQUE NULLS NOT DISTINCT (route, workspace_id)
);

CREATE INDEX idx_page_knowledge_route ON public.page_knowledge(route);
CREATE INDEX idx_page_knowledge_workspace ON public.page_knowledge(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE TRIGGER set_page_knowledge_updated_at
  BEFORE UPDATE ON public.page_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.page_knowledge ENABLE ROW LEVEL SECURITY;

-- JWT read: platform defaults (workspace_id IS NULL) visible to all authenticated;
--           workspace-specific rows visible only to members of that workspace.
CREATE POLICY "jwt_read_page_knowledge" ON public.page_knowledge
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- JWT write: workspace admins/owners write workspace-specific rows.
--           Platform-default rows (workspace_id IS NULL) writable only by godmode.
CREATE POLICY "jwt_write_page_knowledge" ON public.page_knowledge
  FOR ALL TO authenticated
  USING (
    (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM public.user_identity ui WHERE ui.id = auth.uid() AND ui.is_godmode = true
    ))
    OR (workspace_id IS NOT NULL AND public.is_admin_in_workspace(auth.uid(), workspace_id))
  )
  WITH CHECK (
    (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM public.user_identity ui WHERE ui.id = auth.uid() AND ui.is_godmode = true
    ))
    OR (workspace_id IS NOT NULL AND public.is_admin_in_workspace(auth.uid(), workspace_id))
  );

-- API key read (dual-auth path)
CREATE POLICY "api_key_read_page_knowledge" ON public.page_knowledge
  FOR SELECT TO anon
  USING (
    workspace_id IS NULL
    OR workspace_id = public.get_api_workspace_id()
  );

COMMENT ON TABLE public.page_knowledge IS 'Per-route page metadata: header, description, empty/error copy, datapoint registry, API routes, harness tools. workspace_id NULL = platform default; non-null = workspace override. Source of truth for Botsson page-context lookups and the page-polish workflow.';
COMMENT ON COLUMN public.page_knowledge.datapoints IS 'JSONB array. Each entry: { name: string, source_table: string, hook: string, type: "query" | "mutation" }';
COMMENT ON COLUMN public.page_knowledge.api_routes IS 'JSONB array. Each entry: { method: "GET"|"POST"|..., path: string, role: string, used_by: string }';
COMMENT ON COLUMN public.page_knowledge.harness_tools IS 'JSONB array. Each entry: { key: string, description: string, parameters: object }';
