-- ============================================
-- 20260528100400_payroll_period_locked_notifier_process.sql
-- Payroll MVP Day-3 — payroll.period_locked notification subscriber
-- ============================================
--
-- AUTHORITY TRAIL:
--   ADR-0303 — `notify_each_profile` dispatcher action_type. NEW dispatcher
--               case that iterates step.action_payload.recipient_ids[] (or
--               falls back to state.context.data.affected_profile_ids) and
--               INSERTs one notification_outbox row per recipient. Mirrors
--               ADR-0236 update_context_targeted sibling-action-type
--               precedent. Migration-only addition to subscriber pipeline;
--               dispatcher case + GATED_MUTATION_TYPES membership shipped in
--               the same Day-3 sortie commit.
--   ADR-0235 — process pattern: separate transient subscriber engine_process
--               (NOT cross-state extension). Direct Edge Function invoke and
--               emit-site loops both rejected as Trust-Gate-FAIL classes.
--   ADR-0186 — engine_event fanout: registry.ts:11183 routes
--               payroll.period_locked → engine_event destination. This
--               migration adds the engine_trigger row that activates the
--               subscriber on every engine_event INSERT matching the event
--               type.
--   ADR-0163 — channel restriction: payroll data is High-PII per ADR-0078.
--               Process surface allowed_channels=['chat']; send_notification
--               step's allowed_channels=['push','in_app'] (DELIVERY channels,
--               distinct from process activation channel). Notification body
--               is empty + action_url to /dashboard/my-salary — the actual
--               wage-basis data only reveals after authenticated page load.
--   ADR-0099 — unified authority gate: subscriber rides existing
--               engine_authority_config seed at 20260527100100 (capability =
--               'payroll'). NO new authority seed migration required because
--               this subscriber declares capability = 'payroll' on the
--               process row. Council 2026-05-12 verified existing seed
--               covers the new subscriber + dispatcher case is gated via
--               GATED_MUTATION_TYPES membership.
--   ADR-0287 — gate_action mandatory: `notify_each_profile` added to the
--               GATED_MUTATION_TYPES set at engine-dispatch/index.ts:644-655
--               in the same Day-3 commit.
--   ADR-0161 — entity flatten LIVE: engine-event.ts:57-63 promotes
--               entity.entity_type/entity_id to payload root. The subscriber
--               spawn flow at engine-dispatch/index.ts:345-361 copies
--               payload.entity_type → engine_state.entity_type AND
--               payload.entity_id → engine_state.entity_id. The remaining
--               payload (including data.affected_profile_ids) lands in
--               state.context.data.* via the {...domainPayload} spread.
--
-- PRECEDENT MIGRATION:
--   supabase/migrations/20260518240100_helpdesk_sla_breach_handler_process.sql
--   — byte-for-byte structural mirror (engine_process + engine_step delete+insert + engine_trigger).
--
-- PAYLOAD CONTRACT (verified against canonical emit-site
-- apps/web/src/app/api/payroll/lock-period/route.ts:163-184 + registry
-- interface at packages/telemetry/src/registry.ts:8339-8360):
--   event_type: 'payroll.period_locked'
--   properties.entity.entity_type: 'payroll_period' (flattened to payload.entity_type)
--   properties.entity.entity_id: <period_id uuid> (flattened to payload.entity_id)
--   properties.data.period_id: <uuid>
--   properties.data.period_start: <ISO date>
--   properties.data.period_end: <ISO date>
--   properties.data.profiles_count: <int>
--   properties.data.total_lines: <int>
--   properties.data.affected_profile_ids: string[]  ← REQUIRED FOR FAN-OUT
--   properties.data.locked_by_profile_id: <uuid>
--   properties.data.gate_evaluation_id: <uuid|null>
--
-- DUAL-EMIT RESOLUTION (L-0237, F-CT-01 5th occurrence):
--   The capability tool at packages/ai/src/capabilities/payroll/tools.ts:901
--   previously emitted the same event with HARDCODED zeros for profiles_count
--   and total_lines. Day-3 Amendment 2 retired the capability-tool emit. The
--   BFF route is now the single canonical emit-site. Agent-invocation of
--   lock_period capability tool no longer triggers this subscriber; the
--   UI-driven lock path is canonical. If agent-lock-period becomes a frequent
--   surface, escalate to Option β (tool body invokes BFF route via internal
--   HTTP) in a successor sortie.
--
-- IDEMPOTENCY:
--   - engine_process: ON CONFLICT (id) DO NOTHING.
--   - engine_step: DELETE + re-insert (matches dispatcher fix + helpdesk SLA pattern).
--   - engine_trigger: existence-guard SELECT before INSERT (matches contract-events pattern).
--   - notification_outbox idempotency at dispatch time: dispatcher case writes
--     metadata.idempotency_key = `<template>.<entity_id>.<recipient_id>` per row.
--     Smoke test verifies no duplicate rows on re-lock by inspecting this key.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Engine process blueprint (global, workspace_id NULL) ──────────────────
-- Per helpdesk SLA precedent: engine_process.id is a TEXT slug. workspace_id
-- NULL = global process. One row services all workspaces.

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
  'payroll_period_locked_notifier',
  'Payroll Period Locked Notifier',
  'Transient subscriber for payroll.period_locked event. Fans out push+in_app notifications to all affected profiles via notify_each_profile dispatcher action. ADR-0303.',
  NULL,
  ARRAY['chat'],
  true,
  10
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Steps — delete + re-insert for idempotency ───────────────────────────

