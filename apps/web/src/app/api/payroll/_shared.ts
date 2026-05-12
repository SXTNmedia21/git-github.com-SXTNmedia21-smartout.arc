/**
 * Shared auth + identity helpers for /api/payroll/* BFF routes.
 *
 * Pattern mirrors /api/tips/_shared.ts exactly.
 *
 * ADR-0151: workspace_id + profile_id are ALWAYS re-derived from the
 *   authenticated user server-side — never accepted from the client body.
 *   Empty-string identity is banned (fail fast).
 * ADR-0078: payroll = Høy-PII — chat only, no voice. Channel pinned to
 *   "chat" at BFF layer.
 * ADR-0132: mobile routes through this BFF (never direct to capabilities).
 * ADR-0134: Mobile Telemetry Contract — identity derived server-side.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type PayrollAuth = {
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
 * Per ADR-0151: empty-string identity fields are rejected (fail fast).
 *
 * When requestedWorkspaceId is provided (Path B — PII reveal routes), the
 * function verifies the authenticated user has an active profile in THAT
 * workspace and returns it instead of picking the first match. This closes
 * the indeterminate-pick bug for multi-workspace users (reviewer finding
 * Fix 3, ADR-0151).
 *
 * For routes that do NOT pass requestedWorkspaceId, the query is ordered
 * by profile_id ASC so the pick is at least deterministic (lowest UUID
 * wins). This is safe for single-workspace users (the common case) and
 * avoids arbitrary row selection on PostgreSQL heap scan order.
 */
export async function resolvePayrollAuth(
  request: NextRequest,
  requestedWorkspaceId?: string,
): Promise<PayrollAuth | null> {
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

  // Server-side identity derivation per ADR-0151.
  // The client body MUST NOT supply workspace_id or profile_id.
  //
  // Path B (PII reveal routes): caller supplies a workspaceId and we validate
  // the user has an active profile in exactly that workspace. If the workspace
  // does not match any active profile → null (caller returns 403).
  //
  // Default path: ORDER BY profile_id ASC + LIMIT 1 makes the pick deterministic
  // for multi-workspace users (avoids PostgreSQL heap-scan non-determinism).
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
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    surface,
  };
}
