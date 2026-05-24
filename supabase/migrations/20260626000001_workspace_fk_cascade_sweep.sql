-- ============================================================================
-- 20260626000001_workspace_fk_cascade_sweep.sql
--
-- BUG-8 FIX: Add ON DELETE CASCADE to all workspace_id foreign keys.
--
-- ROOT CAUSE (chair Phase 5 synthesis 2026-05-24, supervisor audit):
--   80+ workspace_id FK references across 46 migration files lack
--   ON DELETE CASCADE. This means:
--     - Workspace deletion is blocked (FK constraint violation).
--     - Test fixture recycling is impossible (can't drop + recreate workspaces).
--     - Production is a landmine: any attempt to delete a workspace or run
--       cleanup scripts will fail silently or loudly at the FK layer.
--
-- SCOPE:
--   Every table with  workspace_id REFERENCES workspace(workspace_id)
--   that does NOT already declare ON DELETE CASCADE.
--   Tables with ON DELETE RESTRICT intentionally change to CASCADE per ADR-0409
--   (workspace lifecycle supersedes record preservation for most tables;
--    exceptions are explicitly noted inline).
--
-- EXCEPTIONS (NOT touched here — deliberate RESTRICT preserved):
--   None identified. ADR-0409 mandates CASCADE for all workspace-child tables.
--   For accounting tables (shift_pay_calculation_event, billing.settlement_period,
--   supplement_rule_match) the previous RESTRICT was overly conservative;
--   workspace deletion is an operator-gated event with full audit trail.
--
-- PATTERN:
--   Each table is wrapped in its own DO block so a failure on one table
--   (e.g. constraint already renamed by a hotfix) does not abort the sweep.
--   Each block:
--     1. DROP CONSTRAINT (old, without CASCADE)
--     2. ADD CONSTRAINT (new, with ON DELETE CASCADE)
--   Constraint names follow PostgreSQL auto-generated convention where no
--   explicit CONSTRAINT name was declared in the original DDL:
--     <table>_workspace_id_fkey   (or target_workspace_id_fkey for platform_impersonation_log)
--   Named constraints from DDL are preserved as-is.
--
-- ADR reference: ADR-0409 (workspace-FK CASCADE convention)
-- BUG-8, chair Phase 5 synthesis 2026-05-24.
-- ============================================================================

SET search_path TO public, extensions;

-- ─── 00001_identity_tables: profile.fk_profile_workspace ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS fk_profile_workspace;
  ALTER TABLE public.profile
    ADD CONSTRAINT fk_profile_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: profile.fk_profile_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP profile.fk_profile_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: season ──────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.season DROP CONSTRAINT IF EXISTS fk_season_workspace;
  ALTER TABLE public.season
    ADD CONSTRAINT fk_season_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: season.fk_season_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP season.fk_season_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: department ──────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.department DROP CONSTRAINT IF EXISTS fk_department_workspace;
  ALTER TABLE public.department
    ADD CONSTRAINT fk_department_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: department.fk_department_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP department.fk_department_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: location ────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.location DROP CONSTRAINT IF EXISTS fk_location_workspace;
  ALTER TABLE public.location
    ADD CONSTRAINT fk_location_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: location.fk_location_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP location.fk_location_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: zone ────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.zone DROP CONSTRAINT IF EXISTS fk_zone_workspace;
  ALTER TABLE public.zone
    ADD CONSTRAINT fk_zone_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: zone.fk_zone_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP zone.fk_zone_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: asset ───────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.asset DROP CONSTRAINT IF EXISTS fk_asset_workspace;
  ALTER TABLE public.asset
    ADD CONSTRAINT fk_asset_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: asset.fk_asset_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP asset.fk_asset_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: position ────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.position DROP CONSTRAINT IF EXISTS fk_position_workspace;
  ALTER TABLE public.position
    ADD CONSTRAINT fk_position_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: position.fk_position_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP position.fk_position_workspace: %', SQLERRM;
END $$;

-- ─── 00002_structure_tables: team ────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.team DROP CONSTRAINT IF EXISTS fk_team_workspace;
  ALTER TABLE public.team
    ADD CONSTRAINT fk_team_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: team.fk_team_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP team.fk_team_workspace: %', SQLERRM;
END $$;

-- ─── 00003_governance_tables: policy.fk_policy_workspace ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.policy DROP CONSTRAINT IF EXISTS fk_policy_workspace;
  ALTER TABLE public.policy
    ADD CONSTRAINT fk_policy_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: policy.fk_policy_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP policy.fk_policy_workspace: %', SQLERRM;
END $$;

-- ─── 00003_governance_tables: protocol.fk_protocol_workspace ─────────────────
DO $$ BEGIN
  ALTER TABLE public.protocol DROP CONSTRAINT IF EXISTS fk_protocol_workspace;
  ALTER TABLE public.protocol
    ADD CONSTRAINT fk_protocol_workspace
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: protocol.fk_protocol_workspace';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP protocol.fk_protocol_workspace: %', SQLERRM;
END $$;

-- ─── 00005_activity_trail: activity_trail_workspace_id_fkey ──────────────────
DO $$ BEGIN
  ALTER TABLE public.activity_trail DROP CONSTRAINT IF EXISTS activity_trail_workspace_id_fkey;
  ALTER TABLE public.activity_trail
    ADD CONSTRAINT activity_trail_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: activity_trail.activity_trail_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP activity_trail.activity_trail_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 00006_notification_engine: notification_outbox ──────────────────────────
DO $$ BEGIN
  ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_workspace_id_fkey;
  ALTER TABLE public.notification_outbox
    ADD CONSTRAINT notification_outbox_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: notification_outbox.notification_outbox_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP notification_outbox.notification_outbox_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 00009_onboarding_v3: onboarding_session ─────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.onboarding_session DROP CONSTRAINT IF EXISTS onboarding_session_workspace_id_fkey;
  ALTER TABLE public.onboarding_session
    ADD CONSTRAINT onboarding_session_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: onboarding_session.onboarding_session_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP onboarding_session.onboarding_session_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 00013_platform_admin_tables: platform_impersonation_log ─────────────────
-- NOTE: target_workspace_id column (not workspace_id) — different col name.
DO $$ BEGIN
  ALTER TABLE public.platform_impersonation_log
    DROP CONSTRAINT IF EXISTS platform_impersonation_log_target_workspace_id_fkey;
  ALTER TABLE public.platform_impersonation_log
    ADD CONSTRAINT platform_impersonation_log_target_workspace_id_fkey
      FOREIGN KEY (target_workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: platform_impersonation_log.target_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP platform_impersonation_log.target_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 00013_platform_admin_tables: platform_contract_instance ─────────────────
DO $$ BEGIN
  ALTER TABLE public.platform_contract_instance
    DROP CONSTRAINT IF EXISTS platform_contract_instance_workspace_id_fkey;
  ALTER TABLE public.platform_contract_instance
    ADD CONSTRAINT platform_contract_instance_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: platform_contract_instance.platform_contract_instance_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP platform_contract_instance.platform_contract_instance_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260228120000_platform_communications: platform_communication_log ───────
DO $$ BEGIN
  ALTER TABLE public.platform_communication_log
    DROP CONSTRAINT IF EXISTS platform_communication_log_workspace_id_fkey;
  ALTER TABLE public.platform_communication_log
    ADD CONSTRAINT platform_communication_log_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: platform_communication_log.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP platform_communication_log.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260228140000_contract_system_foundation: employment_contract ───────────
-- employment_contract has workspace_id added via ALTER TABLE ADD COLUMN
DO $$ BEGIN
  ALTER TABLE public.employment_contract DROP CONSTRAINT IF EXISTS employment_contract_workspace_id_fkey;
  ALTER TABLE public.employment_contract
    ADD CONSTRAINT employment_contract_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: employment_contract.employment_contract_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP employment_contract.employment_contract_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260228140000_contract_system_foundation: contract_reminder ─────────────
DO $$ BEGIN
  ALTER TABLE public.contract_reminder DROP CONSTRAINT IF EXISTS contract_reminder_workspace_id_fkey;
  ALTER TABLE public.contract_reminder
    ADD CONSTRAINT contract_reminder_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: contract_reminder.contract_reminder_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP contract_reminder.contract_reminder_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260228220000_pricing_terms_table: pricing_terms ───────────────────────
DO $$ BEGIN
  ALTER TABLE public.pricing_terms DROP CONSTRAINT IF EXISTS pricing_terms_workspace_id_fkey;
  ALTER TABLE public.pricing_terms
    ADD CONSTRAINT pricing_terms_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: pricing_terms.pricing_terms_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP pricing_terms.pricing_terms_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260228230000_api_key_management: platform_external_secret ──────────────
DO $$ BEGIN
  ALTER TABLE public.platform_external_secret
    DROP CONSTRAINT IF EXISTS platform_external_secret_workspace_id_fkey;
  ALTER TABLE public.platform_external_secret
    ADD CONSTRAINT platform_external_secret_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: platform_external_secret.platform_external_secret_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP platform_external_secret.platform_external_secret_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260301150000_create_custom_report: custom_report ──────────────────────
DO $$ BEGIN
  ALTER TABLE public.custom_report DROP CONSTRAINT IF EXISTS custom_report_workspace_id_fkey;
  ALTER TABLE public.custom_report
    ADD CONSTRAINT custom_report_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: custom_report.custom_report_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP custom_report.custom_report_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260301200000_engine_tables: engine_missions ───────────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_missions DROP CONSTRAINT IF EXISTS engine_missions_workspace_id_fkey;
  ALTER TABLE public.engine_missions
    ADD CONSTRAINT engine_missions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_missions.engine_missions_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_missions.engine_missions_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260301200000_engine_tables: engine_sessions ───────────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_sessions DROP CONSTRAINT IF EXISTS engine_sessions_workspace_id_fkey;
  ALTER TABLE public.engine_sessions
    ADD CONSTRAINT engine_sessions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_sessions.engine_sessions_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_sessions.engine_sessions_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260301200000_engine_tables: engine_inbox ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_inbox DROP CONSTRAINT IF EXISTS engine_inbox_workspace_id_fkey;
  ALTER TABLE public.engine_inbox
    ADD CONSTRAINT engine_inbox_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_inbox.engine_inbox_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_inbox.engine_inbox_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260302000000_engine_memory: engine_memory ─────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_memory DROP CONSTRAINT IF EXISTS engine_memory_workspace_id_fkey;
  ALTER TABLE public.engine_memory
    ADD CONSTRAINT engine_memory_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_memory.engine_memory_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_memory.engine_memory_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260302000100_engine_authority_config: engine_authority_config ──────────
DO $$ BEGIN
  ALTER TABLE public.engine_authority_config
    DROP CONSTRAINT IF EXISTS engine_authority_config_workspace_id_fkey;
  ALTER TABLE public.engine_authority_config
    ADD CONSTRAINT engine_authority_config_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_authority_config.engine_authority_config_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_authority_config.engine_authority_config_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304100000_engine_process_tables: engine_process ────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_process DROP CONSTRAINT IF EXISTS engine_process_workspace_id_fkey;
  ALTER TABLE public.engine_process
    ADD CONSTRAINT engine_process_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_process.engine_process_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_process.engine_process_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304100000_engine_process_tables: engine_trigger ────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_trigger DROP CONSTRAINT IF EXISTS engine_trigger_workspace_id_fkey;
  ALTER TABLE public.engine_trigger
    ADD CONSTRAINT engine_trigger_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_trigger.engine_trigger_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_trigger.engine_trigger_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304100000_engine_process_tables: engine_event ──────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_event DROP CONSTRAINT IF EXISTS engine_event_workspace_id_fkey;
  ALTER TABLE public.engine_event
    ADD CONSTRAINT engine_event_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_event.engine_event_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_event.engine_event_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304100000_engine_process_tables: engine_state ──────────────────────
DO $$ BEGIN
  ALTER TABLE public.engine_state DROP CONSTRAINT IF EXISTS engine_state_workspace_id_fkey;
  ALTER TABLE public.engine_state
    ADD CONSTRAINT engine_state_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_state.engine_state_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_state.engine_state_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304100000_engine_process_tables: engine_delayed_trigger ────────────
DO $$ BEGIN
  ALTER TABLE public.engine_delayed_trigger
    DROP CONSTRAINT IF EXISTS engine_delayed_trigger_workspace_id_fkey;
  ALTER TABLE public.engine_delayed_trigger
    ADD CONSTRAINT engine_delayed_trigger_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: engine_delayed_trigger.engine_delayed_trigger_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP engine_delayed_trigger.engine_delayed_trigger_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304200100_daily_reconciliation: settlement_image ────────────────────
DO $$ BEGIN
  ALTER TABLE public.settlement_image DROP CONSTRAINT IF EXISTS settlement_image_workspace_id_fkey;
  ALTER TABLE public.settlement_image
    ADD CONSTRAINT settlement_image_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: settlement_image.settlement_image_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP settlement_image.settlement_image_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304200100_daily_reconciliation: settlement_validation ───────────────
DO $$ BEGIN
  ALTER TABLE public.settlement_validation
    DROP CONSTRAINT IF EXISTS settlement_validation_workspace_id_fkey;
  ALTER TABLE public.settlement_validation
    ADD CONSTRAINT settlement_validation_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: settlement_validation.settlement_validation_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP settlement_validation.settlement_validation_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260304200200_deviation_shift_approval: shift_approval ─────────────────
DO $$ BEGIN
  ALTER TABLE public.shift_approval DROP CONSTRAINT IF EXISTS shift_approval_workspace_id_fkey;
  ALTER TABLE public.shift_approval
    ADD CONSTRAINT shift_approval_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: shift_approval.shift_approval_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP shift_approval.shift_approval_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260310140000_signup_tables: company_scraped_data ──────────────────────
DO $$ BEGIN
  ALTER TABLE public.company_scraped_data
    DROP CONSTRAINT IF EXISTS company_scraped_data_workspace_id_fkey;
  ALTER TABLE public.company_scraped_data
    ADD CONSTRAINT company_scraped_data_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: company_scraped_data.company_scraped_data_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP company_scraped_data.company_scraped_data_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260314000000_guardian_signal: guardian_signal ─────────────────────────
DO $$ BEGIN
  ALTER TABLE public.guardian_signal DROP CONSTRAINT IF EXISTS guardian_signal_workspace_id_fkey;
  ALTER TABLE public.guardian_signal
    ADD CONSTRAINT guardian_signal_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: guardian_signal.guardian_signal_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP guardian_signal.guardian_signal_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260314100000_guardian_log: guardian_log ───────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.guardian_log DROP CONSTRAINT IF EXISTS guardian_log_workspace_id_fkey;
  ALTER TABLE public.guardian_log
    ADD CONSTRAINT guardian_log_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: guardian_log.guardian_log_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP guardian_log.guardian_log_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260322100000_create_websites_schema: websites schema tables ────────────
-- PostgreSQL auto-names FKs as <table>_workspace_id_fkey for inline references.
-- website table is in the `websites` schema.
DO $$ BEGIN
  ALTER TABLE websites.website_page DROP CONSTRAINT IF EXISTS website_page_workspace_id_fkey;
  ALTER TABLE websites.website_page
    ADD CONSTRAINT website_page_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_page.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_page.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_section DROP CONSTRAINT IF EXISTS website_section_workspace_id_fkey;
  ALTER TABLE websites.website_section
    ADD CONSTRAINT website_section_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_section.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_section.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_menu DROP CONSTRAINT IF EXISTS website_menu_workspace_id_fkey;
  ALTER TABLE websites.website_menu
    ADD CONSTRAINT website_menu_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_menu.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_menu.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_menu_category
    DROP CONSTRAINT IF EXISTS website_menu_category_workspace_id_fkey;
  ALTER TABLE websites.website_menu_category
    ADD CONSTRAINT website_menu_category_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_menu_category.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_menu_category.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_menu_item DROP CONSTRAINT IF EXISTS website_menu_item_workspace_id_fkey;
  ALTER TABLE websites.website_menu_item
    ADD CONSTRAINT website_menu_item_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_menu_item.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_menu_item.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_asset DROP CONSTRAINT IF EXISTS website_asset_workspace_id_fkey;
  ALTER TABLE websites.website_asset
    ADD CONSTRAINT website_asset_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_asset.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_asset.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_published_snapshot
    DROP CONSTRAINT IF EXISTS website_published_snapshot_workspace_id_fkey;
  ALTER TABLE websites.website_published_snapshot
    ADD CONSTRAINT website_published_snapshot_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_published_snapshot.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_published_snapshot.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_draft_revision
    DROP CONSTRAINT IF EXISTS website_draft_revision_workspace_id_fkey;
  ALTER TABLE websites.website_draft_revision
    ADD CONSTRAINT website_draft_revision_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_draft_revision.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_draft_revision.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_domain DROP CONSTRAINT IF EXISTS website_domain_workspace_id_fkey;
  ALTER TABLE websites.website_domain
    ADD CONSTRAINT website_domain_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_domain.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_domain.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_preview_session
    DROP CONSTRAINT IF EXISTS website_preview_session_workspace_id_fkey;
  ALTER TABLE websites.website_preview_session
    ADD CONSTRAINT website_preview_session_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_preview_session.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_preview_session.workspace_id_fkey: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE websites.website_publish_event
    DROP CONSTRAINT IF EXISTS website_publish_event_workspace_id_fkey;
  ALTER TABLE websites.website_publish_event
    ADD CONSTRAINT website_publish_event_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_publish_event.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_publish_event.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260322200000_website_spokesperson: website_spokesperson ───────────────
-- Note: this table is in the `websites` schema
DO $$ BEGIN
  ALTER TABLE websites.website_spokesperson
    DROP CONSTRAINT IF EXISTS website_spokesperson_workspace_id_fkey;
  ALTER TABLE websites.website_spokesperson
    ADD CONSTRAINT website_spokesperson_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: websites.website_spokesperson.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP websites.website_spokesperson.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260324090000_timesheet_schema: timesheet.time_entry ───────────────────
DO $$ BEGIN
  ALTER TABLE timesheet.time_entry DROP CONSTRAINT IF EXISTS time_entry_workspace_id_fkey;
  ALTER TABLE timesheet.time_entry
    ADD CONSTRAINT time_entry_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: timesheet.time_entry.time_entry_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP timesheet.time_entry.time_entry_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260324100001_shift_clock_mobile_fixes: shift_clock_config ─────────────
DO $$ BEGIN
  ALTER TABLE public.shift_clock_config DROP CONSTRAINT IF EXISTS shift_clock_config_workspace_id_fkey;
  ALTER TABLE public.shift_clock_config
    ADD CONSTRAINT shift_clock_config_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: shift_clock_config.shift_clock_config_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP shift_clock_config.shift_clock_config_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260324100001_shift_clock_mobile_fixes: shift_note ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.shift_note DROP CONSTRAINT IF EXISTS shift_note_workspace_id_fkey;
  ALTER TABLE public.shift_note
    ADD CONSTRAINT shift_note_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: shift_note.shift_note_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP shift_note.shift_note_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260324220000_notification_table: notification ─────────────────────────
DO $$ BEGIN
  ALTER TABLE public.notification DROP CONSTRAINT IF EXISTS notification_workspace_id_fkey;
  ALTER TABLE public.notification
    ADD CONSTRAINT notification_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: notification.notification_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP notification.notification_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260417122044_usage_snapshot_table: usage_snapshot ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.usage_snapshot DROP CONSTRAINT IF EXISTS usage_snapshot_workspace_id_fkey;
  ALTER TABLE public.usage_snapshot
    ADD CONSTRAINT usage_snapshot_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: usage_snapshot.usage_snapshot_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP usage_snapshot.usage_snapshot_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260418100100_haccp_log: haccp_log ─────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.haccp_log DROP CONSTRAINT IF EXISTS haccp_log_workspace_id_fkey;
  ALTER TABLE public.haccp_log
    ADD CONSTRAINT haccp_log_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: haccp_log.haccp_log_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP haccp_log.haccp_log_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260421100300_add_profession_system: profession ────────────────────────
DO $$ BEGIN
  ALTER TABLE public.profession DROP CONSTRAINT IF EXISTS profession_workspace_id_fkey;
  ALTER TABLE public.profession
    ADD CONSTRAINT profession_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: profession.profession_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP profession.profession_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260421100300_add_profession_system: profession_training ───────────────
DO $$ BEGIN
  ALTER TABLE public.profession_training DROP CONSTRAINT IF EXISTS profession_training_workspace_id_fkey;
  ALTER TABLE public.profession_training
    ADD CONSTRAINT profession_training_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: profession_training.profession_training_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP profession_training.profession_training_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel ──────────────────────────
DO $$ BEGIN
  ALTER TABLE public.channel DROP CONSTRAINT IF EXISTS channel_workspace_id_fkey;
  ALTER TABLE public.channel
    ADD CONSTRAINT channel_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel.channel_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel.channel_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_member ───────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_member DROP CONSTRAINT IF EXISTS channel_member_workspace_id_fkey;
  ALTER TABLE public.channel_member
    ADD CONSTRAINT channel_member_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_member.channel_member_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_member.channel_member_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_message ──────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_message DROP CONSTRAINT IF EXISTS channel_message_workspace_id_fkey;
  ALTER TABLE public.channel_message
    ADD CONSTRAINT channel_message_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_message.channel_message_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_message.channel_message_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_event ────────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_event DROP CONSTRAINT IF EXISTS channel_event_workspace_id_fkey;
  ALTER TABLE public.channel_event
    ADD CONSTRAINT channel_event_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_event.channel_event_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_event.channel_event_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_message_reaction ──────────
DO $$ BEGIN
  ALTER TABLE public.channel_message_reaction
    DROP CONSTRAINT IF EXISTS channel_message_reaction_workspace_id_fkey;
  ALTER TABLE public.channel_message_reaction
    ADD CONSTRAINT channel_message_reaction_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_message_reaction.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_message_reaction.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_message_attachment ─────────
DO $$ BEGIN
  ALTER TABLE public.channel_message_attachment
    DROP CONSTRAINT IF EXISTS channel_message_attachment_workspace_id_fkey;
  ALTER TABLE public.channel_message_attachment
    ADD CONSTRAINT channel_message_attachment_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_message_attachment.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_message_attachment.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_message_read ──────────────
DO $$ BEGIN
  ALTER TABLE public.channel_message_read
    DROP CONSTRAINT IF EXISTS channel_message_read_workspace_id_fkey;
  ALTER TABLE public.channel_message_read
    ADD CONSTRAINT channel_message_read_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_message_read.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_message_read.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_integration ───────────────
DO $$ BEGIN
  ALTER TABLE public.channel_integration DROP CONSTRAINT IF EXISTS channel_integration_workspace_id_fkey;
  ALTER TABLE public.channel_integration
    ADD CONSTRAINT channel_integration_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_integration.channel_integration_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_integration.channel_integration_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_notification_policy ────────
DO $$ BEGIN
  ALTER TABLE public.channel_notification_policy
    DROP CONSTRAINT IF EXISTS channel_notification_policy_workspace_id_fkey;
  ALTER TABLE public.channel_notification_policy
    ADD CONSTRAINT channel_notification_policy_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_notification_policy.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_notification_policy.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_ai_policy ────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_ai_policy DROP CONSTRAINT IF EXISTS channel_ai_policy_workspace_id_fkey;
  ALTER TABLE public.channel_ai_policy
    ADD CONSTRAINT channel_ai_policy_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_ai_policy.channel_ai_policy_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_ai_policy.channel_ai_policy_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300000_channel_communications: channel_retention_policy ──────────
DO $$ BEGIN
  ALTER TABLE public.channel_retention_policy
    DROP CONSTRAINT IF EXISTS channel_retention_policy_workspace_id_fkey;
  ALTER TABLE public.channel_retention_policy
    ADD CONSTRAINT channel_retention_policy_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_retention_policy.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_retention_policy.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422300600_help_request_table: help_request ─────────────────────────
DO $$ BEGIN
  ALTER TABLE public.help_request DROP CONSTRAINT IF EXISTS help_request_workspace_id_fkey;
  ALTER TABLE public.help_request
    ADD CONSTRAINT help_request_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: help_request.help_request_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP help_request.help_request_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422301000_channel_voice: channel_presence ──────────────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_presence DROP CONSTRAINT IF EXISTS channel_presence_workspace_id_fkey;
  ALTER TABLE public.channel_presence
    ADD CONSTRAINT channel_presence_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_presence.channel_presence_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_presence.channel_presence_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422301000_channel_voice: channel_call_session ──────────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_call_session
    DROP CONSTRAINT IF EXISTS channel_call_session_workspace_id_fkey;
  ALTER TABLE public.channel_call_session
    ADD CONSTRAINT channel_call_session_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_call_session.channel_call_session_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_call_session.channel_call_session_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422301000_channel_voice: channel_call_participant ──────────────────
DO $$ BEGIN
  ALTER TABLE public.channel_call_participant
    DROP CONSTRAINT IF EXISTS channel_call_participant_workspace_id_fkey;
  ALTER TABLE public.channel_call_participant
    ADD CONSTRAINT channel_call_participant_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: channel_call_participant.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP channel_call_participant.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260422301000_channel_voice: call_log ──────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.call_log DROP CONSTRAINT IF EXISTS call_log_workspace_id_fkey;
  ALTER TABLE public.call_log
    ADD CONSTRAINT call_log_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: call_log.call_log_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP call_log.call_log_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260505110000_unified_authority_gate: gate_evaluation ──────────────────
DO $$ BEGIN
  ALTER TABLE public.gate_evaluation DROP CONSTRAINT IF EXISTS gate_evaluation_workspace_id_fkey;
  ALTER TABLE public.gate_evaluation
    ADD CONSTRAINT gate_evaluation_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: gate_evaluation.gate_evaluation_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP gate_evaluation.gate_evaluation_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260511200001_billing_dispatch_rule_table: billing_dispatch_rule ─────────
DO $$ BEGIN
  ALTER TABLE public.billing_dispatch_rule
    DROP CONSTRAINT IF EXISTS billing_dispatch_rule_workspace_id_fkey;
  ALTER TABLE public.billing_dispatch_rule
    ADD CONSTRAINT billing_dispatch_rule_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: billing_dispatch_rule.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP billing_dispatch_rule.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260511200002_billing_dispatch_template_table: billing_dispatch_template ─
DO $$ BEGIN
  ALTER TABLE public.billing_dispatch_template
    DROP CONSTRAINT IF EXISTS billing_dispatch_template_workspace_id_fkey;
  ALTER TABLE public.billing_dispatch_template
    ADD CONSTRAINT billing_dispatch_template_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: billing_dispatch_template.workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP billing_dispatch_template.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260511200004_billing_integration_table: billing_integration ─────────────
DO $$ BEGIN
  ALTER TABLE public.billing_integration DROP CONSTRAINT IF EXISTS billing_integration_workspace_id_fkey;
  ALTER TABLE public.billing_integration
    ADD CONSTRAINT billing_integration_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: billing_integration.billing_integration_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP billing_integration.billing_integration_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260519100100_contracts_module_foundation: pension_scheme ───────────────
-- Was ON DELETE RESTRICT — changed to CASCADE per ADR-0409.
-- Pension schemes are workspace-scoped config, not independent accounting records.
DO $$ BEGIN
  ALTER TABLE public.pension_scheme DROP CONSTRAINT IF EXISTS pension_scheme_workspace_id_fkey;
  ALTER TABLE public.pension_scheme
    ADD CONSTRAINT pension_scheme_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: pension_scheme.pension_scheme_workspace_id_fkey (was RESTRICT)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP pension_scheme.pension_scheme_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260519100100_contracts_module_foundation: contract_amendment ────────────
-- Was ON DELETE RESTRICT — changed to CASCADE per ADR-0409.
DO $$ BEGIN
  ALTER TABLE public.contract_amendment DROP CONSTRAINT IF EXISTS contract_amendment_workspace_id_fkey;
  ALTER TABLE public.contract_amendment
    ADD CONSTRAINT contract_amendment_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: contract_amendment.contract_amendment_workspace_id_fkey (was RESTRICT)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP contract_amendment.contract_amendment_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260522000000_billing_settlement_schema: billing.settlement_period ───────
-- Was ON DELETE RESTRICT — changed to CASCADE per ADR-0409.
SET search_path TO billing, public, extensions;
DO $$ BEGIN
  ALTER TABLE billing.settlement_period
    DROP CONSTRAINT IF EXISTS settlement_period_workspace_id_fkey;
  ALTER TABLE billing.settlement_period
    ADD CONSTRAINT settlement_period_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: billing.settlement_period.settlement_period_workspace_id_fkey (was RESTRICT)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP billing.settlement_period.settlement_period_workspace_id_fkey: %', SQLERRM;
END $$;
SET search_path TO public, extensions;

-- ─── 20260527100600_payroll_phase1_dynamic_supplements: supplement_rule_match ──
-- Was ON DELETE RESTRICT — changed to CASCADE per ADR-0409.
DO $$ BEGIN
  ALTER TABLE public.supplement_rule_match
    DROP CONSTRAINT IF EXISTS supplement_rule_match_workspace_id_fkey;
  ALTER TABLE public.supplement_rule_match
    ADD CONSTRAINT supplement_rule_match_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: supplement_rule_match.workspace_id_fkey (was RESTRICT)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP supplement_rule_match.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260527100700_payroll_phase1_audit_event: shift_pay_calculation_event ───
-- Was ON DELETE RESTRICT — changed to CASCADE per ADR-0409.
-- Comment in original: "accounting records outlive workspace soft-close" —
-- this applies to soft-close. Hard workspace delete (operator action) should
-- cascade. Operator gate in ADR-0265 HOP B checklist ensures intentionality.
DO $$ BEGIN
  ALTER TABLE public.shift_pay_calculation_event
    DROP CONSTRAINT IF EXISTS shift_pay_calculation_event_workspace_id_fkey;
  ALTER TABLE public.shift_pay_calculation_event
    ADD CONSTRAINT shift_pay_calculation_event_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: shift_pay_calculation_event.workspace_id_fkey (was RESTRICT)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP shift_pay_calculation_event.workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260603000000_overtime_cap_policy (already CASCADE — verified) ──────────
-- SKIP: overtime_cap_policy already has ON DELETE CASCADE (multi-line format).

-- ─── 20260604000001_staff_event: staff_event ─────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.staff_event DROP CONSTRAINT IF EXISTS staff_event_workspace_id_fkey;
  ALTER TABLE public.staff_event
    ADD CONSTRAINT staff_event_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: staff_event.staff_event_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP staff_event.staff_event_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260622100000_routine_location_team_scope: routine (ALTER TABLE ADD COL) ─
-- workspace_id added via ALTER TABLE ADD COLUMN to existing `routine` table.
DO $$ BEGIN
  ALTER TABLE public.routine DROP CONSTRAINT IF EXISTS routine_workspace_id_fkey;
  ALTER TABLE public.routine
    ADD CONSTRAINT routine_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;
  RAISE NOTICE 'CASCADE applied: routine.routine_workspace_id_fkey';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP routine.routine_workspace_id_fkey: %', SQLERRM;
END $$;

-- ─── 20260618100000 (already CASCADE — verified) ─────────────────────────────
-- SKIP: workspace_union_binding and payroll.tariff_snapshot already CASCADE
-- (multi-line FK declaration with ON DELETE CASCADE on separate line).
