// ============================================
// types.ts — Journey Agent Tool Context
// Defines the context object passed to all journey agent tools.
// Contains the Supabase admin client, workspace ID, and session ID
// so tools can read/write journey data during the wizard flow.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { DraftJourney, WizardPhase } from "@smartout/types";
import type { SessionChannel } from "../../capabilities/types.js";

/**
 * Context passed to every journey agent tool.
 * Provides database access and session state needed
 * by the tool functions.
 *
 * SS-5 (ADR-0204): `profileId` and `channel` added so mutation tools can
 * route through `gatedMutation()`. The journey wizard runs godmode-only
 * (platform admin) — the BFF route (`apps/web/src/app/api/journey-agent/
 * route.ts`) resolves `adminId` and passes it here.
 */
export type JourneyToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  sessionId: string;
  currentPhase: WizardPhase;
  draftJourney: DraftJourney;
  /** Profile id that initiated this tool call (super-admin session). Required
   *  at runtime by `gate_action` (Pathway A of `gatedMutation()`). Optional on
   *  the type so existing stub callers compile while the BFF route is
   *  migrated in the same SS. */
  profileId?: string;
  /** ADR-0078 channel context for mutation gates. Defaults to `"chat"` inside
   *  tools when unset (wizard UI is a chat surface). */
  channel?: SessionChannel;
};
