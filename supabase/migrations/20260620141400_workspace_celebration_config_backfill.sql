-- 20260620141400_workspace_celebration_config_backfill.sql
--
-- WHY: Backfill workspace_celebration_config rows for all existing workspaces.
--   The AFTER INSERT trigger on workspace (20260620141100) only fires for new workspaces.
--   Existing workspaces at migration time need a row seeded here.
--
-- Strategy: INSERT ... SELECT with ON CONFLICT DO NOTHING (idempotent re-runs).
-- target_channel_id: LATERAL subquery finds first news channel per workspace,
--   ordered by created_at. NULL if no news channel exists — admin must configure.
--
-- ADR-0372 Q6, ADR-0372 §Migration plan #8.

INSERT INTO public.workspace_celebration_config (workspace_id, target_channel_id)
SELECT
  w.workspace_id,
  c.id AS target_channel_id
FROM public.workspace w
LEFT JOIN LATERAL (
  SELECT id
  FROM public.channel ch
  WHERE ch.workspace_id = w.workspace_id
    AND ch.channel_type = 'news'
  ORDER BY ch.created_at
  LIMIT 1
) c ON true
ON CONFLICT (workspace_id) DO NOTHING;

-- Self-test: verify at least one row exists (requires at least 1 workspace in DB).
-- In local dev with no workspaces this is a no-op assertion.
DO $$
DECLARE
  v_total_workspaces    int;
  v_seeded_configs      int;
BEGIN
  SELECT COUNT(*) INTO v_total_workspaces FROM public.workspace;
  SELECT COUNT(*) INTO v_seeded_configs FROM public.workspace_celebration_config;

  IF v_total_workspaces > 0 AND v_seeded_configs = 0 THEN
    RAISE EXCEPTION 'Backfill FAIL: % workspace(s) exist but 0 workspace_celebration_config rows seeded.',
      v_total_workspaces;
  END IF;

  RAISE NOTICE 'Backfill OK: % workspace(s), % config row(s) seeded.',
    v_total_workspaces, v_seeded_configs;
END $$;
