/**
 * resolve-auth.ts — Dual-mode auth resolver (Bearer for mobile, cookie for web).
 *
 * Lifted from /api/emma/voice/transcript/route.ts on 2026-05-08 so any BFF
 * route reachable from both mobile (Bearer JWT) and web (cookie session) can
 * share the same auth contract.
 *
 * ADR-0132 thin client: callers must NOT trust any user-identity claim coming
 * from the request body — use this helper and consume the returned `user.id`.
 *
 * ADR-0151 server-derived IDs: `profile_id` and `workspace_id` must be
 * resolved server-side from the authenticated user id, never from body.
 *
 * Returns null on auth failure. Callers decide the response code (401).
 */

import type { NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type ResolvedAuth = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
};

/**
 * Resolves the authenticated user from the incoming Next.js request.
 *
 * Priority:
 * 1. Bearer token in `Authorization` header (mobile LiveKit sessions).
 *    Validated via admin client `auth.getUser(token)` — service-role
 *    call, but the token itself is user-scoped (Supabase JWT, not anon).
 * 2. Cookie session (web dashboard). Uses the server-side Supabase client
 *    whose cookie jar is populated by the Auth middleware.
 *
 * Returns null when:
 * - Bearer token is present but invalid / expired.
 * - No token and no cookie session.
 * - Supabase admin / server client reports an error.
 */
export async function resolveAuth(request: NextRequest): Promise<ResolvedAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: { id: data.user.id }, accessToken: bearerToken, authMethod: "bearer" };
  }

  const supabase = await createClient();
  const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (userErr || sessionErr || !userData.user) return null;
  return {
    user: { id: userData.user.id },
    accessToken: sessionData.session?.access_token,
    authMethod: "cookie",
  };
}