DELETE FROM engine_step WHERE process_id = 'payroll_period_locked_notifier';

INSERT INTO engine_step (
  process_id,
  step_order,
  action_type,
  action_payload,
  assignee_rule
)
VALUES
  -- Step 1: wait for payroll.period_locked event.
  -- Spawn step always = step 1 per L-0160. Resume loop matches
  -- stepPayload?.event_type ?? stepPayload?.event (dual-key fallback added
  -- post-L-0160; either key works). We use 'event' for consistency with
  -- daily_close + workspace_setup precedents.
  (
    'payroll_period_locked_notifier',
    1,
    'wait_for_event',
    jsonb_build_object(
      'event', 'payroll.period_locked',
      'description', 'Trigger spawn always at step 1 per L-0160. Wait-state never reached in practice — engine_trigger row below spawns engine_state directly from the engine_event INSERT.'
    ),
    NULL
  ),
  -- Step 2: notify_each_profile fan-out.
  -- The dispatcher case at engine-dispatch/index.ts falls back to
  -- state.context.data.affected_profile_ids when action_payload.recipient_ids
  -- is absent. We do NOT set recipient_ids here — the canonical path is via
  -- spawn flow which copies the engine_event payload into state.context.
  --
  -- template: notification title (dispatcher reads this as title per
  -- send_notification convention).
  --
  -- payload.action_url: deep link to my-salary view scoped by period_id.
  -- The dispatcher merges this into notification_outbox.metadata so the
  -- delivery layer can use it for navigation on tap.
  --
  -- ADR-0163: process allowed_channels=['chat']; delivery
  -- allowed_channels=['push', 'in_app'] hardcoded in the dispatcher case
  -- (NOT a configurable here). Voice excluded per ADR-0078.
  (
    'payroll_period_locked_notifier',
    2,
    'notify_each_profile',
    jsonb_build_object(
      'template', 'Lønnsgrunnlag klart',
      'payload', jsonb_build_object(
        'action_url', '/dashboard/my-salary',
        'event_name', 'payroll.period_locked',
        'note', 'period_id is in state.context.data.period_id. Mobile/web delivery layer should append ?period=<period_id> to action_url on tap, derived from metadata.period_id at render time.'
      ),
      'note', 'ADR-0303 fan-out. recipient_ids resolved from state.context.data.affected_profile_ids (canonical) or context.data.recipient_ids (alternate). action_payload.recipient_ids static override possible for tests. ADR-0163 voice excluded.'
    ),
    NULL
  );

-- ── 3. Engine trigger row — listen on payroll.period_locked engine_event ─────
-- workspace_id NULL = trigger fires for any workspace's event (matches the
-- global process). The dispatcher resolves the spawned engine_state.workspace_id
-- from the engine_event row's workspace_id.

INSERT INTO public.engine_trigger (event_type, process_id, is_active, workspace_id)
SELECT 'payroll.period_locked', 'payroll_period_locked_notifier', true, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_trigger
  WHERE event_type = 'payroll.period_locked'
    AND process_id = 'payroll_period_locked_notifier'
);

COMMENT ON TABLE engine_process IS
  'Process blueprints. payroll_period_locked_notifier added 2026-05-12 (ADR-0303): subscriber for payroll.period_locked event — fans out push+in_app notifications via notify_each_profile dispatcher action. Mirrors helpdesk_sla_breach_handler pattern (ADR-0235).';
