---
title: "Migration #95 anon REVOKE — function classification"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: security
tags: [migration-95, anon-revoke, security-hardening, hop-b]
---

# Migration #95 — anon REVOKE Classification

**Migration file:** `supabase/migrations/20260524000000_revoke_anon_security_definer_hardening.sql`
**Trigger:** `get_advisors` security audit 2026-05-04 — 89 SECURITY DEFINER functions callable by `anon`
**Methodology:** Per-function grep of `.rpc()` call sites across `apps/`, `packages/`, `supabase/functions/` + SQL body inspection for `auth.uid()` usage + EF JWT verification mode analysis

---

## Summary

| Category | Count |
|----------|-------|
| EXPLOIT-CRITICAL revoked | 10 |
| Trigger functions revoked | 32 |
| RLS helper functions revoked | 10 |
| Cron / maintenance functions revoked | 11 |
| Authenticated-caller functions revoked | 25 |
| **Total REVOKED** | **88** |
| NEEDS-REVIEW (NOT revoked) | 1 |
| **Grand total** | **89** |

---

## Section 1 — EXPLOIT-CRITICAL (10 revoked)

These are destructive, PII-handling, or control-plane functions. They should never be callable without authentication under any circumstances. If any call site currently invokes these from an unauthenticated context, that is a separate bug to fix — do not unblock by skipping the REVOKE.

| Function | Signature | Why it must never be anon |
|----------|-----------|--------------------------|
| `anonymize_user` | `(target_user_id uuid)` | GDPR erasure — permanently destroys user PII. Anon caller could erase arbitrary users. |
| `anonymize_contract` | `(p_contract_id uuid)` | Destroys contract PII. Same risk class as anonymize_user. |
| `admin_submit_employee_pii` | `(p_profile_id uuid, p_field_group text, p_values jsonb, p_reason text)` | Admin writes PII for another employee. Anon caller = identity spoofing / PII injection. |
| `submit_own_pii` | `(p_workspace_id uuid, p_field_group text, p_values jsonb)` | Writes personnummer/bank/address. Requires authenticated identity — no anon should write PII. |
| `cascade_gate_write` | `(p_entity_type text, p_entity_id uuid, p_action text, p_workspace_id uuid, p_proposed_data jsonb, p_current_data jsonb, p_actor_profile_id uuid, p_capability text)` | C4 gate write — direct control-plane bypass. Anon caller provides their own `p_actor_profile_id`. |
| `gate_action` | `(p_workspace_id uuid, p_capability text, p_channel text, p_actor_profile_id uuid, p_action_type text, p_engine_process_id text, p_engine_state_id uuid, p_approvers_present uuid[], p_entity_id uuid)` | Unified authority gate (ADR-0099). Anon-callable = ungated actions with attacker-supplied actor ID. |
| `rotate_api_key` | `(p_workspace_id uuid, p_key_type public.api_key_type, p_environment text, p_new_key_hash character varying, p_new_key_prefix character varying, p_grace_period interval)` | Rotates production API keys. Anon caller could invalidate all API keys for any workspace. |
| `rollback_audit_entry` | `(p_audit_log_id uuid)` | Rolls back schedule audit log entries. Has `auth.uid()` check internally, but REVOKE adds defense-in-depth — do not rely solely on runtime guard for audit integrity. |
| `rls_auto_enable` | `()` | Platform admin tool that enables RLS on tables. Anon call could trigger unintended schema changes. |
| `compute_platform_metrics` | `()` | Writes to `platform_metrics_daily`. No auth gate in body. Platform-level data — no reason for anon access. |

---

## Section 2 — Trigger Functions (32 revoked)

All of these are `RETURNS trigger` functions invoked by the PostgreSQL trigger system, not via HTTP RPC. An anon HTTP client cannot meaningfully call them — Supabase PostgREST would reject trigger-returning functions. REVOKE is defense-in-depth.

