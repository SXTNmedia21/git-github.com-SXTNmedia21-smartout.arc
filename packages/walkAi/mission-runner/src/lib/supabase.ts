// ============================================
// supabase.ts
// Supabase client factory for the Stage Engine.
// Creates two clients: one for service-role operations (key validation,
// context loading) and one for user-scoped operations (RLS-enforced).
// Connected to: src/config.ts (provides credentials)
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Service-role client — bypasses RLS.
 * Used for: API key hash lookups in platform_api_key,
 * loading identity context, admin operations.
 * NEVER expose this client to user-facing code.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Creates an anon client with a user's JWT for RLS-enforced queries.
 * Used when the request was authenticated via JWT (not API key).
 *
 * @param accessToken - The user's JWT from the Authorization header
 * @returns A Supabase client with the user's auth context
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
