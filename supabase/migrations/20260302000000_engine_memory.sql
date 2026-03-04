SET search_path TO public, extensions;

-- 20260302000000_engine_memory.sql
-- Persistent memory for Mr. Botsson — stores employee preferences,
-- facts, and conversation summaries across sessions.

-- Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS engine_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id),
  memory_type       TEXT NOT NULL CHECK (memory_type IN ('preference', 'fact', 'summary')),
  content           TEXT NOT NULL,
  embedding         vector(1536),
  source_session_id UUID REFERENCES engine_sessions(id) ON DELETE SET NULL,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_memory" ON engine_memory;
CREATE POLICY "jwt_read_memory" ON engine_memory
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profile
    WHERE user_id = auth.uid() AND is_active = true
  )
);

DROP POLICY IF EXISTS "api_key_read_memory" ON engine_memory;
CREATE POLICY "api_key_read_memory" ON engine_memory
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

DROP POLICY IF EXISTS "manage_memory" ON engine_memory;
CREATE POLICY "manage_memory" ON engine_memory
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX IF NOT EXISTS idx_engine_memory_embedding ON engine_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_engine_memory_profile ON engine_memory (workspace_id, profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_memory_expiry ON engine_memory (expires_at)
  WHERE expires_at IS NOT NULL;
