// ============================================
// client.ts
// Supabase service-role client for the docs pipeline.
// Uses service role because platform_doc_chunk has no RLS —
// it's a platform-level table accessed only server-side.
// Connected to: src/db/operations.ts (uses this client for all DB ops)
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Singleton service-role client */
let client: SupabaseClient | null = null;

/**
 * Returns a Supabase service-role client.
 *
 * Why: The docs pipeline runs server-side only and needs service role
 * access because platform_doc_chunk has no RLS policies.
 * Singleton pattern avoids creating multiple connections.
 *
 * @returns Supabase client configured with service role key
 * @throws Error if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing
 */
export function getServiceClient(): SupabaseClient {
  if (client) return client;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
