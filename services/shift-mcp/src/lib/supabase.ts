// ============================================
// supabase.ts
// Supabase client factory for the Shift MCP Server.
// Provides two clients:
//   1. supabaseAdmin — service role, bypasses RLS (key validation + admin ops)
//   2. createUserClient — anon key with user JWT, enforces RLS
// Connected to: src/config.ts (env vars)
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Service role client — bypasses RLS.
 * Use ONLY for API key validation and admin operations.
 * Never expose to client-facing code paths.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Creates an anon client with a user JWT injected into the
 * Authorization header. This client enforces RLS policies.
 *
 * @param accessToken - User JWT from Authorization: Bearer header
 * @returns Supabase client scoped to the user's permissions
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
