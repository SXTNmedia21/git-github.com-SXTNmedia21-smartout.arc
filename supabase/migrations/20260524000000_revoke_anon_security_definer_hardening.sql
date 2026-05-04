-- Migration: REVOKE EXECUTE ON SECURITY DEFINER functions FROM anon
-- Authority: get_advisors security audit 2026-05-04 (89 anon-callable functions)
-- Bundled with HOP B 94-migration push for tomorrow's pipeline cutover.
--
-- This migration is IDEMPOTENT — REVOKE on already-revoked = no-op.
--
-- Classification methodology:
--   Per-function grep of .rpc() call sites across apps/, packages/, supabase/functions/
--   + SQL body inspection for auth.uid() usage + EF JWT verification mode.
--
-- Two categories NOT revoked here:
--   1. NEEDS-REVIEW — functions with legitimate anon callers (require re-architecture)
--   2. None skipped for any other reason
--
-- NEEDS-REVIEW (1 function — NOT revoked):
--   public.get_invitation_by_token(p_token uuid)
--   Reason: Called pre-auth in apps/web/src/app/invite/[token]/page.tsx and
--           apps/web/src/app/signup/page.tsx BEFORE the user has an auth session.
--           Requires alternative: signed token validation or short-lived signed URL.
--           See companion doc for full ADR + alternative design notes.
--
-- See companion doc: docs/handoffs/HANDOFF-2026-05-04-anon-revoke-classification.md
-- for full per-function classification + rationale.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: EXPLOIT-CRITICAL — destructive/PII/control-plane functions
-- These should NEVER be callable without authentication, period.
-- ═══════════════════════════════════════════════════════════════════════════

