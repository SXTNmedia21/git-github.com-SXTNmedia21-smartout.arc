-- 20260623101500_routine_create_from_image_authority.sql
-- Authority seed for routine.create_from_image (Procedure Engine 2B, Task 9).
--
-- PURPOSE
-- -------
-- Seeds engine_authority_config rows for:
--   routine.create_from_image — called by BFF POST /api/mobile/routine/commit.
--     min_role='admin', level='confirm'
--
-- Mirror of routine.create authority shape (admin+, confirm):
--   - routine capability tools.ts (Task 3) gates routine.create as admin+, confirm.
--   - routine.create_from_image is the image-sourced counterpart: same role floor
--     (admin authors routine templates), same level (single-step dialog/mobile flow).
--   - Channel: route uses p_channel='system' (BFF server-side); gate_action checks
--     channel_allowed. 'system' is the BFF/server channel per ADR-0078 convention.
--
-- WITHOUT this seed, gate_action() hits the default-allow path (L-0066 / L-0066
-- documented behavior: no engine_authority_config row → allow=true regardless of
-- caller role) — silently authorising ANY caller including employees.
--
-- WITH this seed, the gate enforces min_role=admin for commit operations.
--
-- WHY CONFIRM LEVEL
-- -----------------
-- Mobile commit is a single-tap action after reviewing the AI-extracted draft.
-- level='confirm' (not 'autonomous'): user explicitly reviews and taps Commit.
-- 'autonomous' is reserved for background/automated actions (cron, engine-dispatch).
--
-- AUTHORITY POLICY
-- ----------------
--   capability               = 'routine.create_from_image'
--   level                    = 'confirm'  — mobile tap after review
--   min_role                 = 'admin'    — matches routine.create (admin-authored governance)
--   requires_four_eyes       = false      — single-admin authoring act
--   observer_escalation_hours = 24        — standard for governance writes
--
-- TWO-PART SEED PATTERN (ADR-0192)
-- ----------------------------------
-- Part A: INSERT into capability_default_registry (platform-wide default).
--         Consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT. Future workspaces automatically inherit this row.
--
-- Part B: Backfill INSERT into engine_authority_config for all EXISTING
--         workspaces. The trigger only fires on new workspace INSERT —
--         existing workspaces need an explicit backfill.
--         COALESCE chain: owner/admin → any company member → any user_identity.
--
-- IDEMPOTENCY
-- -----------
-- Part A: ON CONFLICT (capability) DO NOTHING
-- Part B: ON CONFLICT (workspace_id, capability) DO NOTHING
-- Safe under `npx supabase db reset` + replay and repeated migration runs.
--
-- REFERENCES
-- ----------
-- ADR-0099: unified authority gate (gate_action RPC)
-- ADR-0192: capability_default_registry + bootstrap trigger pattern
-- ADR-0189: authority-seed-parity CI gate
-- L-0066:   default-allow CVE class (missing seed = silent authority escape)
-- L-0129:   capability literals in VALUES tuples for parity scanner
-- Sortie:   feat/procedure-engine-2b (Task 9, 2026-06-23)
-- ============================================================

SET search_path TO public, extensions;

-- ─── Part A — capability_default_registry: platform-wide defaults ────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every new
-- workspace INSERT. Adding this row is sufficient for all future workspaces.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'routine.create_from_image',
    'confirm',
    'admin',
    false,
    24,
    'Procedure Engine 2B Task 9. BFF POST /api/mobile/routine/commit. '
    'routine.create_from_image (admin+, confirm): admin commits an AI-extracted routine draft '
    'after image analysis on mobile. Mirrors routine.create authority shape (admin+, confirm). '
    'min_role=admin — only workspace admins and owners may author routine templates from images. '
    'level=confirm — mobile single-tap commit after reviewing AI draft. '
    'requires_four_eyes=false — single-admin governance write. '
    '24h observer_escalation: governance writes warrant visibility. '
    'Channel: BFF server-side uses p_channel=system (ADR-0078). '
    'Absent this row gate_action default-allows (L-0066 CVE class). 2026-06-23.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─── Part B — engine_authority_config: backfill for all existing workspaces ───
-- The trigger (Part A) covers only FUTURE workspace INSERTs. This CROSS JOIN
-- fills the gap for all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260620110400_policy_create_manual_capability_seed.sql.
-- Per L-0129: capability literal must appear explicitly in VALUES tuple for the
-- parity scanner (scripts/authority-seed-parity.ts) to detect this seed.

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  caps.capability,
  caps.level,
  caps.min_role,
  caps.requires_four_eyes,
  caps.observer_escalation_hours,
  COALESCE(
    (
      -- Prefer workspace owner/admin via company_member (ADR-0099 audit trail).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Fallback to any member of the company.
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (Supabase local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  ) AS updated_by
FROM public.workspace w
-- L-0129: capability literals in VALUES tuples for parity scanner detection.
CROSS JOIN (VALUES
  ('routine.create_from_image', 'confirm', 'admin', false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;
