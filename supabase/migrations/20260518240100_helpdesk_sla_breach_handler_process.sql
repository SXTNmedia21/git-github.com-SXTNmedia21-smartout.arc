-- ============================================
-- 20260429100000_helpdesk_sla_breach_handler_process.sql
-- Helpdesk Phase 2 — SLA breach-handler process blueprint
-- ============================================
--
-- AUTHORITY TRAIL:
--   ADR-0231 — process pattern: separate transient breach-handler avoids the
--               lifecycle-step sibling-invisibility bug (dispatcher only resumes
--               the current step; sibling wait_for_event steps are invisible).
--   ADR-0232 — update_context_targeted action_type: cross-state context patching
--               with workspace-integrity guard. This migration seeds the blueprint
--               reference. The DISPATCHER HANDLER for this action_type is added
--               by T8d. Migration is safe to apply before T8d lands — the step row
--               exists but will block (status=blocked, last_error set) if fired
--               before the handler is present. That is preferable to a silent no-op.
--   ADR-0163 — channel restriction: helpdesk queries carry PII.
--               allowed_channels=['chat'] on process; send_notification step is
--               explicitly ['push','in_app'] — no voice.
--   ADR-0229 — observer proxy chain: recipient resolution walks
--               responsible_profile_id → team.leader_profile_id → broadcast.
--               Runtime resolution happens in T9 capability work (openTicket
--               forwards observer_profile_id in the breach event payload as
--               assignee_id so the dispatcher sets engine_state.assignee_id at
--               spawn). This migration cannot resolve the observer — it seeds the
--               static blueprint only.
--   L-0160   — why a separate handler instead of lifecycle steps: the dispatcher
--               step-resume loop is current-step-only. Lifecycle step 2 waits for
--               helpdesk.query.resolved; it never sees the breach event. A second
--               process is the only correct consumer path.
--
-- ── PROCESS SCOPE NOTE ─────────────────────────────────────────────────────────
-- engine_process.id is TEXT (human-readable slug). engine_process.workspace_id is
-- nullable (NULL = global). ADR-0231 says "per-workspace seed" but engine_process
-- PK is a single slug — one row per workspace would require composite slugs
-- ('helpdesk_sla_breach_handler_<uuid>') which breaks the engine_trigger
-- process_id reference and the dispatcher's process lookup by name.
--
-- DECISION: global process (workspace_id NULL), same as helpdesk_query_lifecycle.
-- "Per-workspace" in ADR-0231 refers to the authority seed pattern (see
-- 20260515130300); this process follows the lifecycle seed pattern (single global
-- row). Deviation from task literal but matches the actual schema constraint and
-- existing convention. Both produce identical runtime behaviour for workspaces.
-- ──────────────────────────────────────────────────────────────────────────────
--
-- ── STEP 1: update_context_targeted ────────────────────────────────────────────
-- action_type: 'update_context_targeted' (ADR-0232).
-- Patches the ORIGIN ticket's engine_state.context.sla_breached_at.
--
-- target_state_id resolution (ADR-0232 §"Resolution"):
--   The handler reads target_state_id first from action_payload, then from
--   executing state's context.target_state_id. This blueprint does NOT hard-code
--   target_state_id in action_payload (it varies per breach event). Instead,
--   T9 capability work (openTicket tool) must forward the origin engine_state.id
--   in the breach event payload under key 'engine_state_id'. The dispatcher spawn
--   flow (engine-dispatch/index.ts:351) copies event payload fields into the new
--   engine_state.context — so context.target_state_id will be set at fire time
--   from the breach event's engine_state_id field. Wait: the dispatcher copies the
--   payload into context verbatim. The handler reads context.target_state_id. So
--   the tool must emit the breach event with payload key 'target_state_id'
--   (not 'engine_state_id') to land correctly in context. T9 must use that key.
--   Document this constraint for the T9 capability author.
--
-- __now__ sentinel:
--   The dispatcher's update_context_targeted handler (T8d) is expected to support
--   the '__now__' sentinel by substituting new Date().toISOString() at execute
--   time. If T8d does not implement this sentinel, sla_breached_at will be set to
--   the string literal '__now__', which is wrong. T8d author must handle this.
--   Alternative: T9 capability tool can set sla_breached_at in the event payload
--   and forward it as a context field, then the step reads it from context instead
--   of using __now__. That approach avoids the sentinel entirely and is safer.
--   This migration uses __now__ per ADR-0231; if T8d skips sentinel support,
--   switch to the payload-forward approach in a successor migration.
--
-- ── STEP 2: send_notification ──────────────────────────────────────────────────
-- recipient_id resolution:
--   The dispatcher handler (engine-dispatch/index.ts:749) resolves recipient as:
--     targetRecipient = action_payload.recipient_id ?? state.assignee_id
--   This blueprint sets recipient_id=null in action_payload. The breach-handler
--   engine_state.assignee_id must therefore carry the observer profile id at
--   spawn time. T9 (openTicket tool) must include 'assignee_id' (observer profile
--   id) in the breach event payload — the dispatcher spawn flow at line 351
--   copies payload.assignee_id into engine_state.assignee_id. If the event
--   payload omits assignee_id, state.assignee_id will be NULL and the
--   send_notification step will silently skip the insert (line 752 guard:
--   `if (targetRecipient && targetWorkspace)`). The notification will be lost
--   without error. T9 MUST include assignee_id in the breach event payload.
--
-- send_notification action_payload keys (verified against dispatcher line 742):
--   The dispatcher reads 'template' (used as notification title), 'recipient_id',
--   'workspace_id', and 'payload'. It does NOT read 'title' or 'body' from
--   action_payload — 'body' is hardcoded "" in the dispatcher. The 'template'
--   field is used as the notification title in the outbox insert. The additional
--   'title' and 'body' keys in this blueprint are stored in action_payload.payload
--   for future dispatcher versions that may support richer schema; they are
--   currently forwarded into notification_outbox.metadata via the spread.
-- ──────────────────────────────────────────────────────────────────────────────
--
-- IDEMPOTENCY: ON CONFLICT DO NOTHING on process; DELETE + re-insert on steps
-- (same pattern as 20260518230000 dispatcher fix). Safe to re-apply.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Engine process blueprint (global, workspace_id NULL) ──────────────────

