// ============================================
// types.ts — Season Tool Context
// Defines the context object passed to all season agent tools.
// Contains the Supabase admin client, workspace ID, and session ID
// so tools can read/write season data during the planning flow.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { SessionChannel } from "../../capabilities/types.js";

/**
 * Context passed to every season agent tool.
 * Provides database access and session identity.
 *
 * When tools run inside the Stage Engine, the supabase client is the admin client
 * and collected_data is available for reading prior stage outputs.
 * When tools run in stub mode (no DB), supabase and collectedData may be undefined.
 *
 * SS-5 (ADR-0204): `profileId` and `channel` added so mutation tools can
 * route through `gatedMutation()`. Both optional today because
 * `SEASON_TOOLS` is not wired to an agent runner — when future callers
 * arrive they MUST supply both (gate_action fails closed without
 * `actor_profile_id`). Tools fall back to a service-role actor id (via
 * the `created_by` / `updated_by` columns) and `channel="system"` to
 * preserve the current dead-code behaviour without silently bypassing
 * the gate.
 */
export type SeasonToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  sessionId: string;
  /** Data collected from prior stages in this session */
  collectedData?: Record<string, unknown>;
  /** Profile id that initiated this tool call. Required at runtime by
   *  `gate_action` (Pathway A of `gatedMutation()`) — a future caller that
   *  forgets this will hit a fail-closed deny with a clear reason. */
  profileId?: string;
  /** ADR-0078 channel context for mutation gates. Defaults to `"system"`
   *  inside tools when unset (Season authoring is a planning flow with no
   *  user-facing PII surface). */
  channel?: SessionChannel;
};
