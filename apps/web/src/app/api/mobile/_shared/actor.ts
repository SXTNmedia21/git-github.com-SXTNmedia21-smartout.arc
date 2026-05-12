/**
 * Shared mobile actor resolver for Bearer-auth BFF routes.
 *
 * Resolves identity from Bearer JWT — workspace_id and profile_id are
 * NEVER accepted from request body (ADR-0151). Returns null on any
 * resolution failure (invalid token, no active profile, empty fields).
 *
 * Fail-fast contract (L-0177 / ADR-0151):
 *   - Token invalid or expired           → return null
 *   - No active profile row for user     → return null
 *   - profile_id or workspace_id empty   → return null
 * Never falls back silently to a JWT-default workspace.
 *
 * Per ADR-0298 §4.2 + Spec §3.6: helper uses canonical profile query
 * from 00004_rls_policies.sql.
 *
 * References: ADR-0078, ADR-0132, ADR-0134, ADR-0151, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";

export type ResolvedActor = {
  userId: string;
  profileId: string;
  workspaceId: string;
  role: string | null;
};

export async function resolveMobileActor(
  bearerToken: string,
): Promise<ResolvedActor | null> {
  const admin = createAdminClient();

  const { data: userData, error: userErr } = await admin.auth.getUser(bearerToken);
  if (userErr || !userData.user) return null;

  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;

  // Fail fast on empty identity (ADR-0134 / L-0177).
  // Empty-string IDs corrupt activity_trail + engine_event routing.
  // A return-null here becomes a 401 at the call site — no silent fallback.
  if (!profile.profile_id || !profile.workspace_id) return null;

  return {
    userId: userData.user.id,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}
