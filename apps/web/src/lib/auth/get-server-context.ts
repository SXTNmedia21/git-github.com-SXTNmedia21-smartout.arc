/**
 * get-server-context.ts — Canonical auth + profile bundle for BFF routes.
 *
 * Resolves auth (Bearer for mobile, cookie for web) via `resolveAuth`, then
 * fetches the authenticated user's profile from the database to derive
 * workspace_id and profile_id server-side.
 *
 * ADR-0151 server-derive: workspace_id and profile_id are NEVER trusted from
 * the request body. They are resolved here from the authenticated user's
 * profile row.
 *
 * ADR-0132 thin client: mobile callers pass a Bearer JWT; web callers use
 * cookie session. Both paths produce the same ServerContext shape.
 *
 * Returns null when:
 * - No auth (no Bearer token + no cookie session, or invalid JWT).
 * - Profile is null when the user exists but has not yet been assigned to a
 *   workspace (onboarding state before workspace creation).
 *
 * Usage:
 *   const ctx = await getServerContext(request);
 *   if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
 *   if (!ctx.profile) return NextResponse.json({ error: "no_profile" }, { status: 403 });
 */

import type { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/auth/resolve-auth";
import { createAdminClient } from "@smartout/supabase/admin";

export type ServerContext = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
  profile: {
    profile_id: string;
    workspace_id: string;
    role: string;
  } | null;
};

export async function getServerContext(request: NextRequest): Promise<ServerContext | null> {
  const auth = await resolveAuth(request);
  if (!auth) return null;

  // Admin client for the profile lookup — the authenticated user's JWT is
  // already validated by resolveAuth; we use admin here only to bypass RLS
  // for the cross-workspace profile lookup (user may have profiles in
  // multiple workspaces — we take the first active one).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();

  return {
    user: auth.user,
    accessToken: auth.accessToken,
    authMethod: auth.authMethod,
    profile: profile ?? null,
  };
}
