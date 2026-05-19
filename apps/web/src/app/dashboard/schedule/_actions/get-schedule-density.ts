/**
 * get-schedule-density.ts
 *
 * WHY: Server-component reader for the user's persisted schedule density
 * preference. Called from the schedule page.tsx (server component) so the
 * initial value is available before hydration — avoids a flash from
 * "default" → persisted value on first paint.
 *
 * Design rules honored:
 *   ADR-0151 — profileId + workspaceId are server-derived (passed from
 *              resolveCurrentProfile() in the calling page, never from body).
 *   L-0177   — returns "default" on missing row; no silent null fallback
 *              that could propagate as undefined to callers.
 *
 * NOT a Server Action ("use server" is intentionally absent) — this is a
 * plain async helper for use in React Server Components only.
 */

import { createClient } from "@smartout/supabase/server";
import type { ScheduleDensity } from "../_components/density-selector";

const DENSITY_DEFAULT: ScheduleDensity = "default";

/**
 * Reads the persisted schedule density for a given profile + workspace.
 * Returns `"default"` when no row exists (new user, first visit).
 *
 * Uses the JWT-scoped Supabase client so RLS policies apply — the row
 * must satisfy `user_view_preference_own_jwt_select`.
 *
 * @param profileId   - Server-derived from JWT (ADR-0151). Never from client body.
 * @param workspaceId - Server-derived from JWT (ADR-0151). Never from client body.
 */
export async function getScheduleDensity(
  profileId: string,
  workspaceId: string,
): Promise<ScheduleDensity> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_view_preference")
    .select("preference_value")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .eq("surface", "schedule")
    .eq("preference_key", "density")
    .maybeSingle();

  if (error || !data) {
    // L-0177: row-not-found is the happy-path for new users — return default,
    // do not throw, do not log as error.
    return DENSITY_DEFAULT;
  }

  // Validate the stored value against known tiers — guards against stale rows
  // if the enum ever narrows (e.g. "pulse" retired in a future migration).
  const stored = data.preference_value;
  if (stored === "cozy" || stored === "default" || stored === "compact" || stored === "pulse") {
    return stored;
  }

  // Unrecognised value in DB — fall back to default rather than crashing.
  return DENSITY_DEFAULT;
}
