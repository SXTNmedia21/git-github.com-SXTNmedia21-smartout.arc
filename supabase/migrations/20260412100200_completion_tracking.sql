SET search_path TO public, extensions;

-- ============================================
-- 20260412100200_completion_tracking.sql
-- Permanent completion records for training governance:
--   knowledge_test_attempt — quiz/test results
--   confirmation_signature — policy acknowledgements
--   procedure_step_completion — step-by-step training progress
-- Source: Module Zero to Production — Week 2
-- ============================================

-- ── knowledge_test_attempt ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_test_attempt (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id             UUID NOT NULL REFERENCES profile(profile_id),
  knowledge_test_id      UUID NOT NULL REFERENCES knowledge_test(knowledge_test_id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(assignment_id),
  score                  NUMERIC(5,2),
  passed                 BOOLEAN NOT NULL DEFAULT false,
  answers                JSONB NOT NULL DEFAULT '{}',
  attempted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_test_attempt ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_knowledge_test_attempt" ON knowledge_test_attempt;
CREATE POLICY "jwt_read_knowledge_test_attempt" ON knowledge_test_attempt
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: workspace members can insert (employees taking tests)
DROP POLICY IF EXISTS "jwt_insert_knowledge_test_attempt" ON knowledge_test_attempt;
CREATE POLICY "jwt_insert_knowledge_test_attempt" ON knowledge_test_attempt
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_knowledge_test_attempt" ON knowledge_test_attempt;
CREATE POLICY "service_role_knowledge_test_attempt" ON knowledge_test_attempt
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_knowledge_test_attempt_profile
  ON knowledge_test_attempt (profile_id, knowledge_test_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_test_attempt_assignment
  ON knowledge_test_attempt (protocol_assignment_id)
  WHERE protocol_assignment_id IS NOT NULL;

COMMENT ON TABLE knowledge_test_attempt IS 'Permanent record of knowledge test attempts. Score + pass/fail per attempt.';

-- ── confirmation_signature ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.confirmation_signature (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id             UUID NOT NULL REFERENCES profile(profile_id),
  confirmation_id        UUID NOT NULL REFERENCES confirmation(confirmation_id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(assignment_id),
  signed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_data         JSONB NOT NULL DEFAULT '{}',
  ip_address             INET,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE confirmation_signature ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_confirmation_signature" ON confirmation_signature;
CREATE POLICY "jwt_read_confirmation_signature" ON confirmation_signature
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: workspace members can insert (employees signing confirmations)
DROP POLICY IF EXISTS "jwt_insert_confirmation_signature" ON confirmation_signature;
CREATE POLICY "jwt_insert_confirmation_signature" ON confirmation_signature
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_confirmation_signature" ON confirmation_signature;
CREATE POLICY "service_role_confirmation_signature" ON confirmation_signature
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_confirmation_signature_profile
  ON confirmation_signature (profile_id, confirmation_id);

COMMENT ON TABLE confirmation_signature IS 'Permanent record of policy/confirmation signatures. Immutable once created.';

-- ── procedure_step_completion ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.procedure_step_completion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id             UUID NOT NULL REFERENCES profile(profile_id),
  procedure_step_id      UUID NOT NULL REFERENCES procedure_step(step_id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(assignment_id),
  completed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One completion per step per assignment (or per step if no assignment)
  CONSTRAINT uq_procedure_step_completion
    UNIQUE (profile_id, procedure_step_id, protocol_assignment_id)
);

ALTER TABLE procedure_step_completion ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_procedure_step_completion" ON procedure_step_completion;
CREATE POLICY "jwt_read_procedure_step_completion" ON procedure_step_completion
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: workspace members can insert (employees completing steps)
DROP POLICY IF EXISTS "jwt_insert_procedure_step_completion" ON procedure_step_completion;
CREATE POLICY "jwt_insert_procedure_step_completion" ON procedure_step_completion
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_procedure_step_completion" ON procedure_step_completion;
CREATE POLICY "service_role_procedure_step_completion" ON procedure_step_completion
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_procedure_step_completion_profile
  ON procedure_step_completion (profile_id, protocol_assignment_id);

COMMENT ON TABLE procedure_step_completion IS 'Permanent record of procedure step completions. Evidence optional.';
