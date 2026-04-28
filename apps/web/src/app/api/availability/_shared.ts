/**
 * Shared auth helpers for /api/availability/* BFF routes.
 *
 * ADR-0132 (Mobile AI Routing): mobile routes through this BFF.
 * ADR-0134 (Mobile Telemetry Contract): identity derived server-side.
 * ADR-0151 / ADR-0176 Invariant 3: `workspace_id` + `profile_id` are
 *   re-derived from the authenticated user on every request — never
 *   accepted from the client body. Empty-string identity is banned.
 *
 * Unlike shift_swap (which calls SECURITY DEFINER RPCs via a JWT-scoped
 * client), availability writes go directly to the `employee_availability`
 * / `employee_availability_preference` tables. The tables' RLS already
 * enforces "profile_id = auth.uid()'s profile" on insert/update/delete,
 * so we use a JWT-scoped user client to preserve RLS-as-defence-in-depth
 * on top of the BFF's own gate_action check (Sortie 1 pattern carried
 * over — defence-in-depth without service-role elevation).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient as createJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase/database.types";

export type AvailabilityAuth = {
  userId: string;
  workspaceId: string;
  profileId: string;
  accessToken: string;
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
 * On success returns user id + access token + server-derived workspace +
 * profile. Empty-string identity returns null (caller should 401).
 */
export async function resolveAvailabilityAuth(
  request: NextRequest,
): Promise<AvailabilityAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;
  let accessToken: string | null = null;
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    // Bearer path (mobile per ADR-0132).
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    accessToken = bearerToken;
    surface = "runtime_mobile";
  } else {
    // Cookie path (web). Session carries the access_token for the
    // JWT-scoped table client.
    const supabase = await createClient();
    const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
      await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
    if (userErr || sessionErr || !userData.user) return null;
    if (!sessionData.session?.access_token) return null;
    userId = userData.user.id;
    accessToken = sessionData.session.access_token;
    surface = "runtime_web";
  }

  // Server-side identity re-derivation (ADR-0151 / ADR-0176 Invariant 3).
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
    accessToken,
    surface,
  };
}

/**
 * Build a supabase-js client scoped to the user's JWT. Writes to
 * `employee_availability` / `employee_availability_preference` go through
 * this client so the tables' RLS ("profile_id belongs to auth.uid()")
 * remains enforced — defence-in-depth on top of the route-level
 * gate_action call.
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createJsClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