INSERT INTO engine_process (
  id,
  name,
  description,
  workspace_id,
  allowed_channels,
  is_active,
  max_steps
)
VALUES (
  'helpdesk_sla_breach_handler',
  'Helpdesk SLA Breach Handler',
  'Transient handler for helpdesk SLA breach. Patches origin ticket context + notifies observer. ADR-0231.',
  NULL,
  ARRAY['chat'],
  true,
  10
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Steps — delete + re-insert for idempotency (matches dispatcher fix pattern) ──

DELETE FROM engine_step WHERE process_id = 'helpdesk_sla_breach_handler';

INSERT INTO engine_step (
  process_id,
  step_order,
  action_type,
  action_payload,
  assignee_rule
)
VALUES
  -- Step 1: patch origin ticket's context.sla_breached_at
  -- Depends on T8d landing update_context_targeted handler in dispatcher.
  -- target_state_id is NOT in action_payload here — it is resolved at runtime
  -- from state.context.target_state_id, which T9's openTicket tool must forward
  -- in the breach event payload under key 'target_state_id'.
  (
    'helpdesk_sla_breach_handler',
    1,
    'update_context_targeted',
    jsonb_build_object(
      'set', jsonb_build_object(
        'sla_breached_at', '__now__'
      ),
      'note', 'ADR-0232: patches origin ticket engine_state.context.sla_breached_at. target_state_id resolved from state.context.target_state_id (forwarded by T9 openTicket breach event payload). __now__ sentinel requires T8d handler support — if unsupported, T9 must forward timestamp in event payload instead.'
    ),
    NULL
  ),
  -- Step 2: notify the observer (responsible party / escalation target)
  -- recipient_id=null → dispatcher falls back to state.assignee_id.
  -- T9 openTicket MUST include assignee_id (observer profile id) in breach event
  -- payload so dispatcher sets engine_state.assignee_id at spawn. Without it the
  -- notification silently no-ops (dispatcher line 752 guard).
  -- Dispatcher reads 'template' as notification title. 'title'+'body' are
  -- forwarded into metadata.payload for future dispatcher versions.
  (
    'helpdesk_sla_breach_handler',
    2,
    'send_notification',
    jsonb_build_object(
      'template', 'Helpdesk-henvendelse forfalt',
      'recipient_id', null,
      'allowed_channels', ARRAY['push', 'in_app'],
      'payload', jsonb_build_object(
        'title', 'Helpdesk-henvendelse forfalt',
        'body', 'En henvendelse har gått over fristen og krever oppmerksomhet.'
      ),
      'note', 'ADR-0163: no voice. recipient resolved via state.assignee_id (set at spawn from breach event payload.assignee_id by T9). ADR-0229 observer proxy chain runs in T9 at openTicket time.'
    ),
    NULL
  );

COMMENT ON TABLE engine_process IS
  'Process blueprints. helpdesk_sla_breach_handler added 2026-04-29 (ADR-0231): transient handler for SLA breach, distinct from helpdesk_query_lifecycle to avoid dispatcher sibling-step invisibility bug (L-0160).';
