// scripts/live-invoke/botsson.mjs
// Live-invoke smoke for the botsson domain (ADR-0206 v2 Persona Surface).
//
// What this catches (L-0348 family — promoted to systemic rule 2026-05-25):
//   - Column drift on agent_profile (19 cols) — Botsson's persona/soul config
//   - Column drift on agent_session_recording (16 cols) — Phase D session recorder
//   - Column drift on engine_missions (11 cols) — 7-mission registry read by session-manager
//   - Column drift on engine_stages (17 cols, NO workspace_id) — stage planner
//   - RPC existence for bootstrap_botsson_channel (ADR-0206 onboarding bootstrap)
//
// Design choices:
//   - service role caller → auth.uid() = null → RLS returns [] → column drift
//     still surfaces as a PGRST error. Empty array = signature OK.
//   - bootstrap_botsson_channel requires a real workspace_id UUID. Passing nil UUID
//     will produce a DB error (not 42883). We accept any error except 42883 (not deployed).
//   - engine_stages has NO workspace_id column — verified in database.types.ts Row at
//     line 9362. Do NOT add it (instant PGRST116 regression).
//   - Claimed tables (botsson_session, botsson_persona_config, mission_progress,
//     mission_run, botsson_proposal) do NOT exist in database.types.ts — verified
//     2026-05-26. This script uses the real schema.
//
// Column sources (all from packages/supabase/src/database.types.ts Row shapes):
//   - agent_profile            → line 2102
//   - agent_session_recording  → line 2336
//   - engine_missions          → line 9143
//   - engine_stages            → line 9362
//   - bootstrap_botsson_channel RPC → line 22456
//
// Capabilities covered:
//   - Persona soul reads (stage-engine/src/core/relationship-manager.ts)
//   - Session recorder writes (stage-engine/src/core/session-recorder.ts)
//   - Mission loader reads (stage-engine/src/core/session-manager.ts:97)
//   - Stage planner reads (stage-engine/src/core/session-manager.ts:116)
//   - Botsson channel bootstrap RPC (profile.botsson_channel_id FK)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/botsson.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("botsson");

// ── 1. agent_profile — Botsson's persona/soul config (ADR-0206 v2) ────────────
// 19 cols per database.types.ts Row line 2102. workspace_id is required (not null).
// relationship-manager.ts reads by workspace_id to resolve Botsson's active persona.
// adapt_to_authority / adapt_to_role / adapt_to_situation drive dynamic tone.
const agentProfiles = await sb
  .from("agent_profile")
  .select(
    "id, workspace_id, display_name, greeting, language, " +
    "assertiveness, formality, humor, verbosity, warmth, " +
    "adapt_to_authority, adapt_to_role, adapt_to_situation, " +
    "default_voice, voice_speed, voice_stability, voice_temperature, " +
    "updated_by, created_at, updated_at",
  )
  .limit(5);
assertOk("select agent_profile (19 cols, persona/soul)", agentProfiles);
assertShape("agent_profile column shape", agentProfiles.data, [
  "id",
  "workspace_id",
  "display_name",
  "greeting",
  "language",
  "assertiveness",
  "formality",
  "humor",
  "verbosity",
  "warmth",
  "adapt_to_authority",
  "adapt_to_role",
  "adapt_to_situation",
  "default_voice",
  "created_at",
  "updated_at",
]);

// ── 2. agent_session_recording — Phase D session recorder ─────────────────────
// 16 cols per database.types.ts Row line 2336. workspace_id required.
// session-recorder.ts writes turn records; session_id FK → engine_sessions.id.
// turn_kind distinguishes human / agent / system turns. content_redacted is JSONB.
// engine_state_id nullable FK → engine_state (workflow linkage).
const recordings = await sb
  .from("agent_session_recording")
  .select(
    "id, session_id, workspace_id, profile_id, engine_state_id, " +
    "turn_index, turn_kind, phase, content_redacted, meta, " +
    "attention_score, content_envelope_id, " +
    "is_flagged, flag_reason, flagged_by_profile_id, " +
    "created_at, updated_at",
  )
  .limit(5);
assertOk("select agent_session_recording (17 cols, session recorder)", recordings);
assertShape("agent_session_recording column shape", recordings.data, [
  "id",
  "session_id",
  "workspace_id",
  "turn_index",
  "turn_kind",
  "phase",
  "content_redacted",
  "meta",
  "is_flagged",
  "created_at",
  "updated_at",
]);

// ── 3. engine_missions — 7-mission registry (Botsson's mission surface) ────────
// 11 cols per database.types.ts Row line 9143. workspace_id nullable (platform-level
// missions have NULL workspace_id). session-manager.ts:97 loads by id + is_active=true.
// mission.mode drives Botsson's channel behavior (guided / open / structured).
const missions = await sb
  .from("engine_missions")
  .select(
    "id, name, description, mode, is_active, " +
    "context_source, system_prompt, journey_id, " +
    "workspace_id, created_at, updated_at",
  )
  .limit(10);
assertOk("select engine_missions (11 cols, mission registry)", missions);
assertShape("engine_missions column shape", missions.data, [
  "id",
  "name",
  "mode",
  "is_active",
  "context_source",
  "created_at",
  "updated_at",
]);

// ── 4. engine_stages — mission stage planner (Botsson's stage nav) ─────────────
// 17 cols per database.types.ts Row line 9362. NO workspace_id column (mission-scoped
// not workspace-scoped — do NOT add workspace_id, would be PGRST116 regression).
// session-manager.ts:116 loads by mission_id ordered by stage_order ascending.
// personality_override nullable: allows per-stage tone tuning over agent_profile base.
const stages = await sb
  .from("engine_stages")
  .select(
    "id, stage_id, mission_id, stage_order, goal, instructions, " +
    "success_criteria, is_required, next_stage, " +
    "creative_freedom, personality_override, emotion_hint, " +
    "inline_instructions, deferred_templates, escalation_instructions, " +
    "journey_step_id, tuning_notes, created_at",
  )
  .limit(10);
assertOk("select engine_stages (18 cols, NO workspace_id)", stages);
assertShape("engine_stages column shape", stages.data, [
  "id",
  "stage_id",
  "mission_id",
  "stage_order",
  "goal",
  "instructions",
  "success_criteria",
  "is_required",
  "creative_freedom",
  "created_at",
]);

// ── 5. bootstrap_botsson_channel RPC — existence check ────────────────────────
// RPC per database.types.ts line 22456. Args: { p_workspace_id: string }.
// Returns: string (the channel ID). Called during workspace onboarding bootstrap
// (profile.botsson_channel_id FK). Passing nil UUID produces a DB error (not 42883).
// 42883 = function not deployed — would silently break all workspace onboarding.
const bootstrapResult = await sb.rpc("bootstrap_botsson_channel", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (bootstrapResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc bootstrap_botsson_channel — FUNCTION NOT FOUND (42883): ${bootstrapResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc bootstrap_botsson_channel — function deployed (nil UUID result: ${bootstrapResult.error?.code ?? "no error"})`,
  );
}

result();
