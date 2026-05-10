// ============================================
// secrets.ts
// Pre-loads external API keys from Supabase Vault at startup.
// Call loadSecrets() once before the server starts accepting requests.
// After that, getSecrets() returns cached values synchronously.
// ============================================

import { supabaseAdmin } from "./lib/supabase.js";

type ServiceSecrets = {
  openrouterApiKey: string | null;
  telegramBotToken: string | null;
  telegramWebhookSecret: string | null;
  telegramAdminChatId: string | null;
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
 *   OPENROUTER_API_KEY env var.
 */
export async function loadSecrets(): Promise<void> {
  const [vaultOpenrouter, vaultTelegramToken, vaultTelegramSecret, vaultTelegramChatId] =
    await Promise.all([
      getServiceKey("openrouter"),
      getServiceKey("telegram_bot_token"),
      getServiceKey("telegram_webhook_secret"),
      getServiceKey("telegram_admin_chat_id"),
    ]);

  // Vault first, then env var fallback
  const openrouterApiKey = vaultOpenrouter ?? process.env.OPENROUTER_API_KEY ?? null;
  const telegramBotToken = vaultTelegramToken ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
  const telegramWebhookSecret = vaultTelegramSecret ?? process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
  const telegramAdminChatId = vaultTelegramChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID ?? null;

  _secrets = {
    openrouterApiKey,
    telegramBotToken,
    telegramWebhookSecret,
    telegramAdminChatId,
  };

  const sources: string[] = [];
  if (vaultOpenrouter) sources.push("openrouter (vault)");
  else if (openrouterApiKey) sources.push("openrouter (env)");
  if (vaultTelegramToken) sources.push("telegram_bot_token (vault)");
  else if (telegramBotToken) sources.push("telegram_bot_token (env)");
  if (vaultTelegramSecret) sources.push("telegram_webhook_secret (vault)");
  else if (telegramWebhookSecret) sources.push("telegram_webhook_secret (env)");
  if (vaultTelegramChatId) sources.push("telegram_admin_chat_id (vault)");
  else if (telegramAdminChatId) sources.push("telegram_admin_chat_id (env)");

  const missing = [
    !openrouterApiKey && "openrouter",
    !telegramBotToken && "telegram_bot_token",
    !telegramWebhookSecret && "telegram_webhook_secret",
    !telegramAdminChatId && "telegram_admin_chat_id",
  ].filter(Boolean);

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
