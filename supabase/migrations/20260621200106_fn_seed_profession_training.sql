-- ============================================================
-- fn_seed_profession_training
-- Seeds profession + profession_training rows from industry
-- roleCapabilityProfiles at workspace bootstrap.
--
-- Design: SECURITY DEFINER, idempotent, best-effort.
-- Called by bootstrap-cascade Step 11 (hospitality only).
-- Caller: bootstrap-cascade EF (service_role bearer).
--
-- Idempotency:
--   - profession: ON CONFLICT (workspace_id, slug) DO NOTHING
--   - profession_training: ON CONFLICT DO NOTHING
--   - Protocol lookup: silently skipped when name not found
--     (correct — governance protocols 0379b seeds those later)
--
-- Contract (A5 reader): profession.slug == roleCapabilityProfile.roleSlug
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_seed_profession_training(
  p_workspace_id UUID,
  p_profiles     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile          JSONB;
  v_protocol_slug    TEXT;
  v_profession_id    UUID;
  v_protocol_id      UUID;
  v_role_slug        TEXT;
  v_name             TEXT;
  v_professions_seeded   INT := 0;
  v_trainings_seeded     INT := 0;
  v_trainings_skipped    INT := 0;
BEGIN
  -- Validate input
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id must not be NULL';
  END IF;
  IF p_profiles IS NULL OR jsonb_typeof(p_profiles) != 'array' THEN
    RAISE EXCEPTION 'p_profiles must be a non-null JSON array';
  END IF;

  FOR v_profile IN SELECT jsonb_array_elements(p_profiles) LOOP
    v_role_slug := v_profile->>'roleSlug';
    -- Use roleSlug as human name with capital first letter, fallback to slug itself
    v_name      := initcap(replace(v_role_slug, '-', ' '));

    -- ── 1. Upsert profession ──────────────────────────────────
    INSERT INTO public.profession (workspace_id, slug, name)
    VALUES (p_workspace_id, v_role_slug, v_name)
    ON CONFLICT (workspace_id, slug) DO NOTHING;

    -- Resolve the profession_id we just upserted (or already existed)
    SELECT profession_id INTO v_profession_id
    FROM public.profession
    WHERE workspace_id = p_workspace_id
      AND slug         = v_role_slug;

    IF v_profession_id IS NULL THEN
      -- Should never happen: row either inserted or already existed
      CONTINUE;
    END IF;

    v_professions_seeded := v_professions_seeded + 1;

    -- ── 2. Training mappings ──────────────────────────────────
    IF v_profile->'mandatoryProtocolSlugs' IS NOT NULL
       AND jsonb_typeof(v_profile->'mandatoryProtocolSlugs') = 'array' THEN

      FOR v_protocol_slug IN
        SELECT jsonb_array_elements_text(v_profile->'mandatoryProtocolSlugs')
      LOOP
        -- Look up protocol by exact name, scoped to this workspace
        SELECT protocol_id INTO v_protocol_id
        FROM public.protocol
        WHERE workspace_id = p_workspace_id
          AND name         = v_protocol_slug
        LIMIT 1;

        IF v_protocol_id IS NULL THEN
          -- Protocol not seeded yet — skip silently (best-effort, ADR-0379a RA2c)
          v_trainings_skipped := v_trainings_skipped + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.profession_training (
          profession_id,
          protocol_id,
          workspace_id,
          is_required,
          weight
        ) VALUES (
          v_profession_id,
          v_protocol_id,
          p_workspace_id,
          true,
          1.0
        )
        ON CONFLICT (profession_id, protocol_id, workspace_id) DO NOTHING;

        v_trainings_seeded := v_trainings_seeded + 1;
      END LOOP;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'professions_seeded',  v_professions_seeded,
    'trainings_seeded',    v_trainings_seeded,
    'trainings_skipped',   v_trainings_skipped
  );
END;
$$;

-- Grant EXECUTE to service_role only (called exclusively from bootstrap-cascade EF)
REVOKE ALL ON FUNCTION public.fn_seed_profession_training(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_seed_profession_training(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.fn_seed_profession_training IS
  'Idempotent best-effort seed of profession + profession_training rows from hospitality roleCapabilityProfiles. '
  'Called by bootstrap-cascade Step 11. Skips protocol slugs that have no matching protocol row (correct — '
  'governance seed 0379b adds those later). Contract: profession.slug == roleCapabilityProfile.roleSlug. '
  'ADR-0379a RA2c.';
