-- Migration: Add IF NOT EXISTS guards to bare CREATE INDEX statements
--
-- WHY THIS EXISTS:
-- Supabase Branch DBs replay ALL migrations from scratch when created.
-- Any bare CREATE INDEX (without IF NOT EXISTS) will fail on replay because
-- the index was already created by an earlier run of the same migration.
-- This migration re-creates each affected index with IF NOT EXISTS so that
-- the full migration chain can be replayed safely in any environment.
--
-- IMPORTANT: Do NOT modify the original migration files. This wrapper is
-- the canonical fix. Each statement below is idempotent and safe to run
-- multiple times against any database state.

-- ─── 00001_identity_tables.sql ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_company_org_number ON public.company(org_number);
CREATE INDEX IF NOT EXISTS idx_profile_workspace_id ON public.profile(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id);

-- ─── 00005_activity_trail.sql ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_activity_entity
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_actor
  ON activity_trail (workspace_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_workspace_time
  ON activity_trail (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_category
  ON activity_trail (workspace_id, category, created_at DESC);

-- ─── 00006_notification_engine.sql ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON public.notification_outbox(status, scheduled_for)
  WHERE status = 'pending';

-- ─── 00013_platform_admin_tables.sql ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_platform_audit_admin
  ON public.platform_audit_log (super_admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_entity
  ON public.platform_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_time
  ON public.platform_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin
  ON public.platform_impersonation_log (super_admin_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_config_slug
  ON public.landing_config (slug);

CREATE INDEX IF NOT EXISTS idx_landing_config_status
  ON public.landing_config (status);

CREATE INDEX IF NOT EXISTS idx_landing_config_version
  ON public.landing_config_version (config_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_platform_contract_company
  ON public.platform_contract_instance (company_id);

CREATE INDEX IF NOT EXISTS idx_platform_contract_workspace
  ON public.platform_contract_instance (workspace_id);

CREATE INDEX IF NOT EXISTS idx_platform_contract_status
  ON public.platform_contract_instance (status);

CREATE INDEX IF NOT EXISTS idx_platform_contract_template
  ON public.platform_contract_instance (template_id);

-- ─── 20260310150000_workspace_note.sql ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspace_note_workspace
  ON public.workspace_note (workspace_id, created_at DESC);

-- ─── 20260311042814_emma_task.sql ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_emma_task_due
  ON emma_task (status, due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emma_task_workspace
  ON emma_task (workspace_id, profile_id, status);

-- ─── 20260318130000_emma_note.sql ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_emma_note_profile_status
  ON emma_note (profile_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_emma_note_workspace
  ON emma_note (workspace_id, created_at DESC);

-- ─── 20260318130100_emma_conversation.sql ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_emma_conversation_profile
  ON emma_conversation (profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_emma_transcript_conversation
  ON emma_transcript (conversation_id, created_at ASC);

-- ─── 20260322100000_create_websites_schema.sql ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_website_workspace
  ON websites.website(workspace_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_page_website
  ON websites.website_page(website_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_section_page
  ON websites.website_section(website_page_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_menu_website
  ON websites.website_menu(website_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_menu_cat_menu
  ON websites.website_menu_category(website_menu_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_menu_item_cat
  ON websites.website_menu_item(website_menu_category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_asset_website
  ON websites.website_asset(website_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_domain_website
  ON websites.website_domain(website_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_domain_lookup
  ON websites.website_domain(domain)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_website_snapshot_active
  ON websites.website_published_snapshot(website_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- ─── 20260322200000_website_spokesperson.sql ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_spokesperson_website
  ON websites.website_spokesperson(website_id);

CREATE INDEX IF NOT EXISTS idx_spokesperson_profile
  ON websites.website_spokesperson(profile_id);

CREATE INDEX IF NOT EXISTS idx_spokesperson_status
  ON websites.website_spokesperson(status);

-- ─── 20260324220000_notification_table.sql ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notification_recipient_unread
  ON notification(recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notification_group
  ON notification(recipient_id, group_key, created_at DESC)
  WHERE group_key IS NOT NULL;

-- ─── 20260326120002_mal_modus_template_shift_id.sql ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_schedule_shift_template_shift
  ON schedule_shift (template_shift_id)
  WHERE template_shift_id IS NOT NULL;

-- ─── 20260329200000_workspace_status_and_sandbox.sql ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspace_sandbox_deadline
  ON workspace (status, verification_deadline)
  WHERE status = 'sandbox';

-- ─── 20260330120000_create_leader_pulse.sql ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leader_pulse_status
  ON leader_pulse(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_leader_pulse_workspace
  ON leader_pulse(workspace_id);

CREATE INDEX IF NOT EXISTS idx_leader_pulse_profile
  ON leader_pulse(profile_id, status);

-- ─── 20260407100000_service_config.sql ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_service_config_slug
  ON service_config(slug);

CREATE INDEX IF NOT EXISTS idx_service_config_log_service
  ON service_config_log(service_id, created_at DESC);

-- ─── 20260416100000_document_extraction_logs.sql ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_extraction_log_workspace
  ON document_extraction_log(workspace_id);

-- ─── 20260422110750_department_shift_type_config.sql ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_dept_shift_config_dept
  ON department_shift_type_config (department_id);

CREATE INDEX IF NOT EXISTS idx_dept_shift_config_workspace
  ON department_shift_type_config (workspace_id);

-- ─── 20260422300000_channel_communications.sql ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_channel_workspace
  ON channel(workspace_id);

CREATE INDEX IF NOT EXISTS idx_channel_department
  ON channel(department_id)
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_team
  ON channel(team_id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_session
  ON channel(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_member_channel_active
  ON channel_member(channel_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_channel_member_profile_active
  ON channel_member(profile_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_channel_member_workspace
  ON channel_member(workspace_id);

CREATE INDEX IF NOT EXISTS idx_channel_message_channel_created
  ON channel_message(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_message_workspace
  ON channel_message(workspace_id);

CREATE INDEX IF NOT EXISTS idx_channel_message_reply_to
  ON channel_message(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_event_channel
  ON channel_event(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_event_workspace
  ON channel_event(workspace_id);

CREATE INDEX IF NOT EXISTS idx_channel_event_correlation
  ON channel_event(correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_message_event
  ON channel_message(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_reaction_message
  ON channel_message_reaction(message_id);

CREATE INDEX IF NOT EXISTS idx_channel_reaction_channel
  ON channel_message_reaction(channel_id);

CREATE INDEX IF NOT EXISTS idx_channel_attachment_message
  ON channel_message_attachment(message_id);

-- ─── 20260422300600_help_request_table.sql ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_help_request_workspace
  ON help_request(workspace_id);

CREATE INDEX IF NOT EXISTS idx_help_request_profile
  ON help_request(profile_id);

CREATE INDEX IF NOT EXISTS idx_help_request_status
  ON help_request(status)
  WHERE status != 'closed';

-- ─── 20260422300900_hms_deviation_linkage.sql ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deviation_source_task
  ON deviation(source_task_id)
  WHERE source_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deviation_procedure
  ON deviation(procedure_id)
  WHERE procedure_id IS NOT NULL;

-- ─── 20260422301000_channel_voice.sql ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_channel_presence_workspace
  ON channel_presence(workspace_id);

CREATE INDEX IF NOT EXISTS idx_channel_presence_channel
  ON channel_presence(channel_id);

CREATE INDEX IF NOT EXISTS idx_call_session_workspace
  ON channel_call_session(workspace_id);

CREATE INDEX IF NOT EXISTS idx_call_session_channel
  ON channel_call_session(channel_id);

-- NOTE: idx_call_session_active is superseded by 20260422301100_voice_video_improvements.sql
-- which drops and recreates it with an expanded definition. The final form is guarded below.

CREATE INDEX IF NOT EXISTS idx_call_participant_workspace
  ON channel_call_participant(workspace_id);

CREATE INDEX IF NOT EXISTS idx_call_participant_session
  ON channel_call_participant(call_session_id);

CREATE INDEX IF NOT EXISTS idx_call_participant_profile
  ON channel_call_participant(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_log_workspace
  ON call_log(workspace_id);

CREATE INDEX IF NOT EXISTS idx_call_log_channel
  ON call_log(channel_id, created_at DESC);

-- ─── 20260422301100_voice_video_improvements.sql ─────────────────────────────
-- This migration explicitly drops and recreates idx_call_session_active with a new definition.
-- The DROP IF EXISTS in the original handles replay; the CREATE here adds IF NOT EXISTS safety.

CREATE INDEX IF NOT EXISTS idx_call_session_active
  ON channel_call_session(channel_id, workspace_id, started_at DESC)
  WHERE status = 'active';

-- ─── 20260422500100_shift_note.sql ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shift_note_shift
  ON shift_note(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_note_workspace
  ON shift_note(workspace_id);
