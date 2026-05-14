/**
 * POST /api/botsson/pos/connect
 *
 * BFF route: connect a Lightspeed K-Series POS account for the authenticated
 * workspace. Delegates entirely to connectLightspeed.execute() from the
 * pos_account_management capability.
 *
 * Design:
 *   - HTTP-shaped glue only. No business logic lives here.
 *   - workspace_id + profile_id derived server-side (ADR-0151, L-0177).
 *   - Channel forced to "chat" (ADR-0288 + ADR-0078 admin-op guard).
 *   - Admin role verified before tool invocation (gate rejects non-admin too,
 *     but we fail fast at BFF to avoid round-trip).
 *   - Capability tool encodes mutateWithGate + emit + fn_pos_credentials_upsert.
 *
 * Body: { external_account_id: string, oauth_code: string }
 *
 * Response ok:    { ok: true, message: string }
 * Response error: { ok: false, error: string }
 *
 * ADR compliance (body verified — L-0176):
 *   ADR-0151 — workspace_id + profile_id derived server-side
 *   ADR-0287 — mutateWithGate inside connectLightspeed.execute()
 *   ADR-0288 — channel forced "chat" (POS connect is chat-only admin op)
 *   ADR-0134 — emit inside tool execute() (pos.account.connected)
 *   ADR-0099 — one gate per write (via mutateWithGate)
 *   ADR-0305 — POS adapter admin connect surface
 *   L-0177   — fail fast on missing identity, no silent fallback
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { connectLightspeed } from "@smartout/ai/capabilities/pos_account_management/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ConnectSchema = z.object({
  external_account_id: z.string().min(1).max(255),
  oauth_code: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── Parse body ───────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = ConnectSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { external_account_id, oauth_code } = parsed.data;

  // ─── Identity — server-derived (ADR-0151) ─────────────────────────────────
  // Cookie-auth only: POS connect is an admin operation in the web dashboard.
  // workspace_id is derived from the user's active profile membership; it is
  // never accepted from the request body (L-0177 — no silent fallback).
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Resolve workspace + profile for the authenticated user.
  // Restrict to admin/owner roles: POS connect is a Compose verb (ADR-0133).
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userData.user.id)
    .in("role", ["admin", "owner"])
    .eq("status", "active")
    .order("profile_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) {
    // Fail fast — no silent fallback (L-0177 + ADR-0151).
    return NextResponse.json(
      { ok: false, error: "Admin profile not found. POS connect requires admin or owner role." },
      { status: 403 },
    );
  }

  const workspaceId = profile.workspace_id;
  const profileId = profile.profile_id;

  // Guard: non-empty IDs are required for telemetry (ADR-0134, L-0177).
  if (!workspaceId || !profileId) {
    return NextResponse.json(
      { ok: false, error: "Identity resolution failed (empty IDs)" },
      { status: 500 },
    );
  }

  // ─── Synthetic AgentToolContext (chat-only per ADR-0288) ─────────────────
  const ctx: AgentToolContext = {
    workspaceId: workspaceId as NonEmptyString,
    profileId: profileId as NonEmptyString,
    userId: userData.user.id,
    sessionId: `http-pos-connect-${Date.now()}`,
    channel: "chat" as const, // ADR-0288 + ADR-0078: POS connect is chat-only admin op
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Delegate to capability tool ──────────────────────────────────────────
  // Tool encodes: mutateWithGate (ADR-0287) → fn_pos_credentials_upsert →
  // INSERT/UPDATE pos_account → emit pos.account.connected (ADR-0134).
  const toolResult = await connectLightspeed.execute({ external_account_id, oauth_code }, ctx);

  // Tool returns a localised string. Success starts with "POS-konto"; errors
  // include "Ikke autorisert", "Tilkoblingsfeil", or similar prefixes.
  const isError =
    toolResult.startsWith("Ikke autorisert") ||
    toolResult.startsWith("Tilkoblingsfeil") ||
    toolResult.startsWith("POS-kontoadministrasjon er kun");

  if (isError) {
    return NextResponse.json({ ok: false, error: toolResult }, { status: 403 });
  }

  return NextResponse.json({ ok: true, message: toolResult });
}