| Function | Signature | Trigger context |
|----------|-----------|-----------------|
| `audit_schedule_changes` | `()` | AFTER INSERT/UPDATE/DELETE on `schedule_shift` |
| `auto_assign_protocols_to_new_employee` | `()` | AFTER INSERT on `profile` |
| `auto_create_department_channel` | `()` | AFTER INSERT on `department` |
| `auto_create_session_channel` | `()` | AFTER INSERT on `department_session` |
| `auto_create_team_channel` | `()` | AFTER INSERT on `team` |
| `check_assignment_completion_fn` | `()` | AFTER UPDATE on `protocol_assignment` |
| `check_completion_on_observer_fn` | `()` | AFTER UPDATE on observer session |
| `dispatch_contract_notification` | `()` | AFTER UPDATE on contract state |
| `dispatch_critical_notification` | `()` | Critical event trigger |
| `dispatch_outbox_notification` | `()` | AFTER INSERT on `notification_outbox` |
| `emit_season_activated_event` | `()` | AFTER UPDATE on season status |
| `emit_session_pending_signoff_event` | `()` | AFTER UPDATE on session state |
| `enforce_schedule_shift_temporal_lock` | `()` | BEFORE INSERT/UPDATE on `schedule_shift` |
| `handle_new_user` | `()` | AFTER INSERT on `auth.users` — Supabase Auth hook |
| `notify_swap_result` | `()` | AFTER UPDATE on `shift_swap` |
| `prevent_nested_credit_notes` | `()` | BEFORE INSERT on `invoice` |
| `project_engine_event_to_channel_event` | `()` | AFTER INSERT on `engine_event` |
| `sync_payroll_on_contract_signed` | `()` | AFTER UPDATE on contract signing |
| `sync_profile_department_channel` | `()` | AFTER UPDATE on `profile.department_id` |
| `trigger_channel_message_notification` | `()` | AFTER INSERT on `channel_message` |
| `trigger_due_emma_tasks` | `()` | Cron/trigger invocation — service_role context |
| `trigger_incoming_call_notification` | `()` | AFTER INSERT on incoming call event |
| `trigger_journey_health_push` | `()` | AFTER UPDATE on journey health |
| `trigger_missed_call_notification` | `()` | AFTER INSERT on missed call event |
| `trigger_push_chat_message` | `()` | AFTER INSERT on `channel_message` (push variant) |
| `trigger_push_deviation_reported` | `()` | AFTER INSERT on `deviation` |
| `trigger_push_join_request` | `()` | AFTER INSERT on join request |
| `trigger_push_shift_published` | `()` | AFTER UPDATE on shift publish |
| `trigger_push_shift_updated` | `()` | AFTER UPDATE on `schedule_shift` |
| `trigger_push_task_assigned` | `()` | AFTER INSERT on task assignment |
| `assign_invoice_number` | `()` | BEFORE INSERT/UPDATE on `invoice` (status='issued') |
| `detect_billing_basis_drift` | `()` | AFTER UPDATE/DELETE on `shift_cost_snapshot` |

---

## Section 3 — RLS Helper Functions (10 revoked)

These are used in RLS policies and called internally from other functions. All use `auth.uid()` which returns `NULL` for anon callers, making anon calls return `null`/`false`/empty set anyway. REVOKE removes the exposure from the public API surface.

| Function | Signature | Why safe to revoke |
|----------|-----------|-------------------|
| `get_workspace_ids_for_user` | `(uid uuid)` | Returns empty set for anon (no profile with null user_id). Used in RLS SELECT policies. |
| `is_admin_in_workspace` | `(uid uuid, wid uuid)` | Returns false for anon. Used in RLS policies + API routes. |
| `is_admin_in_company` | `(p_user_id uuid, p_company_id uuid)` | Returns false for anon. Migration already has explicit `GRANT ... TO authenticated` — no anon grant needed. |
| `is_participant_in_conversation` | `(conv_id uuid)` | Uses `auth.uid()` — returns false for anon. Used in `chat_participant` RLS. |
| `can_override_schedule_shift_lock` | `(p_workspace_id uuid)` | Uses `auth.uid()` — explicitly returns false if uid is null. |
| `can_read_shift_cost` | `(wid uuid)` | Returns false for anon (neither `auth.uid() IS NULL` as service_role nor has matching profile). |
| `schedule_shift_is_temporally_locked` | `(p_workspace_id uuid, p_shift_date date, p_start_time time without time zone)` | Reads `schedule_shift_lock_policy` — query-only but no business reason for anon access. |
| `get_schedule_shift_lock_mode` | `(p_workspace_id uuid)` | Reads lock mode config — query-only but no business reason for anon access. |
| `is_email_verified` | `(user_uuid uuid)` | Reads `auth.users.email_confirmed_at`. Only defined in migrations, never called from TS code. |
| `assert_gate_caller` | `(p_actor_profile_id uuid)` | Gate guard helper — uses `auth.uid()` internally; anon calls raise exception due to auth check. |

---

## Section 4 — Cron / Maintenance Functions (11 revoked)

All callers verified to use `SUPABASE_SERVICE_ROLE_KEY` explicitly. Edge Functions have `verify_jwt = false` in `config.toml` but authenticate via the service role key, not the anon key. No anon HTTP caller can legitimately invoke these.

