-- ============================================================
-- Profession System: Fag, Legal Functions, Authority, Access
-- ============================================================

-- 1. Profession (Fag) — K1a platform + workspace override
CREATE TABLE public.profession (
  profession_id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID REFERENCES public.workspace(workspace_id),
  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  is_universal     BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE NULLS NOT DISTINCT (workspace_id, slug)
);
CREATE TRIGGER set_profession_updated_at
  BEFORE UPDATE ON public.profession
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. NACE code mapping
CREATE TABLE public.profession_industry (
  profession_id  UUID NOT NULL REFERENCES public.profession(profession_id),
  nace_code      TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profession_id, nace_code)
);
CREATE TRIGGER set_profession_industry_updated_at
  BEFORE UPDATE ON public.profession_industry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Authority level enum
CREATE TYPE authority_level AS ENUM ('duty', 'deputy', 'leader');

-- 4. Legal functions (K1a — static, law-defined)
CREATE TABLE public.legal_function (
  legal_function_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  legal_basis        TEXT,
  training_hours     INTEGER,
  profession_id      UUID REFERENCES public.profession(profession_id),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_legal_function_updated_at
  BEFORE UPDATE ON public.legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Profile <-> Legal function (m2m)
CREATE TABLE public.profile_legal_function (
  profile_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  legal_function_id  UUID NOT NULL REFERENCES public.legal_function(legal_function_id) ON DELETE CASCADE,
  assigned_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  assigned_by        UUID REFERENCES public.profile(profile_id),
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, legal_function_id)
);
CREATE TRIGGER set_profile_legal_function_updated_at
  BEFORE UPDATE ON public.profile_legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Profession training (weighted m2m)
CREATE TABLE public.profession_training (
  profession_training_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profession_id           UUID NOT NULL REFERENCES public.profession(profession_id),
  protocol_id             UUID NOT NULL REFERENCES public.protocol(protocol_id),
  weight                  DECIMAL(3,2) NOT NULL DEFAULT 1.0
                            CHECK (weight >= 0 AND weight <= 1),
  is_required             BOOLEAN NOT NULL DEFAULT false,
  workspace_id            UUID REFERENCES public.workspace(workspace_id),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE NULLS NOT DISTINCT (profession_id, protocol_id, workspace_id)
);
CREATE TRIGGER set_profession_training_updated_at
  BEFORE UPDATE ON public.profession_training
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Profile access (fine-grained scopes)
CREATE TABLE public.profile_access (
  profile_id   UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  scope        TEXT NOT NULL
                 CHECK (scope ~ '^[a-z_]+\.[a-z_*]+$'),
  granted_by   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (granted_by IN ('authority', 'legal_function', 'manual')),
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, scope)
);
CREATE TRIGGER set_profile_access_updated_at
  BEFORE UPDATE ON public.profile_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Profile <-> Position (m2m — en person kan ha flere posisjoner)
CREATE TABLE public.profile_position (
  profile_id    UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES public.position(position_id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, position_id)
);
CREATE TRIGGER set_profile_position_updated_at
  BEFORE UPDATE ON public.profile_position
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Extend position table (fag-kobling only, authority lives on profile)
ALTER TABLE public.position
  ADD COLUMN profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;

-- 10. Extend profile (authority level — one per person, stable)
ALTER TABLE public.profile
  ADD COLUMN authority_level authority_level;

-- 11. Extend tariff_rate_table
-- MOVED to 20260422400350_profession_tariff_link.sql — tariff_rate_table doesn't exist
-- at this migration timestamp. The column is added after cascade schema creates the table.

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.profession ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_professions" ON public.profession
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_professions" ON public.profession
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_professions" ON public.profession
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

ALTER TABLE public.profession_industry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profession_industry" ON public.profession_industry
  FOR SELECT USING (true);

ALTER TABLE public.legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_legal_functions" ON public.legal_function
  FOR SELECT USING (true);

ALTER TABLE public.profile_legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_legal_functions" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_legal_functions" ON public.profile_legal_function
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

ALTER TABLE public.profession_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_training" ON public.profession_training
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_training" ON public.profession_training
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_training" ON public.profession_training
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

ALTER TABLE public.profile_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_access" ON public.profile_access
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

ALTER TABLE public.profile_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_positions" ON public.profile_position
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_positions" ON public.profile_position
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

-- API key policies
CREATE POLICY "api_key_read_profile_legal_function" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_read_profile_position" ON public.profile_position
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_read_profession" ON public.profession
  FOR SELECT USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_read_profession_training" ON public.profession_training
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO public.profession (slug, name, description, is_universal, sort_order) VALUES
  ('kjokken',    'Kjøkken',    'Matlaging, mise en place, hygiene',        false, 1),
  ('servering',  'Servering',  'Gjesteservice, bordservering, vin',        false, 2),
  ('bartending', 'Bartending', 'Drinkblanding, barservice, skjenking',     false, 3),
  ('ledelse',    'Ledelse',    'Drift, personal, økonomi',                 true,  4),
  ('renhold',    'Renhold',    'Rengjøring, hygienekontroll',              false, 5),
  ('resepsjon',  'Resepsjon',  'Innsjekk, gjestekontakt, booking',        false, 6);

INSERT INTO public.profession_industry (profession_id, nace_code) VALUES
  ((SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL),    '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='servering' AND workspace_id IS NULL),  '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='bartending' AND workspace_id IS NULL), '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='resepsjon' AND workspace_id IS NULL),  '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='renhold' AND workspace_id IS NULL),    '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='servering' AND workspace_id IS NULL),  '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL),    '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='bartending' AND workspace_id IS NULL), '56.301'),
  ((SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL),    '56.301');

INSERT INTO public.legal_function (slug, name, legal_basis, training_hours, profession_id, sort_order) VALUES
  ('verneombud',            'Verneombud',            'Arbeidsmiljøloven §6-1',  40,   NULL, 1),
  ('brannvernleder',        'Brannvernleder',        'Brannvernforskriften §4', NULL, NULL, 2),
  ('mattrygghetsansvarlig', 'Mattrygghetsansvarlig', 'Matloven §4',            NULL,
    (SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL), 3),
  ('skjenkeansvarlig',      'Skjenkeansvarlig',      'Alkoholloven §1-7c',      NULL, NULL, 4);
