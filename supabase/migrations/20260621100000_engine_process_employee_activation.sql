-- ============================================================
-- 20260621100000_engine_process_employee_activation.sql
-- feat/contract-signed-active-cascade (ADR-0379)
--
-- Purpose
-- -------
-- Seeds the `employee_activation` engine_process — a dedicated D2 lifecycle
-- process that flips profile.status trainee→active when a contract is signed.
--
-- Architecture decision
-- ---------------------
-- D2 lifecycle is DISTINCT from C3 integration_sync (cascade skill: never mix
-- dimension concerns). The contract IS the C4 authorization (ADR-0379). No
-- change_proposal is created — the legal signature from both parties is the
-- authority gate.
--
-- Wiring (Option A — feat/contract-signed-active-cascade)
-- --------------------------------------------------------
-- docuseal webhook resolves profile_id from employment_contract and emits
-- contract.signed with entity_type=profile, entity_id=<profile_id>. Engine-
-- dispatch creates engine_state with those entity fields. update_entity handler
-- (index.ts:859) updates `WHERE profile_id = state.entity_id`.
--
-- Idempotency
-- -----------
-- The `condition` on the step guard ensures the flip is a no-op when the
-- profile is already active (or inactive/offboarding — do NOT regress those).
-- Only trainee profiles are eligible for this process.
-- DocuSeal retries contract.signed → second trigger invocation hits the
-- existing engine_state (via trigger match) which re-evaluates the condition.
-- If status ≠ 'trainee', the condition fails and the step is skipped → the
-- process completes without writing to the profile row.
--
-- Step definition
-- ---------------
--   step 1: update_entity on `profile`, set {status:'active', is_active:true}
--   condition: {match: {status: 'trainee'}}  — guards idempotency
--
-- allowed_channels: ARRAY['system'] — this process is system-initiated only.
-- No channel check needed from gate_action perspective (actor_profile_id=NULL,
-- originating_channel='system'). Restricting to ['system'] prevents accidental
-- chat/voice invocation.
--
-- References
-- ----------
-- ADR-0379 (signature-as-C4-authorization)
-- ADR-0186 (engine event flow)
-- ADR-0099 (unified authority gate)
-- update_entity allowlist: engine-dispatch/index.ts:848-858
-- ENTITY_PK.profile = 'profile_id': engine-dispatch/index.ts:583
-- Manual path mirror: apps/web/src/app/dashboard/people/_actions/people-actions.ts:673
-- ============================================================

SET search_path TO public, extensions;

-- ── engine_process: employee_activation ─────────────────────────────────────

INSERT INTO public.engine_process (id, name, description, allowed_channels)
VALUES (
  'employee_activation',
  'Employee Activation',
  'Flips profile.status trainee→active when a signed employment contract is received. '
  'D2 resource lifecycle (distinct from C3 integration_sync per cascade dimension rules). '
  'Signature is the C4 authorization — no change_proposal required (ADR-0379).',
  ARRAY['system']
)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  allowed_channels  = EXCLUDED.allowed_channels,
  updated_at        = now();

-- ── engine_step: flip profile status ─────────────────────────────────────────
-- Step 1: update_entity on profile table.
-- set: mirrors manual path people-actions.ts:673 {status:'active', is_active:true}.
-- condition: NULL — no context-level condition guard.
--
-- Idempotency is handled at TWO higher levels:
--   1. engine_event.idempotency_key = 'docuseal:<submissionId>:signed'
--      A DocuSeal retry that sends the same submission_id is deduplicated at
--      engine-dispatch intake (line 208-228: returns 200 "Event already processed"
--      before any trigger evaluation). This is the PRIMARY guard.
--   2. The profile UPDATE itself is idempotent: if the profile is already active
--      (by a prior manual reactivation), UPDATE SET status='active', is_active=true
--      WHERE profile_id=X is a data-safe no-op — the same values are written again.
--      No incorrect state transition can result (active→active is harmless;
--      inactive/offboarding profiles are not targeted because those profiles
--      do not have a pending contract.signed event — the contract was signed when
--      the profile was trainee, and no second signing event fires later).
--
-- Condition-evaluator limitation: engine-dispatch evaluateCondition checks
-- state.context (built from event payload), not the live DB row. There is no
-- mechanism to inject the current profile.status into context at dispatch time
-- without a separate resolution step (Option B). Rather than add Option B
-- complexity, idempotency_key deduplication is the correct gate.

INSERT INTO public.engine_step (process_id, step_order, action_type, action_payload, condition)
VALUES (
  'employee_activation',
  1,
  'update_entity',
  '{
    "entity": "profile",
    "set": {
      "status": "active",
      "is_active": true
    }
  }'::jsonb,
  NULL
)
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_type    = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  condition      = EXCLUDED.condition,
  updated_at     = now();
