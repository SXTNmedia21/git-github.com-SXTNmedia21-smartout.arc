// ============================================
// secrets.ts
// Pre-loads external API keys from Supabase Vault at startup.
// Call loadSecrets() once before the server starts accepting requests.
// After that, getSecrets() returns cached values synchronously.
// ============================================

import { supabaseAdmin } from "./lib/supabase.js";

type ServiceSecrets = {
  ultravoxApiKey: string | null;
  openrouterApiKey: string | null;
};

let _secrets: ServiceSecrets | null = null;

async function getServiceKey(secretName: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("get_secret", {
      secret_name: secretName,
    });
    if (error) {
      console.warn(`[secrets] Vault: failed to fetch "${secretName}": ${error.message}`);
      return null;
    }
    if (!data) {
      console.warn(`[secrets] Vault: secret "${secretName}" not found`);
      return null;
    }
    return data as string;
  } catch (err) {
    console.warn(`[secrets] Vault: unexpected error fetching "${secretName}":`, err);
    return null;
  }
}

/**
 * Fetches external API keys from Vault, with env var fallback for local dev.
 * Vault takes priority. If Vault is empty, falls back to:
 *   ULTRAVOX_API_KEY, OPENROUTER_API_KEY env vars.
 */
export async function loadSecrets(): Promise<void> {
  const [vaultUltravox, vaultOpenrouter] = await Promise.all([
    getServiceKey("ultravox"),
    getServiceKey("openrouter"),
  ]);

  // Vault first, then env var fallback
  const ultravoxApiKey = vaultUltravox ?? process.env.ULTRAVOX_API_KEY ?? null;
  const openrouterApiKey = vaultOpenrouter ?? process.env.OPENROUTER_API_KEY ?? null;

  _secrets = { ultravoxApiKey, openrouterApiKey };

  const sources: string[] = [];
  if (vaultUltravox) sources.push("ultravox (vault)");
  else if (ultravoxApiKey) sources.push("ultravox (env)");
  if (vaultOpenrouter) sources.push("openrouter (vault)");
  else if (openrouterApiKey) sources.push("openrouter (env)");

  const missing = [!ultravoxApiKey && "ultravox", !openrouterApiKey && "openrouter"].filter(
    Boolean,
  );

  if (sources.length > 0) {
    console.log(`[secrets] Loaded: ${sources.join(", ")}`);
  }
  if (missing.length > 0) {
    console.warn(`[secrets] Missing: ${missing.join(", ")} — related features unavailable`);
  }
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
