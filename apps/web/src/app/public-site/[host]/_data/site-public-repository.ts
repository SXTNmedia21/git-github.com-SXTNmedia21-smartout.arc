import { createClient } from "@supabase/supabase-js";
import type { SiteSnapshot } from "@smartout/website";

/**
 * Service-role Supabase client for public site reads ONLY.
 * Isolated here — no other file should use service role for website data.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Fetch the active published snapshot for a given hostname.
 * Returns null if no site is published for this host.
 */
export async function getPublishedSiteByHost(host: string): Promise<SiteSnapshot | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .schema("websites")
    .rpc("get_active_site_snapshot_by_host", { p_host: host });

  if (error || !data) return null;
  return data as SiteSnapshot;
}

/**
 * Fetch draft data for a valid preview token.
 * Returns null if token is invalid, expired, or revoked.
 */
export async function getPreviewSiteByToken(token: string): Promise<SiteSnapshot | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .schema("websites")
    .rpc("get_preview_site_by_token", { p_token: token });

  if (error || !data) return null;
  return data as SiteSnapshot;
}
