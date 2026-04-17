-- strike-mcp Tier 2 — protocol_assignment backfill for existing profiles
-- generated: 2026-04-17 (manually authored — not from extractor)
--
-- WHY THIS FILE EXISTS:
--   `auto_assign_protocols_to_new_employee` trigger
--   (supabase/migrations/20260414014856_training_schema_foundation.sql lines
--   139-193, refined in 20260428100000_auto_assign_protocols.sql) fires on
--   `profile INSERT` only — not on `protocol INSERT`. After Tier 2 protocols
--   are inserted, EXISTING profiles get NO protocol_assignment rows.
--   Newly-inserted profiles (post-Tier 2) get all assignments via trigger.
--   Without this backfill: same workspace → different employees see
--   different protocols → silent authority divergence (Trust Gate fail).
--
-- WHEN TO RUN:
--   AFTER 01-04 SQL files apply AND admin promotes Tier 2 protocols from
--   status='draft' to status='active'. Filter below honors `protocol.status =
--   'active'` to mirror the trigger's behavior — running this against draft
--   protocols inserts ZERO rows (safe no-op).
--
-- IDEMPOTENCY:
--   protocol_assignment has NO UNIQUE constraint on (protocol_id, profile_id).
--   Re-running this would create duplicate assignments. Idempotency via
--   `WHERE NOT EXISTS` clause (cheaper than ON CONFLICT for cross-joins).
--
-- AUTH:
--   service_role ONLY. governance + protocol_assignment have RLS.
--
-- SCOPE:
--   This file backfills for ONE workspace (workspace_uuid below).
--   Generalize for multi-workspace migrations by parameterizing the
--   workspace_uuid filter.

BEGIN;

-- Wrightegaarden workspace UUID (deterministic uuidv5 from Bubble _id)
-- Source: scripts/tier2_extract.ts: strikeUuid("workspace", "1683059156689x546199168715701950")
\set workspace_uuid '65532a8c-9571-5e8f-8890-f551ed242795'::uuid

INSERT INTO public.protocol_assignment (
  protocol_id,
  profile_id,
  workspace_id,
  status,
  assigned_at,
  assigned_via,
  assigned_ref_id,
  protocol_version
)
SELECT
  p.protocol_id,
  prof.profile_id,
  prof.workspace_id,
  'not_started'::protocol_assignment_status,
  now(),
  CASE pol.policy_scope
    WHEN 'workspace'  THEN 'workspace'::assignment_source
    WHEN 'department' THEN 'department'::assignment_source
    WHEN 'team'       THEN 'team'::assignment_source
    WHEN 'location'   THEN 'location'::assignment_source
  END,
  pol.scope_ref_id,
  p.version
FROM public.protocol p
JOIN public.policy pol ON p.policy_id = pol.policy_id
JOIN public.profile prof ON prof.workspace_id = p.workspace_id
WHERE p.workspace_id = :'workspace_uuid'
  AND p.status = 'active'
  AND pol.is_active = true
  AND prof.status IN ('trainee', 'active')
  AND (
    pol.policy_scope = 'workspace'
    OR (pol.policy_scope = 'department' AND pol.scope_ref_id = prof.department_id)
    OR (pol.policy_scope = 'team'       AND pol.scope_ref_id = prof.primary_team_id)
    OR (pol.policy_scope = 'location'   AND pol.scope_ref_id = prof.primary_location_id)
  )
  -- Idempotency: only insert if no existing assignment for this (protocol, profile) pair
  AND NOT EXISTS (
    SELECT 1
    FROM public.protocol_assignment existing
    WHERE existing.protocol_id = p.protocol_id
      AND existing.profile_id = prof.profile_id
  );

-- Report what was inserted
SELECT
  count(*)            AS rows_backfilled,
  count(DISTINCT pa.protocol_id) AS protocols_touched,
  count(DISTINCT pa.profile_id)  AS profiles_assigned
FROM public.protocol_assignment pa
JOIN public.protocol p ON pa.protocol_id = p.protocol_id
WHERE p.workspace_id = :'workspace_uuid'
  AND pa.assigned_via IS NOT NULL
  AND pa.assigned_at >= now() - interval '1 minute';

COMMIT;
