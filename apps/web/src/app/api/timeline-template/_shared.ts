/**
 * Shared auth helpers for /api/timeline-template/* BFF routes.
 *
 * Mirrors the pattern established in /api/tips/_shared.ts +
 * /api/availability/_shared.ts — dual cookie (web) / Bearer (mobile) auth,
 * admin-client profile derivation, same-origin guard.
 *
 * ADR-0151: workspace_id + profile_id ALWAYS derived server-side from the
 *   authenticated user. Never accepted from the request body.
 *   Empty-string identity is rejected (fail fast — L-0177).
 * ADR-0078: timeline_template authoring is chat-only. Channel is pinned
 *   to "chat" at the BFF layer so capability tools always see ctx.channel="chat".
 * ADR-0132: mobile routes through this BFF (never direct to capabilities).
 * ADR-0134: identity derived server-side before any emit().
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type TimelineTemplateAuth = {
  userId: string;
  workspaceId: string;
  profileId: string;
  surface: "runtime_mobile" | "runtime_web";
};

/** Reject cross-origin POSTs/PATCHes. Same-origin only. */
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
 * Resolve auth from cookie (web) or Authorization: Bearer (mobile).
 * Returns server-derived workspace + profile, or null when unauthenticated.
 *
 * ADR-0151: empty-string identity fields are rejected (fail fast).
 * The profile query orders by profile_id ASC for deterministic pick on
 * multi-workspace users when no requestedWorkspaceId is supplied.
 *
 * When requestedWorkspaceId is provided the function verifies the
 * authenticated user has an active profile in THAT workspace — closes the
 * indeterminate-pick bug for multi-workspace users (Fix 3, ADR-0151).
 */
export async function resolveTimelineTemplateAuth(
  request: NextRequest,
  requestedWorkspaceId?: string,
): Promise<TimelineTemplateAuth | null> {
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
  // Request body MUST NOT supply workspace_id or profile_id.
  let profileQuery = admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (requestedWorkspaceId) {
    profileQuery = profileQuery.eq("workspace_id", requestedWorkspaceId);
  }

  const { data: profile, error: profileErr } = await profileQuery
    .order("profile_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;

  // Fail fast on empty identity (L-0177 / ADR-0151 — never pass "" to emit()).
  if (!profile.profile_id || !profile.workspace_id) return null;
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    surface,
  };
}
