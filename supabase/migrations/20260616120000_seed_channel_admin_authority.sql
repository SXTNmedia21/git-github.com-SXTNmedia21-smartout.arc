-- ============================================
-- 20260616120000_seed_channel_admin_authority.sql
-- Seed engine_authority_config rows for 6 channel_admin tools.
-- CROSS JOIN VALUES form required by scripts/authority-seed-parity.ts.
--
-- Sortie: channel-admin-capability-registration (T2)
-- ADR refs: ADR-0336 (capability split + authority matrix),
--           ADR-0287 (dotted-tool keys in engine_authority_config),
--           ADR-0189 (capability seed pattern),
--           ADR-0176 (authority seed / default-allow CVE class)
--
-- COLUMN SCHEMA (per 20260302000100 base + ALTERs):
--   workspace_id              uuid    NOT NULL
--   capability                text    NOT NULL  (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   level                     text    NOT NULL
--   min_role                  text    NOT NULL  (DEFAULT 'employee')
--   requires_four_eyes        boolean NOT NULL  (DEFAULT false)
--   observer_escalation_hours integer NOT NULL  (DEFAULT 72)
--   updated_by                uuid    NULL      (platform seed rows = NULL per 20260414225000)
--
-- ROLLBACK (manual):
--   DELETE FROM public.engine_authority_config
--    WHERE capability LIKE 'channel_admin.%';
-- ============================================

SET search_path TO public, extensions;

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
  v.capability,
  v.level,
  v.min_role,
  v.requires_four_eyes,
  v.observer_escalation_hours,
  NULL::uuid  -- platform seed, no human actor (per 20260414225000)
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('channel_admin.mute_channel',       'autonomous', 'employee', false, 72),
    ('channel_admin.leave_channel',      'autonomous', 'employee', false, 72),
    ('channel_admin.invite_to_channel',  'confirm',    'manager',  false, 72),
    ('channel_admin.rename_channel',     'confirm',    'admin',    false, 72),
    ('channel_admin.archive_channel',    'confirm',    'admin',    false, 72),
    ('channel_admin.change_member_role', 'confirm',    'admin',    false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added channel_admin.mute_channel/leave_channel/invite_to_channel/rename_channel/'
  'archive_channel/change_member_role 2026-06-16 (channel-admin-capability-registration T2).';