| Function | Signature | Verified caller |
|----------|-----------|-----------------|
| `cleanup_expired_api_keys` | `()` | `supabase/functions/cleanup-api-keys/index.ts` — service_role key |
| `archive_completed_engine_states` | `(p_retention_days integer)` | No TS caller found — cron/admin only |
| `archive_onboarding_workspaces` | `(p_workspace_ids uuid[])` | `apps/web/src/app/select-workspace/ArchiveOnboardingButton.tsx` (post-auth page) + uses `auth.uid()` |
| `count_dangling_company_members` | `()` | `supabase/functions/watchdog-integrity/index.ts` — service_role key |
| `count_empty_workspaces` | `()` | `supabase/functions/watchdog-integrity/index.ts` — service_role key |
| `expire_stale_invitations` | `()` | `supabase/functions/watchdog-integrity/index.ts` — service_role key |
| `fetch_pending_outbox` | `(p_batch_size integer)` | `supabase/functions/process-notifications/index.ts` — service_role key |
| `log_api_key_usage` | `(p_key_id uuid, p_endpoint text, p_status smallint)` | Called from `validate-api-key` EF via service_role key |
| `dispatch_push_notification` | `(p_event text, p_profile_id uuid, p_workspace_id uuid, p_title text, p_body text, p_data jsonb)` | Called via pg_net/push-dispatch EF — service_role bearer token |
| `dispatch_swap_notification` | `(p_workspace_id uuid, p_recipient_id uuid, p_event_key text, p_title text, p_body text, p_metadata jsonb)` | EF/trigger context only — no anon callers |
| `increment_communication_counter` | `(p_communication_id uuid, p_field text)` | `supabase/functions/sendgrid-webhook/index.ts` — service_role key |

---

## Section 5 — Authenticated-Caller Functions (25 revoked)

All call sites verified: JWT-validated Edge Functions (`auth.getUser()` passes before RPC), authenticated Next.js API routes, AI capability tools (`ctx.supabaseAdmin` = service_role), or authenticated client-side hooks requiring active session.

| Function | Signature | Verified call site | Auth mechanism |
|----------|-----------|-------------------|----------------|
| `activate_workspace_v3` | `(p_user_id uuid, p_data jsonb)` | `supabase/functions/activate-workspace/index.ts:31` | `supabaseClient.auth.getUser()` passes before RPC |
| `provision_onboarding_workspace` | `(p_user_id uuid, p_company_name text, p_intelligence_data jsonb)` | `supabase/functions/identify-company/index.ts:92` | Called via `adminClient` (service_role) only when `user != null` |
| `create_workspace_transaction` | `(uuid, text, jsonb, jsonb, jsonb)` | `supabase/functions/extract-workspace-data/index.ts:85` | `supabaseClient.auth.getUser()` + passes `user.id` |
| `create_workspace_transaction` | `(uuid, text, jsonb, jsonb, jsonb, jsonb)` | Same EF — overloaded version | Same auth mechanism |
| `finalize_onboarding_workspace` | `(p_workspace_id uuid, p_data jsonb)` | `supabase/functions/finalize-workspace/index.ts:44` | `auth.getUser()` required; RPC via `adminClient` |
| `approve_shift_swap` | `(p_swap_id uuid, p_approved boolean, p_reason text)` | `apps/web/src/app/api/shift-swap/` | `resolveShiftSwapAuth()` — 401 if no auth |
| `cancel_shift_swap` | `(p_swap_id uuid)` | `apps/web/src/app/api/shift-swap/cancel/route.ts` | Same auth middleware |
| `initiate_shift_swap` | `(p_requester_shift_id uuid, p_target_profile_id uuid, p_target_shift_id uuid, p_reason text)` | `apps/web/src/app/api/shift-swap/initiate/route.ts` | Same auth middleware |
| `respond_to_shift_swap` | `(p_swap_id uuid, p_accepted boolean, p_reason text)` | `apps/web/src/app/api/shift-swap/respond/route.ts` + AI capability | Auth route + `supabase.rpc` in capability |
| `append_conversation_turn` | `(p_session_id uuid, p_turn jsonb)` | `services/stage-engine/src/core/agent-session.ts:91` | `supabaseAdmin` (service_role) explicitly imported |
| `check_assignment_completion_fn_direct` | `(p_assignment_id uuid)` | `packages/ai/src/capabilities/contract-intake/tools.ts` | `ctx.supabaseAdmin` — service_role |
| `check_contract_intake_completion` | `(p_profile_id uuid, p_workspace_id uuid)` | `packages/ai/src/capabilities/contract-intake/tools.ts:241` | `ctx.supabaseAdmin` — service_role |
| `decline_contract_intake` | `(p_profile_id uuid, p_workspace_id uuid, p_reason text)` | `packages/ai/src/capabilities/contract-intake/tools.ts:347` | `ctx.supabaseAdmin` — service_role |
| `create_channel` | `(p_workspace_id uuid, p_channel_type public.comm_channel_type, p_name text, p_created_by uuid, p_member_profile_ids uuid[])` | Web dashboard hooks + mobile (authenticated session required) | Client-side: session cookie / JWT |
| `create_dm_conversation` | `(p_workspace_id uuid, p_creator_profile_id uuid, p_target_profile_id uuid, p_name text)` | Dashboard + mobile | Uses `auth.uid()` internally — anon call fails |
| `get_channel_messages` | `(p_channel_id uuid, p_cursor timestamp with time zone, p_limit integer)` | Mobile hooks + web `komm/_hooks` | Authenticated session required at call site |
| `get_my_channels` | `(p_workspace_id uuid)` | Mobile + web `komm/_hooks` | Uses `auth.uid()` — returns empty for anon |
| `get_unread_counts` | `(p_workspace_id uuid)` | Web `komm/_hooks/use-unread-counts.ts:18` | Uses `auth.uid()` — returns empty for anon |
| `get_invoice_basis` | `(p_invoice_id uuid)` | Platform-admin billing + `packages/billing` + AI capability | All admin/service_role contexts |
| `snapshot_shift_cost` | `(p_interpretation_id uuid)` | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:534` | Authenticated supabase client in capability |
| `derive_shift_hours` | `(p_shift_id uuid)` | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:431` | Authenticated supabase client in capability |
| `get_workspace_readiness` | `(p_workspace_id uuid)` | AI capability + `packages/utils/src/people/fetch-people.ts` | `ctx.supabaseAdmin` + auth utility |
| `handle_schedule_shift_lock_violation` | `(uuid, uuid, text, text, date, time, jsonb, jsonb)` | Shift lock trigger context | DB trigger / service_role |
| `record_schedule_shift_lock_audit` | `(uuid, uuid, text, text, text, boolean, boolean, date, time, jsonb, jsonb)` | Shift lock audit trail | DB trigger / service_role |
| `record_schedule_shift_lock_audit` | `(uuid, uuid, text, text, text, boolean, date, time, jsonb, jsonb)` | Overloaded version — same context | DB trigger / service_role |

