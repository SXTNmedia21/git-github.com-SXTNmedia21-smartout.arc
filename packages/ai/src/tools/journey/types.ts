// ============================================
// types.ts — Journey Agent Tool Context
// Defines the context object passed to all journey agent tools.
// Contains the Supabase admin client, workspace ID, and session ID
// so tools can read/write journey data during the wizard flow.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { DraftJourney, WizardPhase } from "@smartout/types";

/**
 * Context passed to every journey agent tool.
 * Provides database access and session state needed
 * by the tool functions.
 */
export type JourneyToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  sessionId: string;
  currentPhase: WizardPhase;
  draftJourney: DraftJourney;
};
