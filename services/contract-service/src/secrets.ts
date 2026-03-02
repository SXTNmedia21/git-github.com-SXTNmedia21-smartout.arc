// ============================================
// secrets.ts
// Pre-loads external API keys from Supabase Vault at startup.
// Call loadSecrets() once before the server starts accepting requests.
// After that, getSecrets() returns cached values synchronously.
// Connected to: packages/supabase/src/vault.ts (shared helper)
// Connected to: src/lib/supabase.ts (service-role client)
// ============================================

import { getServiceKey } from "@smartout/supabase/vault";
import { supabase } from "./lib/supabase.js";

type ServiceSecrets = {
  docusealApiKey: string;
  docusealWebhookSecret: string;
};

let _secrets: ServiceSecrets | null = null;

/**
 * Fetches all required external API keys from Vault.
 * Must be called once at startup, before the server starts.
 */
export async function loadSecrets(): Promise<void> {
  const [docusealApiKey, docusealWebhookSecret] = await Promise.all([
    getServiceKey(supabase, "docuseal"),
    getServiceKey(supabase, "docuseal_webhook_secret"),
  ]);

  _secrets = { docusealApiKey, docusealWebhookSecret };
  console.log("[secrets] Loaded 2 keys from Vault (docuseal, docuseal_webhook_secret)");
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
