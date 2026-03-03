// ============================================
// secrets.ts
// Pre-loads external API keys from Supabase Vault at startup.
// Falls back to environment variables when Vault is unavailable.
// Call loadSecrets() once before the server starts accepting requests.
// After that, getSecrets() returns cached values synchronously.
// ============================================

import { supabase } from "./lib/supabase.js";
import { config } from "./config.js";

type ServiceSecrets = {
  docusealApiKey: string;
  docusealWebhookSecret: string;
};

let _secrets: ServiceSecrets | null = null;

async function getServiceKey(secretName: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_secret", {
    secret_name: secretName,
  });
  if (error) throw new Error(`Vault: failed to fetch "${secretName}": ${error.message}`);
  if (!data) throw new Error(`Vault: secret "${secretName}" not found`);
  return data as string;
}

/**
 * Fetches all required external API keys from Vault.
 * Falls back to DOCUSEAL_API_KEY / DOCUSEAL_WEBHOOK_SECRET env vars when Vault is unavailable.
 * Must be called once at startup, before the server starts.
 */
export async function loadSecrets(): Promise<void> {
  try {
    const [docusealApiKey, docusealWebhookSecret] = await Promise.all([
      getServiceKey("docuseal"),
      getServiceKey("docuseal_webhook_secret"),
    ]);

    _secrets = { docusealApiKey, docusealWebhookSecret };
    console.log("[secrets] Loaded 2 keys from Vault (docuseal, docuseal_webhook_secret)");
  } catch (vaultError) {
    console.warn(
      `[secrets] Vault unavailable, falling back to env vars: ${(vaultError as Error).message}`,
    );

    const docusealApiKey = config.DOCUSEAL_API_KEY;
    const docusealWebhookSecret = config.DOCUSEAL_WEBHOOK_SECRET;

    if (!docusealApiKey || !docusealWebhookSecret) {
      throw new Error(
        "Vault unavailable and DOCUSEAL_API_KEY / DOCUSEAL_WEBHOOK_SECRET env vars not set. " +
          "Provide either Vault access or env vars.",
      );
    }

    _secrets = { docusealApiKey, docusealWebhookSecret };
    console.log(
      "[secrets] Loaded 2 keys from env vars (DOCUSEAL_API_KEY, DOCUSEAL_WEBHOOK_SECRET)",
    );
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
