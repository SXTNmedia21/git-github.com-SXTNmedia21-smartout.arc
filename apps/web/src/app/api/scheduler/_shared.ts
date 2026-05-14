/**
 * apps/web/src/app/api/scheduler/_shared.ts
 *
 * Shared auth + identity helpers for /api/scheduler/* BFF routes.
 *
 * ADR-0151: workspace_id + profile_id are ALWAYS re-derived from the
 *   authenticated user server-side — never accepted from the client body.
 *   Empty-string identity is banned (fail fast — L-0177).
 * ADR-0288: scheduler mutations are chat-only (voice forbidden).
 *   Channel is pinned to "chat" at BFF layer.
 * ADR-0132: mobile routes through this BFF (accept/reject are Approve verbs;
 *   propose is web-only Compose).
 * ADR-0134: Mobile Telemetry Contract — identity derived server-side.
 *
 * Pattern mirrors /api/tips/_shared.ts and /api/payroll/_shared.ts.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type SchedulerAuth = {
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
 * Resolve auth from cookie (web) or Authorization: Bearer (mobile).
 * Returns server-derived workspace + profile. Null = caller should 401.
 *
 * Per ADR-0151: workspace_id is always server-derived; never from request body.
 * Empty-string identity fields are rejected (fail fast per L-0177).
 */
export async function resolveSchedulerAuth(
  request: NextRequest,
  requestedWorkspaceId?: string,
): Promise<SchedulerAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    // Bearer path — mobile (ADR-0132).
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(bearerToken);
    if (error || !user) return null;
    userId = user.id;
    surface = "runtime_mobile";
  } else {
    // Cookie path — web (Next.js server client).
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    userId = user.id;
    surface = "runtime_web";
  }

  // Server-side profile + workspace resolution (ADR-0151).
  // ORDER BY profile_id ASC + LIMIT 1 = deterministic for multi-workspace users.
  let queryBuilder = admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (requestedWorkspaceId) {
    queryBuilder = queryBuilder.eq("workspace_id", requestedWorkspaceId);
  }

  const { data: profile, error: profileErr } = await queryBuilder
    .order("profile_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  if (!profile.profile_id || !profile.workspace_id) return null;
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") return null;

  return {
    userId,
    workspaceId: profile.workspace_id,
    profileId: profile.profile_id,
    surface,
  };
}
