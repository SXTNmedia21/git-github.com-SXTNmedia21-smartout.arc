// ============================================
// types.ts — Season Tool Context
// Defines the context object passed to all season agent tools.
// Contains the Supabase admin client, workspace ID, and session ID
// so tools can read/write season data during the planning flow.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

/**
 * Context passed to every season agent tool.
 * Provides database access and session identity.
 *
 * When tools run inside the Stage Engine, the supabase client is the admin client
 * and collected_data is available for reading prior stage outputs.
 * When tools run in stub mode (no DB), supabase and collectedData may be undefined.
 */
export type SeasonToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  sessionId: string;
  /** Data collected from prior stages in this session */
  collectedData?: Record<string, unknown>;
};
