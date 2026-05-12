/**
 * BFF POST /api/payroll/reveal-bank-account
 *
 * PII-reveal gateway for an employee's bank account number.
 * Admin or self-access. Chat channel only (ADR-0078 Høy-PII).
 *
 * Single source of truth: delegates entirely to viewBankAccount.execute()
 * from the payroll capability tool. The tool already encodes:
 *   - chat-only guard (ADR-0078)
 *   - callGateAction (ADR-0099 / ADR-0204)
 *   - workspace + profile server-derivation forgery defence (ADR-0151, L-0177)
 *   - audit emit on every reveal attempt (payroll.bank_account_revealed)
 *
 * This BFF route is HTTP-shaped glue only — no business logic lives here.
 * BFF resolves identity server-side; constructs a synthetic AgentToolContext;
 * invokes the tool; maps the tool JSON result to an HTTP response.
 *
 * Body: { profileId: string, workspaceId: string }   // UUID of the target profile + caller's workspace
 *
 * Response (ok=true):
 *   { ok: true, value: string | null, is_self: boolean, has_value: boolean,
 *     gate_evaluation_id: string | null }
 *
 * Response (ok=false):
 *   { ok: false, reason: 'channel_forbidden' | 'authority_denied' | 'not_found'
 *     | 'invalid_request', detail?: string }
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id + profile_id derived server-side via resolvePayrollAuth
 *   ADR-0204 — viewBankAccount.execute() calls callGateAction
 *   ADR-0078 — channel forced to "chat" in synthetic context
 *   ADR-0134 — emit inside tool execute()
 *   L-0177   — fail fast inside tool execute() (workspace-scoped SELECT)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { viewBankAccount } from "@smartout/ai/capabilities/payroll/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const RevealRequestSchema = z.object({
  profileId: z.string().uuid(),
  // Reviewer finding Fix 3 (HIGH): workspaceId from caller is validated server-side
  // against profile membership so multi-workspace users get deterministic workspace pick
  // (ADR-0151, L-0177 no silent fallback).
  workspaceId: z.string().uuid(),
});

const REASON_TO_STATUS: Record<string, number> = {
  channel_forbidden: 403,
  authority_denied: 403,
  not_found: 404,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Parse + validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_request", detail: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = RevealRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_request",
        detail: parsed.error.errors[0]?.message ?? "Invalid request",
      },
      { status: 400 },
    );
  }

  const { profileId, workspaceId: requestedWorkspaceId } = parsed.data;

  // ─── Identity (ADR-0151: server-derived, never from request body) ──────────
  // Pass requestedWorkspaceId so resolvePayrollAuth validates membership in the
  // caller's declared workspace (multi-workspace determinism fix — reviewer finding Fix 3 HIGH).
  const auth = await resolvePayrollAuth(request, requestedWorkspaceId);
  if (!auth) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // ─── Build synthetic AgentToolContext ─────────────────────────────────────
  const admin = createAdminClient();

  // NonEmptyString brand cast: resolvePayrollAuth already validates non-empty IDs (ADR-0151).
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: `http-${Date.now()}`,
    channel: "chat" as const, // force chat (ADR-0078 Høy-PII)
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Delegate to view_bank_account capability tool ────────────────────────
  const toolResult = await viewBankAccount.execute({ profile_id: profileId }, ctx);

  // ─── Parse tool JSON result and map to HTTP response ──────────────────────
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(toolResult) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "tool_parse_error" }, { status: 500 });
  }

  if (!result.ok) {
    const reason = typeof result.reason === "string" ? result.reason : "unknown";
    const status = REASON_TO_STATUS[reason] ?? 500;
    return NextResponse.json({ ok: false, reason, detail: result.detail ?? null }, { status });
  }

  return NextResponse.json(
    {
      ok: true,
      value: result.value ?? null,
      is_self: result.is_self,
      has_value: result.has_value,
      gate_evaluation_id: result.gate_evaluation_id ?? null,
    },
    { status: 200 },
  );
}
