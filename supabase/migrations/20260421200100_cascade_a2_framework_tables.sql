-- ============================================
-- 20260421200100_cascade_a2_framework_tables.sql
-- Cascade A2: 6 framework model tables
-- Spec: Section 4.1 (framework table schemas)
-- Depends on: A1 tables (change_proposal), A2 enums
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. regulatory_framework (Versioned framework packages)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regulatory_framework (
  framework_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  jurisdiction        TEXT NOT NULL DEFAULT 'NO',
  industry            TEXT NOT NULL,
  version             TEXT NOT NULL DEFAULT '1.0.0',
  parent_framework_id UUID REFERENCES regulatory_framework(framework_id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform-managed, no workspace_id. Service role for writes, authenticated for reads.
ALTER TABLE regulatory_framework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework" ON regulatory_framework;
CREATE POLICY "authenticated_select_framework" ON regulatory_framework
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework" ON regulatory_framework;
CREATE POLICY "service_role_framework" ON regulatory_framework
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_updated_at
  BEFORE UPDATE ON public.regulatory_framework
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE regulatory_framework IS 'Cascade K1a: Versioned framework packages. E.g. hospitality.no.default.v1. Platform-managed.';

-- --------------------------------------------------------
-- 2. framework_rule (Individual evaluable rules)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_rule (
  rule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  rule_type           framework_rule_type NOT NULL,
  category            TEXT NOT NULL,
  description         TEXT NOT NULL,
  description_no      TEXT,
  default_outcome     evaluation_outcome NOT NULL DEFAULT 'blocked',
  severity            TEXT NOT NULL DEFAULT 'hard_block',
  outcome_overridable BOOLEAN NOT NULL DEFAULT false,
  config_tighten_allowed BOOLEAN NOT NULL DEFAULT true,
  config_loosen_allowed BOOLEAN NOT NULL DEFAULT false,
  override_min_level  TEXT,
  evaluation_config   JSONB NOT NULL DEFAULT '{}',
  source_reference    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_rule UNIQUE (framework_id, code)
);

ALTER TABLE framework_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework_rule" ON framework_rule;
CREATE POLICY "authenticated_select_framework_rule" ON framework_rule
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework_rule" ON framework_rule;
CREATE POLICY "service_role_framework_rule" ON framework_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_rule_updated_at
  BEFORE UPDATE ON public.framework_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_framework_rule_framework
  ON framework_rule (framework_id);

COMMENT ON TABLE framework_rule IS 'Cascade K1a: Individual evaluable rules within a framework. Override capability grammar is a foundation invariant.';

-- --------------------------------------------------------
-- 3. framework_trigger (Conditions that initiate evaluation)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_trigger (
  trigger_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  description         TEXT NOT NULL,
  description_no      TEXT,
  trigger_mode        framework_trigger_mode NOT NULL,
  source_entity_type  TEXT,
  evaluation_config   JSONB NOT NULL DEFAULT '{}',
  linked_rule_ids     UUID[] DEFAULT '{}',
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  is_disableable      BOOLEAN NOT NULL DEFAULT false,
  threshold_tune_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_trigger UNIQUE (framework_id, code)
);

ALTER TABLE framework_trigger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework_trigger" ON framework_trigger;
CREATE POLICY "authenticated_select_framework_trigger" ON framework_trigger
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework_trigger" ON framework_trigger;
CREATE POLICY "service_role_framework_trigger" ON framework_trigger
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_trigger_updated_at
  BEFORE UPDATE ON public.framework_trigger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_framework_trigger_framework
  ON framework_trigger (framework_id);

COMMENT ON TABLE framework_trigger IS 'Cascade K1a: Conditions that initiate framework evaluation. Override capability grammar for disabling/tuning.';

-- --------------------------------------------------------
-- 4. workspace_framework_binding (Links workspace to framework)
-- Owner: Runtime
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_framework_binding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id),
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ,
  activated_by        UUID REFERENCES profile(profile_id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_workspace_active_framework
  ON workspace_framework_binding (workspace_id)
  WHERE is_active = true;

ALTER TABLE workspace_framework_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_select_framework_binding" ON workspace_framework_binding
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_insert_framework_binding" ON workspace_framework_binding
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_update_framework_binding" ON workspace_framework_binding
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_framework_binding" ON workspace_framework_binding;
CREATE POLICY "api_key_read_framework_binding" ON workspace_framework_binding
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_framework_binding" ON workspace_framework_binding;
CREATE POLICY "service_role_framework_binding" ON workspace_framework_binding
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_binding_updated_at
  BEFORE UPDATE ON public.workspace_framework_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE workspace_framework_binding IS 'Cascade: Links workspace to active framework version. One active binding per workspace (partial unique index).';

-- --------------------------------------------------------
-- 5. workspace_rule_override (Workspace-level rule customization)
-- Owner: Runtime (K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_rule_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  rule_id             UUID NOT NULL REFERENCES framework_rule(rule_id) ON DELETE CASCADE,
  override_outcome    evaluation_outcome,
  override_config     JSONB DEFAULT '{}',
  reason              TEXT NOT NULL,
  approved_by         UUID REFERENCES profile(profile_id),
  valid_from          DATE,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_rule_override UNIQUE (workspace_id, rule_id)
);

ALTER TABLE workspace_rule_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_select_rule_override" ON workspace_rule_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_insert_rule_override" ON workspace_rule_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_update_rule_override" ON workspace_rule_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_delete_rule_override" ON workspace_rule_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_rule_override" ON workspace_rule_override;
CREATE POLICY "service_role_rule_override" ON workspace_rule_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_rule_override_updated_at
  BEFORE UPDATE ON public.workspace_rule_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rule_override_workspace
  ON workspace_rule_override (workspace_id);

COMMENT ON TABLE workspace_rule_override IS 'Cascade K1b: Workspace-level rule customization. Must respect framework_rule override capability grammar.';

-- --------------------------------------------------------
-- 6. workspace_trigger_override (Workspace-level trigger customization)
-- Owner: Runtime (K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_trigger_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  trigger_id          UUID NOT NULL REFERENCES framework_trigger(trigger_id) ON DELETE CASCADE,
  override_config     JSONB DEFAULT '{}',
  is_disabled         BOOLEAN NOT NULL DEFAULT false,
  reason              TEXT NOT NULL,
  approved_by         UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_trigger_override UNIQUE (workspace_id, trigger_id)
);

ALTER TABLE workspace_trigger_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_select_trigger_override" ON workspace_trigger_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_insert_trigger_override" ON workspace_trigger_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_update_trigger_override" ON workspace_trigger_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_delete_trigger_override" ON workspace_trigger_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_trigger_override" ON workspace_trigger_override;
CREATE POLICY "service_role_trigger_override" ON workspace_trigger_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_trigger_override_updated_at
  BEFORE UPDATE ON public.workspace_trigger_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_trigger_override_workspace
  ON workspace_trigger_override (workspace_id);

COMMENT ON TABLE workspace_trigger_override IS 'Cascade K1b: Workspace-level trigger customization. Must respect framework_trigger override capability grammar.';

-- --------------------------------------------------------
-- Add framework_trigger_id FK to change_proposal (deferred from A1)
-- --------------------------------------------------------
ALTER TABLE change_proposal
  ADD COLUMN IF NOT EXISTS framework_trigger_id UUID REFERENCES framework_trigger(trigger_id);

COMMENT ON COLUMN change_proposal.framework_trigger_id IS 'Cascade: Exact trigger definition that fired. Added in A2 after framework_trigger table exists.';

-- Upgrade trigger_type from TEXT to framework_trigger_type enum (deferred from A1)
ALTER TABLE change_proposal
  ALTER COLUMN trigger_type TYPE framework_trigger_type
  USING trigger_type::framework_trigger_type;
