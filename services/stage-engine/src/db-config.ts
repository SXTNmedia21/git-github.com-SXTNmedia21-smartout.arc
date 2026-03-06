import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

let cachedConfig: Record<string, unknown> | null = null;
let cacheExpires = 0;

const SERVICE_SLUG = "stage-engine";

/**
 * Load runtime config from service_config table.
 * Cached for 60s. Falls back to empty object on failure.
 * This provides DB-first config for values that can change at runtime
 * without a restart (feature flags, URLs, etc.).
 */
export async function loadServiceConfig(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (cachedConfig && cacheExpires > now) return cachedConfig;

  try {
    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
    );
    const { data } = await supabase
      .from("service_config")
      .select("config, host_url, port")
      .eq("slug", SERVICE_SLUG)
      .single();

    cachedConfig = (data?.config as Record<string, unknown>) ?? {};
    cacheExpires = now + 60_000;
    return cachedConfig;
  } catch {
    return {};
  }
}

/** Get a config value: DB config > env var > fallback */
export async function getConfig(
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const dbConfig = await loadServiceConfig();
  const val = dbConfig[key];
  if (typeof val === "string") return val;
  if (val !== undefined) return String(val);
  return process.env[key] ?? fallback;
}
