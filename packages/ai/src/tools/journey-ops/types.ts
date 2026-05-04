// ============================================
// types.ts — Journey Ops Agent Tool Context
//
// Context for tools used by the Journey Operations Agent in
// platform-admin. Unlike the definition wizard (which scopes by
// workspace_id), the ops agent runs as super-admin and operates
// across all workspaces.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

export type JourneyOpsToolContext = {
  /** Admin client (service role). Bypasses RLS — platform-admin scope. */
  admin: SupabaseClient<Database>;
  /** Super-admin profile id, used for journey_event logging. */
  actorId: string;
  /** Optional — id of the journey the user is currently focused on. */
  currentJourneyId: string | null;
  /** OpenRouter key for sub-runs (runbook). May be null if vault read failed. */
  openrouterKey: string | null;
};