-- PII destruction
REVOKE EXECUTE ON FUNCTION public.anonymize_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.anonymize_contract(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_submit_employee_pii(uuid, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_own_pii(uuid, text, jsonb) FROM anon;

-- C4 control plane / authority gate
REVOKE EXECUTE ON FUNCTION public.cascade_gate_write(text, uuid, text, uuid, jsonb, jsonb, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gate_action(uuid, text, text, uuid, text, text, uuid, uuid[], uuid) FROM anon;

-- API key / secrets management
REVOKE EXECUTE ON FUNCTION public.rotate_api_key(uuid, public.api_key_type, text, character varying, character varying, interval) FROM anon;

-- Audit trail integrity
REVOKE EXECUTE ON FUNCTION public.rollback_audit_entry(uuid) FROM anon;

-- Platform admin tools
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_platform_metrics() FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2: TRIGGER FUNCTIONS — RETURNS trigger, invoked by DB engine only
-- These cannot be called via HTTP RPC. REVOKE is defense-in-depth.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.audit_schedule_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_assign_protocols_to_new_employee() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_department_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_session_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_team_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_assignment_completion_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_completion_on_observer_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_contract_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_critical_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_outbox_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.emit_season_activated_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.emit_session_pending_signoff_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_schedule_shift_temporal_lock() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_swap_result() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_nested_credit_notes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.project_engine_event_to_channel_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_payroll_on_contract_signed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_department_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_channel_message_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_due_emma_tasks() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_incoming_call_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_journey_health_push() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_missed_call_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_chat_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_deviation_reported() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_join_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_shift_published() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_shift_updated() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_push_task_assigned() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_billing_basis_drift() FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: RLS HELPER FUNCTIONS
-- Used in RLS policies internally. Anon callers return null/false anyway
-- (all use auth.uid() which is null for anon). REVOKE removes the exposure.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.get_workspace_ids_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_in_workspace(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_in_company(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_participant_in_conversation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_override_schedule_shift_lock(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_shift_cost(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.schedule_shift_is_temporally_locked(uuid, date, time without time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_schedule_shift_lock_mode(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_email_verified(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_gate_caller(uuid) FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: CRON / MAINTENANCE FUNCTIONS
-- All callers verified to use service_role key (Edge Functions with verify_jwt=false
-- but internal auth via SERVICE_ROLE_KEY, not anon key).
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_api_keys() FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_completed_engine_states(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_onboarding_workspaces(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_dangling_company_members() FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_empty_workspaces() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_invitations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fetch_pending_outbox(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_api_key_usage(uuid, text, smallint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification(text, uuid, uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_swap_notification(uuid, uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_communication_counter(uuid, text) FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5: AUTHENTICATED-CALLER FUNCTIONS
-- All call sites verified: JWT-validated Edge Functions, authenticated API routes,
-- AI capability tools (ctx.supabaseAdmin = service_role), or authenticated client hooks.
-- No anon call path exists for any of these functions.
-- ═══════════════════════════════════════════════════════════════════════════

-- Onboarding / workspace bootstrap (called via EFs that require auth.getUser() or adminClient)
REVOKE EXECUTE ON FUNCTION public.activate_workspace_v3(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_onboarding_workspace(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_workspace_transaction(uuid, text, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_workspace_transaction(uuid, text, jsonb, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_onboarding_workspace(uuid, jsonb) FROM anon;

-- Shift swap (authenticated API routes + AI capability tools)
REVOKE EXECUTE ON FUNCTION public.approve_shift_swap(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_shift_swap(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.initiate_shift_swap(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_shift_swap(uuid, boolean, text) FROM anon;

-- AI agent / stage-engine (service_role supabaseAdmin context)
REVOKE EXECUTE ON FUNCTION public.append_conversation_turn(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_assignment_completion_fn_direct(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_contract_intake_completion(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decline_contract_intake(uuid, uuid, text) FROM anon;

-- Communication / channels (authenticated dashboard + mobile hooks)
REVOKE EXECUTE ON FUNCTION public.create_channel(uuid, public.comm_channel_type, text, uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_dm_conversation(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_channel_messages(uuid, timestamp with time zone, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_channels(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_counts(uuid) FROM anon;

-- Billing / invoicing (platform-admin + AI capability, service_role)
REVOKE EXECUTE ON FUNCTION public.get_invoice_basis(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.snapshot_shift_cost(uuid) FROM anon;

-- Schedule / shift management (authenticated API routes + triggers)
REVOKE EXECUTE ON FUNCTION public.derive_shift_hours(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_readiness(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_schedule_shift_lock_violation(uuid, uuid, text, text, date, time without time zone, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_schedule_shift_lock_audit(uuid, uuid, text, text, text, boolean, boolean, date, time without time zone, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_schedule_shift_lock_audit(uuid, uuid, text, text, text, boolean, date, time without time zone, jsonb, jsonb) FROM anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- SKIPPED — NEEDS-REVIEW (1 function)
-- ═══════════════════════════════════════════════════════════════════════════
-- public.get_invitation_by_token(p_token uuid)
--
-- Reason: Called BEFORE authentication exists in two confirmed anon flows:
--   1. apps/web/src/app/invite/[token]/page.tsx — server component reads invite
--      details to render the invite page for an unauthenticated visitor
--   2. apps/web/src/app/signup/page.tsx — client validates invite token before
--      triggering auth.signUp() or auth.signInWithOtp()
--
-- The function only returns invitation metadata (first_name, last_name, email,
-- role, expires_at) for a pending invite — it does NOT write any data. Risk is
-- information disclosure of invite contents by token brute-force (mitigated by
-- the UUID token space, but not eliminated).
--
-- Required before revoking:
--   1. ADR: choose alternative — signed JWT in URL, or move lookup to a dedicated
--      Edge Function with rate-limiting and no DB-level anon access
--   2. Update both call sites to use the new mechanism
--   3. Add migration to explicitly GRANT to authenticated only
-- ═══════════════════════════════════════════════════════════════════════════

COMMIT;

-- Post-apply verification:
-- SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn,
--        pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
-- FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE p.prosecdef = true
--   AND n.nspname = 'public'
-- ORDER BY anon_can_execute DESC;
--
-- Expected result after apply: all rows show anon_can_execute = false
-- except public.get_invitation_by_token (still true — NEEDS-REVIEW).
