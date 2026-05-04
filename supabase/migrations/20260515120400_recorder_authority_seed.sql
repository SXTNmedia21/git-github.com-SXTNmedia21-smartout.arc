-- 20260515120400_recorder_authority_seed.sql
-- ADR-0185 — C4 authority defaults for recorder intervention capabilities.
--
-- L-0042 timestamp verified: tip 20260515120300, depends on:
--   - engine_authority_config (20260302000100) — workspace_id NOT NULL, level TEXT with CHECK
--   - workspace, profile (00001_identity_tables.sql)
--
-- Schema note: engine_authority_config.workspace_id is NOT NULL. Plan mentioned
-- "platform-scope (NULL workspace_id) for godmode-only" but the table rejects NULL.
-- Per-workspace seeding gives every workspace a deterministic default; godmode
-- cross-workspace reads are handled via RLS elsewhere. All 5 capabilities seeded
-- per workspace, using the workspace's first admin/owner profile as updated_by
-- (same pattern as 20260314000000_guardian_signal.sql).
--
-- Capability defaults (ADR-0185):
--   recorder.flag                 → suggest  (admins can flag turns)
--   recorder.whisper              → confirm  (workspace admin requires confirmation)
--   recorder.force_stop           → confirm  (workspace admin requires confirmation)
--   recorder.pii_reveal           → disabled (platform-admin unlocks case-by-case via godmode)
--   recorder.break_glass_enable   → disabled (platform-admin toggles explicitly)

SET search_path TO public, extensions;

INSERT INTO public.engine_authority_config (workspace_id, capability, level, updated_by)
SELECT DISTINCT ON (w.workspace_id, cap.capability)
  w.workspace_id,
  cap.capability,
  cap.level,
  p.user_id
FROM public.workspace w
JOIN public.profile p
  ON p.workspace_id = w.workspace_id
  AND p.role IN ('owner', 'admin')
  AND p.is_active = true
CROSS JOIN (VALUES
  ('recorder.flag',               'suggest'),
  ('recorder.whisper',            'confirm'),
  ('recorder.force_stop',         'confirm'),
  ('recorder.pii_reveal',         'disabled'),
  ('recorder.break_glass_enable', 'disabled')
) AS cap(capability, level)
WHERE w.is_active = true
ORDER BY w.workspace_id, cap.capability, (p.role = 'owner') DESC
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Includes recorder.* capabilities per ADR-0185 (flag, whisper, force_stop, pii_reveal, break_glass_enable)';
