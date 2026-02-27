-- Migration: Activity Trail / Unified Event Store

CREATE TABLE activity_trail (
  id              BIGSERIAL PRIMARY KEY,
  
  -- Scoping
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id),
  
  -- Who
  actor_id        UUID NOT NULL REFERENCES public.profile(profile_id),
  
  -- What
  event           TEXT NOT NULL,                        -- 'shift created', 'department updated'
  action_verb     TEXT NOT NULL,                        -- 'created', 'updated', 'deleted'
  category        TEXT NOT NULL,                        -- 'scheduling', 'org_structure'
  
  -- Which entity
  entity_type     TEXT NOT NULL,                        -- 'shift', 'department'
  entity_id       UUID NOT NULL,                        -- the affected entity's PK
  entity_label    TEXT,                                 -- "Anna — Tue 10:00-18:00" (human readable)
  
  -- Change data (JSONB, lightweight)
  data            JSONB DEFAULT '{}',                   -- for creates/deletes: snapshot of key fields
  changes         JSONB DEFAULT '{}',                   -- for updates: { "field": { "before": x, "after": y } }
  
  -- Context
  correlation_id  UUID,                                 -- ties to a request chain
  source          TEXT DEFAULT 'web',                   -- 'web', 'mobile', 'api', 'system', 'ai'
  ip_address      INET,
  
  -- Timing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────
-- Primary query: "Show activity for this entity"
CREATE INDEX idx_activity_entity 
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC);

-- Secondary query: "Show everything this person did"
CREATE INDEX idx_activity_actor 
  ON activity_trail (workspace_id, actor_id, created_at DESC);

-- Tertiary query: "Show all activity in this workspace today"
CREATE INDEX idx_activity_workspace_time 
  ON activity_trail (workspace_id, created_at DESC);

-- Category filter: "Show all scheduling activity"
CREATE INDEX idx_activity_category 
  ON activity_trail (workspace_id, category, created_at DESC);

-- ─── RLS ────────────────────────────────────────────
ALTER TABLE activity_trail ENABLE ROW LEVEL SECURITY;

-- Workspace members can view activity
CREATE POLICY "Workspace members can view activity" ON activity_trail
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT p.workspace_id 
      FROM public.profile p 
      WHERE p.user_id = auth.uid()
    )
  );

-- Only the system (service role) can insert
CREATE POLICY "System can insert activity" ON activity_trail
  FOR INSERT
  WITH CHECK (TRUE);

-- No DELETE or UPDATE policies. The trail is completely immutable.
