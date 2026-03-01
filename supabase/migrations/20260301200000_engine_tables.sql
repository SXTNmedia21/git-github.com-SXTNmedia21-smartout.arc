-- ============================================
-- 20260301200000_engine_tables.sql
-- Creates the 4 core tables for the Stage Engine:
--   engine_missions — reusable agent workflow definitions
--   engine_stages   — ordered steps within missions
--   engine_sessions — active conversation state
--   engine_inbox    — generic data inbox for agent-stored data
-- Connected to: ARCHITECTURE.md §3 (full schema specification)
-- ============================================

-- ----------------------------------------
-- engine_missions
-- A mission is a reusable template for an agent workflow.
-- Missions have modes: sequential (ordered stages), free (agent chooses),
-- or hybrid (fixed start/end, free middle).
-- ----------------------------------------
CREATE TABLE engine_missions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  mode            TEXT NOT NULL DEFAULT 'sequential'
                    CHECK (mode IN ('sequential', 'free', 'hybrid')),
  context_source  TEXT,
  workspace_id    UUID REFERENCES workspace(workspace_id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_missions ENABLE ROW LEVEL SECURITY;

-- Global missions (workspace_id IS NULL) are readable by everyone.
-- Workspace missions are readable by workspace members (JWT) or API key auth.
CREATE POLICY "read_missions" ON engine_missions
FOR SELECT USING (
  workspace_id IS NULL
  OR workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Only service role can insert/update/delete missions
CREATE POLICY "manage_missions" ON engine_missions
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX idx_engine_missions_context ON engine_missions (context_source)
  WHERE is_active = true;
CREATE INDEX idx_engine_missions_workspace ON engine_missions (workspace_id)
  WHERE is_active = true;

-- ----------------------------------------
-- engine_stages
-- A stage is one step within a mission. Contains agent instructions,
-- personality overlay, and navigation rules.
-- ----------------------------------------
CREATE TABLE engine_stages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id              TEXT NOT NULL REFERENCES engine_missions(id) ON DELETE CASCADE,
  stage_id                TEXT NOT NULL,
  stage_order             INTEGER NOT NULL,
  goal                    TEXT NOT NULL,
  instructions            TEXT NOT NULL,
  success_criteria        TEXT NOT NULL,
  escalation_instructions TEXT,
  personality_override    TEXT,
  emotion_hint            TEXT,
  creative_freedom        REAL NOT NULL DEFAULT 0.7
                            CHECK (creative_freedom >= 0 AND creative_freedom <= 1),
  next_stage              TEXT,
  is_required             BOOLEAN NOT NULL DEFAULT true,
  deferred_templates      JSONB DEFAULT '[]',
  inline_instructions     JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_mission_stage UNIQUE (mission_id, stage_id),
  CONSTRAINT uq_mission_order UNIQUE (mission_id, stage_order)
);

ALTER TABLE engine_stages ENABLE ROW LEVEL SECURITY;

-- Stages inherit mission visibility via subquery on engine_missions
CREATE POLICY "read_stages" ON engine_stages
FOR SELECT USING (
  mission_id IN (SELECT id FROM engine_missions)
);

CREATE POLICY "manage_stages" ON engine_stages
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX idx_engine_stages_mission ON engine_stages (mission_id, stage_order);

-- ----------------------------------------
-- engine_sessions
-- A session is one active run of a mission. Tracks user identity,
-- current stage, collected data, and lifecycle status.
-- ----------------------------------------
CREATE TABLE engine_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      TEXT NOT NULL REFERENCES engine_missions(id),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  user_id         UUID,
  profile_id      UUID,
  channel         TEXT NOT NULL
                    CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous')),
  current_stage_id TEXT,
  stage_index      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'complete', 'expired', 'abandoned')),
  context          JSONB NOT NULL DEFAULT '{}',
  collected_data   JSONB NOT NULL DEFAULT '{}',
  summary          TEXT,
  callback_url     TEXT,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_sessions ENABLE ROW LEVEL SECURITY;

-- Workspace isolation: JWT users see their workspace, API key auth uses set_config
CREATE POLICY "workspace_isolation_sessions" ON engine_sessions
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

CREATE INDEX idx_engine_sessions_workspace_status
  ON engine_sessions (workspace_id, status)
  WHERE status = 'active';
CREATE INDEX idx_engine_sessions_expiry
  ON engine_sessions (expires_at)
  WHERE status = 'active';
CREATE INDEX idx_engine_sessions_mission
  ON engine_sessions (mission_id, workspace_id, status);

-- ----------------------------------------
-- engine_inbox
-- Generic data inbox where agents store collected information.
-- Categorized by entity_type, processed asynchronously later.
-- ----------------------------------------
CREATE TABLE engine_inbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES engine_sessions(id) ON DELETE CASCADE,
  stage_id        TEXT NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  entity_type     TEXT NOT NULL,
  data            JSONB NOT NULL,
  validated       BOOLEAN NOT NULL DEFAULT false,
  processed       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_inbox ENABLE ROW LEVEL SECURITY;

-- Workspace isolation matches sessions policy
CREATE POLICY "workspace_isolation_inbox" ON engine_inbox
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM profile
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

CREATE INDEX idx_engine_inbox_session ON engine_inbox (session_id, stage_id);
CREATE INDEX idx_engine_inbox_processing ON engine_inbox (workspace_id, processed)
  WHERE processed = false;
