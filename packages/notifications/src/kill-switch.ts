/**
 * @smartout/notifications — Kill switch / feature flag
 *
 * Checks if outbound email is enabled via platform settings in landing_config.
 * Defaults to enabled if the row doesn't exist.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type PlatformSettings = {
  email_enabled?: boolean;
};

export async function isOutboundEmailEnabled(adminClient: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await adminClient
      .from("landing_config")
      .select("config_json")
      .eq("slug", "platform-settings")
      .maybeSingle();

    if (error || !data) {
      // Row doesn't exist — default to enabled
      return true;
    }

    const config = data.config_json as PlatformSettings;
    return config.email_enabled !== false;
  } catch {
    // DB error — default to enabled
    return true;
  }
}
