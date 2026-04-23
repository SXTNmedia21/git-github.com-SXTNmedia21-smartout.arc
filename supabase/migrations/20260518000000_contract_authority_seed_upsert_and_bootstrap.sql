-- ============================================
-- 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql
-- Fix #1 of contract-hub-fix-forward sortie · ADR-0192
--
-- Closes the AUTHORITY SEED CVE surfaced by Council Gate 4 R2:
--   supabase/migrations/20260515170500_contract_capability_authority_seed.sql
--   silently no-ops on fresh DBs because it requires a pre-existing godmode
--   user (RAISE NOTICE + RETURN early). Combined with gate_action's
--   default-allow when engine_authority_config.level IS NULL
--   (20260506120000_gate_action_accept_entity_id.sql:107-109), this means
--   a freshly seeded workspace silently authorizes the contract capability
--   for everyone — CVE-class (L-0066, L-0097).
--
-- TWO-PART FIX
-- ============
-- Part A: UPSERT seed for contract — mirrors the helpdesk_query pattern
--         (20260515130300:43-66). Uses a COALESCE chain that NEVER returns
--         NULL: workspace owner via company_member → any company member →
--         any user_identity row. Backfills any unseeded workspace.
--
-- Part B: Bootstrap trigger on workspace AFTER INSERT. Creates a
--         capability_default_registry reference table listing every known
--         capability + default level + default min_role; an AFTER INSERT
--         trigger on workspace inserts authority rows for ALL registered
--         capabilities for the new workspace. Future capabilities only need
--         to be added to capability_default_registry (one INSERT) to be
--         auto-seeded on every new workspace.
--
-- Part C: pgTAP test at supabase/tests/pgtap/contract_authority_seed_parity.sql
--         locks in the invariants.
--
-- WHY AFTER INSERT, NOT BEFORE INSERT (deviation from build brief)
-- ----------------------------------------------------------------
-- The brief said "BEFORE INSERT ON workspace". BEFORE INSERT is hostile
-- here: NEW.workspace_id is populated only because workspace_id has a
-- DEFAULT gen_random_uuid() — but a manually-supplied UUID would not be
-- guaranteed yet, and inserting child rows referencing a PK that the
-- parent row hasn't materialized yet would race with FK constraints
-- (engine_authority_config.workspace_id REFERENCES workspace(workspace_id)).
-- AFTER INSERT executes after the parent row is committed to the page,
-- so the FK is satisfied without needing DEFERRABLE. Same observable
-- behavior, materially safer.
--
-- WHY A REGISTRY TABLE, NOT A STATIC ARRAY
-- ----------------------------------------
-- A registry table makes the canonical list addressable from SQL: pgTAP
-- can assert it exists, future migrations can add rows in a single
-- statement (no DDL, no PL/pgSQL function rewrite), and admins can read
-- it via standard tooling. The trigger function reads from this table
-- on every INSERT — adding a capability requires one INSERT into
-- capability_default_registry, not a function rewrite.
--
-- DUPLICATION AVOIDANCE
-- ---------------------
-- Existing capability seed migrations (helpdesk_query, billing_query,
-- session.*, day_control, journey.*, recorder.*, guardian, etc.) ALREADY
-- backfill existing workspaces. This migration's bootstrap trigger covers
-- only NEW workspaces created after it lands. ON CONFLICT
-- (workspace_id, capability) DO NOTHING in the trigger means the trigger
-- harmlessly no-ops if a future seed migration also tries to seed the
-- same (workspace, capability) row — no duplicate-key error.
--
-- Refs:
--   ADR-0192 (this fix), ADR-0162 (default-allow trap), ADR-0173 (journey),
--   L-0066 / L-0097 (CVE class authority seed). Council 2026-04-22 Gate 4.
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — UPSERT seed for contract capability (replaces broken seed)
-- ─────────────────────────────────────────────────────────────────────
-- Mirrors the COALESCE chain from helpdesk_query
-- (20260515130300_helpdesk_query_authority_seed.sql:43-66). Three
-- fallbacks: workspace owner via company_member → any company_member →
-- any user_identity. updated_by is also nullable on
-- engine_authority_config (20260414225000) so the COALESCE never blocks
-- the INSERT, but we keep the chain for audit-trail fidelity.

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
  'contract',
  'confirm',
  'admin',
  false,
  72,
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
      -- Fallback to any member of the company (seed-time data may not
      -- have owner/admin distinction).
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
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B.1 — capability_default_registry (reference table)
-- ─────────────────────────────────────────────────────────────────────
-- One row per capability that should be auto-seeded on every new
-- workspace. NOT keyed on workspace_id — this is platform-wide config.
-- Adding a capability later is a single INSERT statement, no function
-- rewrite. Removing a capability auto-cancels its bootstrap on next
-- workspace creation.

