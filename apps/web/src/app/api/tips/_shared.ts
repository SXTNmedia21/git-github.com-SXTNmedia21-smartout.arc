/**
 * Shared auth helpers for /api/tips/* BFF routes.
 *
 * ADR-0132 (Mobile AI Routing): mobile routes through this BFF.
 * ADR-0134 (Mobile Telemetry Contract): identity derived server-side.
 * ADR-0151: `workspace_id` + `profile_id` are re-derived from the
 *   authenticated user on every request — never accepted from the client
 *   body. Empty-string identity is banned (fail fast).
 * ADR-0078: tips are PII-adjacent (payroll amounts per employee) — chat
 *   only, no voice. Channel is pinned to "chat" at the BFF layer.
 *
 * Mirrors the pattern established in /api/availability/_shared.ts:
 * dual cookie (web) / Bearer (mobile) auth, admin-client-derived
 * profile identity, same-origin guard.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type TipsAuth = {
  userId: string;
  workspaceId: string;
  profileId: string;
  surface: "runtime_mobile" | "runtime_web";
};

/** Reject cross-origin POSTs. Same-origin only. */
export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host");
  if (!host) return NextResponse.json({ error: "Missing host header" }, { status: 400 });
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "Cross-origin forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 400 });
  }
  return null;
}

/**
 * Resolve auth from either cookie (web) or Authorization: Bearer (mobile).
 * Returns server-derived workspace + profile. Null = caller should 401.
 *
 * Empty-string identity fields are rejected (fail fast per ADR-0151).
 */
export async function resolveTipsAuth(request: NextRequest): Promise<TipsAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    // Bearer path — mobile (ADR-0132).
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    surface = "runtime_mobile";
  } else {
    // Cookie path — web.
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return null;
    userId = userData.user.id;
    surface = "runtime_web";
  }

  // Server-side identity re-derivation per ADR-0151.
  // Request body MUST NOT carry workspace_id or profile_id.
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  if (!profile.profile_id || !profile.workspace_id) return null;
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    surface,
  };
}
