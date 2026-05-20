// apps/e2e/db/helpers/clients.ts
//
// Service-role Supabase client for DB-level integration tests.
// Uses the local Supabase instance (127.0.0.1:54321 by default).
//
// Matches the pattern in apps/e2e/helpers/seed.ts.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

// NOTE: The local Supabase service role key cannot be inlined here — the
// pre-commit husky hook rejects long JWT strings even for the well-known
// local demo key. Always supply via SUPABASE_SERVICE_ROLE_KEY env var
// (e.g. `op run --env-file=.env.template -- pnpm test`) or the vitest
// environment block in package.json.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Creates a service-role Supabase client for integration tests.
 * Bypasses RLS — only use in test helpers, never in app code.
 */
export function createServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