---

## Section 6 — NEEDS-REVIEW (1 — NOT revoked)

These functions have confirmed anon call paths that are legitimately needed for unauthenticated user flows. DO NOT revoke without re-architecting the call site first.

### `public.get_invitation_by_token(p_token uuid)`

**Confirmed anon call sites:**

1. `apps/web/src/app/invite/[token]/page.tsx:100` — Server component. Reads invite details to render the invite acceptance page. The visitor has no auth session yet — they are following a link from email.
2. `apps/web/src/app/signup/page.tsx:139` — Client component. Reads invite metadata before calling `auth.signUp()` or `auth.signInWithOtp()`. The user is unauthenticated at this point.

**Why it matters:** The invitation flow is a core onboarding path. Users receive an email link, visit the page unauthenticated, and the page needs to show them the invite details (who invited them, workspace name, role) before they create their account.

**What the function returns:** Invitation metadata only — `first_name`, `last_name`, `email`, `role`, `expires_at`, `workspace_name`. It does NOT write any data. The risk is information disclosure of invite contents via token brute-force (mitigated by UUID token space = 2^122 possibilities, but not eliminated).

**Risk assessment:** MEDIUM. A brute-force attack against the token space is computationally infeasible, but the function is still callable without any rate-limiting at the DB layer. The primary concern is that this exposes the function to the public API surface unnecessarily.

**Required before revoking:**

1. **ADR decision:** Choose alternative mechanism:
   - Option A: Move the lookup to a dedicated Edge Function with rate-limiting (recommended). The EF validates the token, returns invite metadata, and the DB function is never exposed directly to anon.
   - Option B: Use a signed JWT in the invitation URL (short-lived). The server validates the JWT and never calls the DB function from anon context.
   - Option C: Keep as-is but add a DB-level rate limit via `pg_cron` + request counter table.

2. **Update call sites:** Both `invite/[token]/page.tsx` and `signup/page.tsx` must use the new mechanism.

3. **Migration:** Add `REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) FROM anon; GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO authenticated;` as a separate migration after the call sites are updated.

---

## Notes

- This migration is idempotent — `REVOKE` on an already-revoked privilege is a no-op in PostgreSQL.
- The verification query in the migration footer can be run post-apply to confirm all 88 functions show `anon_can_execute = false`.
- `get_invitation_by_token` will still show `anon_can_execute = true` after this migration — that is expected and tracked.
- ADR to formalize the `get_invitation_by_token` remediation path should be written before the next security hardening pass.

If any NEEDS-REVIEW function should also be revoked, propose ADR + design alternative authentication path before adding to a future migration.
