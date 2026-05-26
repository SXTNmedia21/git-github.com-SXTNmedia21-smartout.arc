// scripts/live-invoke/agent-harness.mjs
// Live-invoke smoke for the agent-harness domain (ADR-0327).
//
// What this catches (L-0348 family — promoted to systemic rule 2026-05-25):
//   - Column drift on engine_process (9 cols), engine_state (23 cols),
//     engine_state_step (12 cols), engine_event (6 cols),
//     engine_memory (14 cols), engine_authority_config (9 cols),
//     engine_sessions (21 cols — stage-engine session layer)
//   - RPC existence drift on gate_action (ADR-0099, 38 call-sites via gatedMutation)
//     and engine_world_observe_platform (stage-engine world-writer)
//   - PGRST201/202 ambiguous embed — column lists derived strictly from
//     packages/supabase/src/database.types.ts Row shapes (NEVER from migration SQL)
//
// Design choices:
//   - service role caller → auth.uid() = null → RLS sees empty → all selects
//     return [] when seeded data absent. That is the correct smoke: signature
//     proven, no SQL error, columns intact.
//   - gate_action and engine_world_observe_platform are write-path RPCs that
//     require real UUIDs. Passing nil UUIDs produces PGRST/DB errors — we
//     accept any error EXCEPT 42883 (function not found). 42883 = not deployed.
//   - engine_state_step has no workspace_id column (per database.types.ts Row) —
//     do NOT add it (would be instant PGRST116 column-not-found regression).
//
// Capabilities covered:
//   - HarnessAdapter + CapabilitiesSource + AuthorityEnforcer (ADR-0327)
//   - gatedMutation → gate_action RPC (ADR-0204 §1, ADR-0099)
//   - agent-router intent-gate (services/stage-engine/src/core/agent-router.ts)
//   - memory-manager reads (services/stage-engine/src/core/memory-manager.ts)
//   - authority reads (services/stage-engine/src/core/authority.ts)
//   - engine-world-writer fire-and-forget (services/stage-engine/src/core/engine-world-writer.ts)
//   - engine_sessions stage management (services/stage-engine/src/core/stage-manager.ts)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/agent-harness.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("agent-harness");

// ── 1. engine_process — blueprint registry (D6 Production) ───────────────────
// 9 cols per database.types.ts Row. engine_process.id is PK (NOT a UUID
// auto-generated — it's a caller-supplied text identifier per Insert shape).
// workspace_id is nullable (platform-level processes have NULL workspace_id).
// Source: packages/supabase/src/database.types.ts line 9207.
const processes = await sb
  .from("engine_process")
  .select(
    "id, name, description, is_active, max_steps, allowed_channels, " +
    "workspace_id, created_at, updated_at",
  )
  .limit(5);
assertOk("select engine_process (9 cols)", processes);
assertShape("engine_process column shape", processes.data, [
  "id",
  "name",
  "is_active",
  "max_steps",
  "allowed_channels",
  "created_at",
  "updated_at",
]);

// ── 2. engine_state — live workflow instance ──────────────────────────────────
// 23 cols per database.types.ts Row. id is UUID PK.
// dispatch_lock_id, steps_snapshot, result are nullable JSONB.
// workspace_id nullable (platform processes). entity_id / entity_type
// are the cascade target reference (D6 Production context).
// Source: packages/supabase/src/database.types.ts line 9440.
const states = await sb
  .from("engine_state")
  .select(
    "id, process_id, status, current_step, depth, retry_count, " +
    "context, result, steps_snapshot, started_at, completed_at, " +
    "scheduled_for, recurrence, entity_id, entity_type, " +
    "mission_id, assignee_id, parent_state_id, trigger_id, " +
    "dispatch_lock_id, last_error, workspace_id, updated_at",
  )
  .limit(5);
assertOk("select engine_state (23 cols)", states);
assertShape("engine_state column shape", states.data, [
  "id",
  "process_id",
  "status",
  "current_step",
  "depth",
  "retry_count",
  "context",
  "started_at",
  "updated_at",
]);

// ── 3. engine_state_step — per-step tracking ─────────────────────────────────
// 12 cols per database.types.ts Row. id is UUID PK. state_id FK → engine_state.
// NOTE: engine_state_step has NO workspace_id column — adding it would be
// an instant PGRST116 regression. Source: database.types.ts line 9623.
const steps = await sb
  .from("engine_state_step")
  .select(
    "id, state_id, step_order, action_type, action_payload, " +
    "assignee_rule, condition, status, result, " +
    "completed_at, completed_by, created_at, updated_at",
  )
  .limit(5);
assertOk("select engine_state_step (13 cols, NO workspace_id)", steps);
assertShape("engine_state_step column shape", steps.data, [
  "id",
  "state_id",
  "step_order",
  "action_type",
  "action_payload",
  "status",
  "created_at",
  "updated_at",
]);

// ── 4. engine_event — domain event bus ───────────────────────────────────────
// 6 cols per database.types.ts Row. id is UUID PK. workspace_id nullable.
// Used by: sixten-orchestrator (writes LOG + NUDGE events), stage-engine
// workers, and telemetry emit() destinations. Source: database.types.ts line 8956.
const events = await sb
  .from("engine_event")
  .select(
    "id, event_type, payload, fired_at, idempotency_key, workspace_id",
  )
  .limit(5);
