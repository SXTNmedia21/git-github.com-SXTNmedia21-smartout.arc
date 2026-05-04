/**
 * Shared auth + JWT-scoped client helpers for /api/shift-swap/* BFF routes.
 *
 * ADR-0132 (Mobile AI Routing): mobile routes through this BFF.
 * ADR-0134 (Mobile Telemetry Contract): identity derived server-side.
 * ADR-0151 / ADR-0176 (Invariant 3): `workspace_id` + `profile_id` are
 *   re-derived from the authenticated user on every request — never accepted
 *   from the client body. Empty-string identity is banned (fail fast).
 *
 * The shift_swap RPCs (`initiate_shift_swap`, `respond_to_shift_swap`,
 * `cancel_shift_swap`) are SECURITY DEFINER and read `auth.uid()`. From a
 * service-role admin client, `auth.uid()` is NULL — so these routes MUST
 * call the RPCs via a JWT-scoped client that carries the user's access
 * token. `createUserClient()` builds that client from a Bearer token; the
 * cookie-path gets it via `supabase.auth.getSession().access_token`.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient as createJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase/database.types";

export type ShiftSwapAuth = {
  userId: string;
  workspaceId: string;
  profileId: string;
  /** The user's Supabase access token — required to build a JWT-scoped client. */
  accessToken: string;
  surface: "runtime_mobile" | "runtime_web";
};

/**
 * Reject cross-origin POSTs. Same-origin only — mirrors
 * reconciliation/wizard-override/route.ts.
 */
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
 * Resolve auth from either:
 *  - cookie session (web) — reads access_token from session
 *  - Authorization: Bearer <token> header (mobile, ADR-0132)
 *
 * On success returns the user's id + access token + server-derived
 * workspace_id + profile_id. Any missing or empty identity field = null
 * (reject with 401), per ADR-0134.
 */
export async function resolveShiftSwapAuth(request: NextRequest): Promise<ShiftSwapAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;
  let accessToken: string | null = null;
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    // Bearer path (mobile per ADR-0132). Validate via admin client in stateless
    // mode — never call getSession(), it would be null.
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    accessToken = bearerToken;
    surface = "runtime_mobile";
  } else {
    // Cookie path (web). Fetch both user and session; session carries the
    // access_token we need for the JWT-scoped RPC client.
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
  // The request body must NOT carry workspace_id or profile_id — identity is
  // bound to the authenticated user.
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
 * Build a supabase-js client scoped to the user's JWT. SECURITY DEFINER RPCs
 * that read `auth.uid()` require this — the service-role admin client would
 * make `auth.uid()` return NULL. Anon key + Authorization header is the
 * canonical supabase-js pattern for user-scoped server-side calls.
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
