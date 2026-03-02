// ============================================
// secrets.ts
// Pre-loads external API keys from Supabase Vault at startup.
// Call loadSecrets() once before the server starts accepting requests.
// After that, getSecrets() returns cached values synchronously.
// Connected to: packages/supabase/src/vault.ts (shared helper)
// Connected to: src/lib/supabase.ts (service-role client)
// ============================================

import { getServiceKey } from "@smartout/supabase/vault";
import { supabaseAdmin } from "./lib/supabase.js";

type ServiceSecrets = {
  ultravoxApiKey: string;
  openrouterApiKey: string;
};

let _secrets: ServiceSecrets | null = null;

/**
 * Fetches all required external API keys from Vault.
 * Must be called once at startup, before the server starts.
 */
export async function loadSecrets(): Promise<void> {
  const [ultravoxApiKey, openrouterApiKey] = await Promise.all([
    getServiceKey(supabaseAdmin, "ultravox"),
    getServiceKey(supabaseAdmin, "openrouter"),
  ]);

  _secrets = { ultravoxApiKey, openrouterApiKey };
  console.log("[secrets] Loaded 2 keys from Vault (ultravox, openrouter)");
}

/**
 * Returns the pre-loaded secrets. Throws if loadSecrets() hasn't been called.
 */
export function getSecrets(): ServiceSecrets {
  if (!_secrets) {
    throw new Error("Secrets not loaded. Call loadSecrets() at startup.");
  }
  return _secrets;
}