assertOk("select engine_event (6 cols)", events);
assertShape("engine_event column shape", events.data, [
  "id",
  "event_type",
  "payload",
  "fired_at",
  "workspace_id",
]);

// ── 5. engine_memory — agent long-term memory ────────────────────────────────
// 14 cols per database.types.ts Row. id is UUID PK. embedding nullable (pgvector).
// memory-manager.ts reads: id, memory_type, content, created_at.
// agent_profile_id nullable FK → agent_profile (future multi-persona support).
// source_session_id nullable FK → engine_sessions.
// Source: database.types.ts line 9056.
const memories = await sb
  .from("engine_memory")
  .select(
    "id, profile_id, workspace_id, memory_type, scope, content, " +
    "importance, sensitivity, embedding, expires_at, " +
    "agent_profile_id, source_session_id, created_at, updated_at",
  )
  .limit(5);
assertOk("select engine_memory (14 cols)", memories);
assertShape("engine_memory column shape", memories.data, [
  "id",
  "profile_id",
  "workspace_id",
  "memory_type",
  "content",
  "importance",
  "created_at",
  "updated_at",
]);

// ── 6. engine_authority_config — C4 governance config per capability ──────────
// 9 cols per database.types.ts Row. id is UUID PK. workspace_id required (not null).
// authority.ts reads: capability, level, min_role — smoke all 9 to catch drift.
// updated_by nullable FK → user_identity.
// Source: database.types.ts line 8776.
const authorityConfigs = await sb
  .from("engine_authority_config")
  .select(
    "id, workspace_id, capability, level, min_role, " +
    "requires_four_eyes, observer_escalation_hours, " +
    "updated_by, created_at, updated_at",
  )
  .limit(5);
assertOk("select engine_authority_config (10 cols)", authorityConfigs);
assertShape("engine_authority_config column shape", authorityConfigs.data, [
  "id",
  "workspace_id",
  "capability",
  "level",
  "min_role",
  "requires_four_eyes",
  "observer_escalation_hours",
  "created_at",
  "updated_at",
]);

// ── 7. engine_sessions — stage-engine conversation session layer ──────────────
// 21 cols per database.types.ts Row. id is UUID PK. workspace_id nullable.
// Used by stage-manager.ts, guardian-evaluator.ts, guardian-bus.ts, memory-manager.ts.
// Note: engine_sessions is the CONVERSATION session layer (stage-engine BFF).
//       engine_state is the WORKFLOW state (cascade Event Engine).
//       Do NOT conflate these two. Source: database.types.ts line 9258.
const sessions = await sb
  .from("engine_sessions")
  .select(
    "id, workspace_id, profile_id, user_id, channel, mode, status, " +
    "stage_index, stage_started_at, current_stage_id, " +
    "journey_id, mission_id, context, collected_data, summary, " +
    "guardian_whisper_count, is_archived, callback_url, " +
    "expires_at, completed_at, created_at, updated_at",
  )
  .limit(5);
assertOk("select engine_sessions (22 cols)", sessions);
assertShape("engine_sessions column shape", sessions.data, [
  "id",
  "workspace_id",
  "profile_id",
  "channel",
  "mode",
  "status",
  "stage_index",
  "is_archived",
  "created_at",
  "updated_at",
]);

// ── 8. gate_action RPC — existence check (ADR-0099, 38 gatedMutation call-sites) ─
// gate_action requires valid UUIDs for actor + workspace. Passing nil UUIDs
// returns a DB error (not 42883). We accept any error EXCEPT 42883 (not found).
// 42883 = function never deployed — production gap.
// Args per database.types.ts line 22838: p_action_type, p_actor_profile_id,
// p_capability, p_channel, p_workspace_id + optionals.
const gateResult = await sb.rpc("gate_action", {
  p_action_type: "read",
  p_actor_profile_id: "00000000-0000-0000-0000-000000000000",
  p_capability: "task",
  p_channel: "chat",
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (gateResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc gate_action — FUNCTION NOT FOUND (42883): ${gateResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc gate_action — function deployed (nil UUID result: ${gateResult.error?.code ?? "no error"})`,
  );
}

// ── 9. engine_world_observe_platform RPC — existence check ────────────────────
// Fire-and-forget RPC per engine-world-writer.ts (F7 void pattern). Requires
// valid surface_type and status enum values + surface_id. Passing valid enum
// values but a dummy surface_id should either succeed (no-op) or return a
// non-42883 DB error. Any outcome != 42883 = function deployed.
// Args per database.types.ts line 22629.
const worldObserveResult = await sb.rpc("engine_world_observe_platform", {
  p_surface_id: "smoke-probe-agent-harness",
  p_surface_type: "chat",
  p_status: "active",
});
if (worldObserveResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc engine_world_observe_platform — FUNCTION NOT FOUND (42883): ${worldObserveResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc engine_world_observe_platform — function deployed (${worldObserveResult.error?.code ?? "no error"})`,
  );
}

result();