CREATE TABLE IF NOT EXISTS public.capability_default_registry (
  capability                  TEXT PRIMARY KEY,
  level                       TEXT NOT NULL
                                CHECK (level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')),
  min_role                    TEXT NOT NULL DEFAULT 'employee'
                                CHECK (min_role IN ('employee', 'manager', 'admin', 'owner')),
  requires_four_eyes          BOOLEAN NOT NULL DEFAULT false,
  observer_escalation_hours   INTEGER NOT NULL DEFAULT 72,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.capability_default_registry IS
  'Canonical list of capabilities that auto-seed engine_authority_config rows '
  'when a new workspace is created. See trigger workspace_seed_authority_defaults. '
  'Adding a capability here is sufficient — no function rewrite needed. '
  'Existing-workspace backfill is the responsibility of each capability''s own '
  'seed migration (e.g. 20260417170000_billing_query_authority_seed.sql).';

-- RLS: read-only for everyone (service-role manages writes via migrations).
ALTER TABLE public.capability_default_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all_read_capability_registry" ON public.capability_default_registry;
CREATE POLICY "all_read_capability_registry" ON public.capability_default_registry
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_manage_capability_registry" ON public.capability_default_registry;
CREATE POLICY "service_manage_capability_registry" ON public.capability_default_registry
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- Part B.2 — Seed the registry with the canonical capability list
-- ─────────────────────────────────────────────────────────────────────
-- Cross-checked against:
--   - packages/ai/src/capabilities/types.ts (CapabilityName union)
--   - All existing seed migrations (helpdesk_query, billing_query, etc.)
--
-- Capabilities seeded with their authoritative defaults (matching the
-- existing seed migrations exactly so behavior on existing workspaces
-- is identical to behavior on new workspaces):

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  -- Contract — this PR's domain (Part A). confirm/admin per Council Gate G4.
  ('contract',                     'confirm',    'admin',    false, 72,
    'Chat-only authoring capability. Council 2026-04-22 Gate G4. ADR-0192.'),

  -- Helpdesk — ADR-0162 / L-0066. Matches 20260515130300.
  ('helpdesk_query',               'confirm',    'manager',  false, 72,
    'Helpdesk ticket lifecycle. ADR-0162.'),

  -- Billing — ADR-0118. Matches 20260417170000 (read_only/admin/24h).
  ('billing_query',                'read_only',  'admin',    false, 24,
    'Read-only billing surface, chat-only. ADR-0118.'),

  -- Day Control — matches 20260515110000.
  ('session.signoff',              'confirm',    'manager',  false, 24,
    'WebDayControl: leder sends day to pending_signoff. ADR-0156.'),
  ('session.close',                'confirm',    'admin',    false, 24,
    'WebDayControl: admin approves and closes the day. ADR-0156.'),
  ('broadcast.send',               'confirm',    'manager',  false, 24,
    'WebDayControl: leder posts to komm news channel. ADR-0156.'),

  -- Session lifecycle — matches 20260515130500.
  ('session.open',                 'confirm',    'manager',  false, 24,
    'Manual session creation (openSessionAction).'),
  ('session.transition',           'confirm',    'manager',  false, 24,
    'Non-closure lifecycle hops (transitionSessionAction).'),
  ('shift.manual_time_entry',      'confirm',    'admin',    false, 24,
    'Retroactive clock-in/out (manualTimeEntryAction).'),

  -- Journey — matches 20260516000400.
  ('journey.run_dev',              'suggest',    'admin',    false, 72,
    'Journey dev runner. ADR-0173.'),
  ('journey.publish_mission',      'suggest',    'admin',    false, 72,
    'Publish mission. ADR-0173.'),
  ('journey.publish_guide',        'suggest',    'admin',    false, 72,
    'Publish guide. ADR-0173.'),
  ('journey.run_guided',           'autonomous', 'employee', false, 72,
    'Run guided journey at runtime. ADR-0173.'),

  -- Recorder — matches 20260515120400 (ADR-0185).
  ('recorder.flag',                'suggest',    'admin',    false, 72,
    'Admins can flag recorder turns. ADR-0185.'),
  ('recorder.whisper',             'confirm',    'admin',    false, 72,
    'Workspace admin requires confirmation. ADR-0185.'),
  ('recorder.force_stop',          'confirm',    'admin',    false, 72,
    'Workspace admin requires confirmation. ADR-0185.'),
  ('recorder.pii_reveal',          'disabled',   'admin',    false, 72,
    'Platform-admin unlocks case-by-case via godmode. ADR-0185.'),
  ('recorder.break_glass_enable',  'disabled',   'admin',    false, 72,
    'Platform-admin toggles explicitly. ADR-0185.'),

  -- Operations Intelligence — matches 20260414230000 (ADR-0088).
  ('operations_intelligence',      'suggest',    'manager',  false, 72,
    'AI Operations Intelligence. ADR-0088.'),

  -- Guardian — matches 20260314000000 (default min_role 'employee').
  ('guardian',                     'suggest',    'employee', false, 72,
    'Guardian workspace health monitoring.')
ON CONFLICT (capability) DO NOTHING;

-- NOTE: capabilities in CapabilityName union NOT seeded here:
--   knowledge, schedule, training, operations, profile, communication,
--   memory, payroll, ui, contract_intake, shift_swap, shift_lifecycle,
--   governance.
-- These have never had explicit authority seeds in any migration. Adding
-- them here would change runtime behavior on existing workspaces (they
-- currently default-allow). This fix is scoped to the CVE: it does not
-- expand authority enforcement to capabilities that have never had it.
-- Future ADRs should land their authority defaults via a single INSERT
-- into capability_default_registry plus a backfill seed for existing
-- workspaces.

-- ─────────────────────────────────────────────────────────────────────
-- Part B.3 — Trigger function that bootstraps authority rows
-- ─────────────────────────────────────────────────────────────────────
-- Runs AFTER INSERT on workspace (deviation from brief: see header).
-- updated_by uses the same COALESCE chain as Part A so the audit trail
-- is consistent between backfill and bootstrap paths.

CREATE OR REPLACE FUNCTION public.workspace_seed_authority_defaults()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated_by UUID;
BEGIN
  -- Resolve the audit-trail user via COALESCE chain. Mirrors Part A and
  -- helpdesk_query 20260515130300:43-66.
  SELECT COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = NEW.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = NEW.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  ) INTO v_updated_by;

  -- updated_by is nullable on engine_authority_config since 20260414225000,
  -- so v_updated_by IS NULL is acceptable (platform-seed semantics).

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
    NEW.workspace_id,
    r.capability,
    r.level,
    r.min_role,
    r.requires_four_eyes,
    r.observer_escalation_hours,
    v_updated_by
  FROM public.capability_default_registry r
  ON CONFLICT (workspace_id, capability) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.workspace_seed_authority_defaults IS
  'AFTER INSERT trigger on workspace. Auto-seeds engine_authority_config '
  'rows for every capability in capability_default_registry. Closes the '
  'authority-seed CVE (ADR-0192, L-0066, L-0097).';

-- Drop and recreate to make this migration idempotent under replay.
DROP TRIGGER IF EXISTS workspace_seed_authority_defaults_trg ON public.workspace;

CREATE TRIGGER workspace_seed_authority_defaults_trg
  AFTER INSERT ON public.workspace
  FOR EACH ROW
  EXECUTE FUNCTION public.workspace_seed_authority_defaults();

COMMENT ON TRIGGER workspace_seed_authority_defaults_trg ON public.workspace IS
  'Bootstrap authority defaults for every new workspace (ADR-0192). '
  'Reads capability_default_registry; inserts one engine_authority_config '
  'row per registered capability. Idempotent via ON CONFLICT.';

-- ─────────────────────────────────────────────────────────────────────
-- Part B.4 — Backfill the trigger logic for existing workspaces
-- ─────────────────────────────────────────────────────────────────────
-- The trigger only covers NEW workspaces. Existing seed migrations
-- already cover the capabilities they introduced, but this migration
-- guarantees parity by running the same INSERT for every workspace ×
-- registered capability with ON CONFLICT DO NOTHING. Idempotent.

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
  r.capability,
  r.level,
  r.min_role,
  r.requires_four_eyes,
  r.observer_escalation_hours,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
CROSS JOIN public.capability_default_registry r
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Authority defaults sourced from public.capability_default_registry; '
  'auto-seeded on workspace INSERT via workspace_seed_authority_defaults_trg. '
  'ADR-0192 (Fix #1, contract-hub-fix-forward, 2026-04-22).';
