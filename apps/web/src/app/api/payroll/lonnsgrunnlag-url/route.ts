/**
 * BFF GET /api/payroll/lonnsgrunnlag-url
 *
 * Signed URL gateway for PDF lønnsgrunnlag. Used by the web my-salary page and
 * the mobile payroll detail view to fetch a time-limited download URL.
 *
 * Query params:
 *   lonnsgrunnlagId — UUID of the payroll.export_event (the PDF bundle event)
 *   profileId       — UUID of the employee profile whose PDF to fetch
 *
 * Single source of truth: delegates entirely to viewLonnsgrunnlag.execute() from
 * the payroll capability tool. The tool already encodes:
 *   - chat-only guard (ADR-0078)
 *   - callGateAction (ADR-0099, ADR-0204)
 *   - workspace + profile server-derivation (ADR-0151)
 *   - L-0177 fail-fast on not-found / wrong-format / wrong-workspace / wrong-profile
 *   - signed URL generation with role-appropriate expiry (3600s employee / 86400s admin)
 *   - emit payroll.lonnsgrunnlag_url_granted (ADR-0134)
 *
 * This BFF route is HTTP-shaped glue only — no business logic lives here.
 * BFF resolves identity server-side; constructs a synthetic AgentToolContext;
 * invokes the tool; maps the tool JSON result to an HTTP response.
 *
 * 4xx cases (from tool):
 *   - not_found          → 404 (export_event not found / wrong workspace)
 *   - wrong_format       → 422 (event is not a PDF export)
 *   - access_denied      → 403 (employee trying to access another profile)
 *   - profile_id_required → 400 (admin didn't supply profileId)
 *   - authority_denied   → 403 (gate denied)
 *   - channel_forbidden  → 403 (voice — never hit from HTTP)
 *   - signed_url_failed  → 500
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id + profile_id derived server-side via resolvePayrollAuth
 *   ADR-0204 — viewLonnsgrunnlag.execute() calls callGateAction
 *   ADR-0078 — channel forced to "chat" in synthetic context
 *   ADR-0134 — emit inside tool execute()
 *   L-0177   — fail fast inside tool execute()
 *   ADR-0294 — signed URL expiry enforced by tool (3600/86400)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { viewLonnsgrunnlag } from "@smartout/ai/capabilities/payroll/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const QuerySchema = z.object({
  lonnsgrunnlagId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
});

// Map tool reason codes to HTTP status codes.
const REASON_TO_STATUS: Record<string, number> = {
  not_found: 404,
  wrong_format: 422,
  access_denied: 403,
  authority_denied: 403,
  channel_forbidden: 403,
  profile_id_required: 400,
  profile_not_found: 404,
  signed_url_failed: 500,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151: server-derived, never from query string) ──────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Parse + validate query params ────────────────────────────────────────
  const rawParams = {
    lonnsgrunnlagId: request.nextUrl.searchParams.get("lonnsgrunnlagId") ?? undefined,
    profileId: request.nextUrl.searchParams.get("profileId") ?? undefined,
  };

  let params: z.infer<typeof QuerySchema>;
  try {
    params = QuerySchema.parse(rawParams);
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid params") : "Invalid params";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Delegate to view_lonnsgrunnlag capability tool ───────────────────────
  // Construct a synthetic AgentToolContext so the tool can run in HTTP context.
  // supabaseAdmin is typed as `unknown` in AgentToolContext and cast inside the tool.
  const admin = createAdminClient();

  // NonEmptyString brand cast: resolvePayrollAuth already validates non-empty IDs (ADR-0151).
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: `http-${Date.now()}`, // ephemeral session ID for BFF invocations
    channel: "chat" as const, // force chat (ADR-0078 Høy-PII; GET has no body channel)
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  const toolResult = await viewLonnsgrunnlag.execute(
    {
      lonnsgrunnlag_id: params.lonnsgrunnlagId,
      profile_id: params.profileId,
    },
    ctx,
  );

  // ─── Parse tool JSON result and map to HTTP response ──────────────────────
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(toolResult) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "tool_parse_error" }, { status: 500 });
  }

  if (!result.ok) {
    const reason = typeof result.reason === "string" ? result.reason : "unknown";
    const status = REASON_TO_STATUS[reason] ?? 500;
    return NextResponse.json(
      { ok: false, error: reason, detail: result.detail ?? null },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    signed_url: result.signed_url,
    expires_at: result.expires_at,
    profile_id: result.profile_id,
    period_id: result.period_id,
  });
}
