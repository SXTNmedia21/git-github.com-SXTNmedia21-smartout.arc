"use server";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

/**
 * Resolve the platform-admin actor for a journey-version Server Action.
 *
 * All four authoring surfaces (list / detail / new / transitions) run in the
 * platform-admin sidebar. An admin still has a `profile` row — we resolve
 * {profileId, workspaceId} from that so telemetry `actor_id` + `workspace_id`
 * are never empty (ADR-0134 guard, ADR-0176 Invariants 1 + 2). The
 * `godmode` check is the authorisation boundary (getSuperAdminId() elsewhere);
 * this helper only asserts we have an authenticated user with a profile.
 *
 * Returns null if no user / no profile. Server Actions return a typed error
 * on null rather than throwing — keeps the UI client-safe.
 */
export async function resolveAdminProfile(): Promise<{
  profileId: string;
  workspaceId: string;
  userId: string;
  role: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Gate B / ADR-0176 appendix: admin session JWT → auth.uid() → profile row.
  // We use the admin (service-role) client here because platform-admin users
  // may not have an RLS-visible profile under every workspace policy — the
  // godmode check upstream already validates the user is allowed to act.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    userId: user.id,
    role: profile.role ?? null,
  };
}

/**
 * Godmode assertion for Server Actions. Wraps the same unstable_cache-backed
 * flag used by the platform-admin server pages. Returns true if godmode.
 */
export async function assertPlatformAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", userId)
    .single();
  return Boolean(data?.is_godmode);
}
