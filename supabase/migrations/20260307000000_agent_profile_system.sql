SET search_path TO public, extensions;

-- ============================================
-- Agent Profile System
-- Two new tables + engine_memory extensions
-- Design: docs/plans/2026-03-07-agent-profile-system-design.md
-- ============================================

-- 1. agent_profile — one per workspace, Mr. Botsson's DNA
CREATE TABLE IF NOT EXISTS agent_profile (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,

  -- Identity
  display_name       text NOT NULL DEFAULT 'Mr. Botsson',
  greeting           text NOT NULL DEFAULT 'Hei! Hva kan jeg hjelpe deg med?',
  language           text NOT NULL DEFAULT 'no' CHECK (language IN ('no', 'en', 'sv')),

  -- Voice DNA
  default_voice      text NOT NULL DEFAULT 'mark',
  voice_speed        decimal NOT NULL DEFAULT 1.0 CHECK (voice_speed BETWEEN 0.5 AND 2.0),
  voice_temperature  decimal NOT NULL DEFAULT 0.3 CHECK (voice_temperature BETWEEN 0.0 AND 1.0),
  voice_stability    decimal NOT NULL DEFAULT 0.7 CHECK (voice_stability BETWEEN 0.0 AND 1.0),

  -- Personality (0.0–1.0 sliders)
  formality          decimal NOT NULL DEFAULT 0.5 CHECK (formality BETWEEN 0.0 AND 1.0),
  assertiveness      decimal NOT NULL DEFAULT 0.5 CHECK (assertiveness BETWEEN 0.0 AND 1.0),
  warmth             decimal NOT NULL DEFAULT 0.7 CHECK (warmth BETWEEN 0.0 AND 1.0),
  humor              decimal NOT NULL DEFAULT 0.2 CHECK (humor BETWEEN 0.0 AND 1.0),
  verbosity          decimal NOT NULL DEFAULT 0.4 CHECK (verbosity BETWEEN 0.0 AND 1.0),

  -- Posture adaptation flags
  adapt_to_role      boolean NOT NULL DEFAULT true,
  adapt_to_situation boolean NOT NULL DEFAULT true,
  adapt_to_authority boolean NOT NULL DEFAULT true,

  -- Metadata
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES user_identity(user_id),

  CONSTRAINT unique_workspace_agent UNIQUE (workspace_id)
);

ALTER TABLE agent_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_profile_read" ON agent_profile;
CREATE POLICY "agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "agent_profile_write" ON agent_profile;
CREATE POLICY "agent_profile_write" ON agent_profile
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS "api_key_agent_profile_read" ON agent_profile;
CREATE POLICY "api_key_agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

CREATE OR REPLACE TRIGGER set_agent_profile_updated_at
  BEFORE UPDATE ON agent_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE agent_profile IS 'Per-workspace AI agent identity: voice DNA, personality sliders, posture adaptation flags.';


-- 2. agent_relationship — one per agent × employee
CREATE TABLE IF NOT EXISTS agent_relationship (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  agent_profile_id    uuid NOT NULL REFERENCES agent_profile(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,

  -- Familiarity
  total_conversations integer NOT NULL DEFAULT 0,
  total_minutes       decimal NOT NULL DEFAULT 0,
  last_interaction_at timestamptz,
  familiarity_score   decimal NOT NULL DEFAULT 0.0 CHECK (familiarity_score BETWEEN 0.0 AND 1.0),

  -- Trust & Competence
  protocols_completed integer NOT NULL DEFAULT 0,
  protocols_assigned  integer NOT NULL DEFAULT 0,
  readiness_score     decimal NOT NULL DEFAULT 0.0 CHECK (readiness_score BETWEEN 0.0 AND 1.0),
  accuracy_score      decimal NOT NULL DEFAULT 0.5 CHECK (accuracy_score BETWEEN 0.0 AND 1.0),
  trust_score         decimal NOT NULL DEFAULT 0.0 CHECK (trust_score BETWEEN 0.0 AND 1.0),

  -- Sentiment
  positive_count      integer NOT NULL DEFAULT 0,
  neutral_count       integer NOT NULL DEFAULT 0,
  negative_count      integer NOT NULL DEFAULT 0,
  sentiment_trend     decimal NOT NULL DEFAULT 0.0 CHECK (sentiment_trend BETWEEN -1.0 AND 1.0),
  sentiment_score     decimal NOT NULL DEFAULT 0.5 CHECK (sentiment_score BETWEEN 0.0 AND 1.0),

  -- Composite
  relationship_score  decimal NOT NULL DEFAULT 0.0 CHECK (relationship_score BETWEEN 0.0 AND 1.0),

  -- Metadata
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_agent_profile_rel UNIQUE (agent_profile_id, profile_id)
);

ALTER TABLE agent_relationship ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_relationship_read_own" ON agent_relationship;
CREATE POLICY "agent_relationship_read_own" ON agent_relationship
  FOR SELECT USING (
    profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "agent_relationship_read_admin" ON agent_relationship;
CREATE POLICY "agent_relationship_read_admin" ON agent_relationship
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS "api_key_agent_relationship_read" ON agent_relationship;
CREATE POLICY "api_key_agent_relationship_read" ON agent_relationship
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

CREATE INDEX IF NOT EXISTS idx_agent_relationship_workspace ON agent_relationship(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationship_profile ON agent_relationship(profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationship_composite ON agent_relationship(agent_profile_id, relationship_score DESC);

CREATE OR REPLACE TRIGGER set_agent_relationship_updated_at
  BEFORE UPDATE ON agent_relationship
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE agent_relationship IS 'Per-agent-per-employee relationship: familiarity, trust/competence, sentiment.';


-- 3. Extend engine_memory
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_memory' AND column_name = 'agent_profile_id') THEN
    ALTER TABLE engine_memory ADD COLUMN IF NOT EXISTS agent_profile_id uuid REFERENCES agent_profile(id) ON DELETE SET NULL,
  ADD COLUMN scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'workspace')),
  ADD COLUMN importance decimal NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0.0 AND 1.0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_engine_memory_agent ON engine_memory(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_engine_memory_scope ON engine_memory(workspace_id, scope);

COMMENT ON COLUMN engine_memory.scope IS 'personal = this profile only, team = team-wide, workspace = everyone';
COMMENT ON COLUMN engine_memory.importance IS '0-1 ranking for retrieval priority';
