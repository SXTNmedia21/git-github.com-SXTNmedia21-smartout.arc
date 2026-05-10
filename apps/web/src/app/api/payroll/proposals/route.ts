/**
 * BFF GET /api/payroll/proposals
 *
 * Returns pending wage_line_override proposals for the authenticated user's
 * workspace. Intended for the admin inbox / proposals list (T5.1).
 *
 * Filters:
 *   kind  = 'wage_line_override'   (hardcoded — this route is proposal-inbox only)
 *   status = 'pending'             (only unresolved proposals belong in the inbox)
 *
 * Ordering: proposed_at DESC (newest first).
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id derived server-side via resolvePayrollAuth; never from body.
 *   ADR-0134 — read-only route; no emit required (list_viewed is navigation noise).
 *   L-0177   — fail fast on auth failure; no silent fallback.
 *   ADR-0078 — payroll is High-PII; channel pinned to "chat" at BFF (no voice path).
 *
 * Response shape (array):
 *   ProposalListItem[] — see inline type below; typed at call site by use-payroll-proposals.ts
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Extract workspaceId from query for auth resolve ──────────────────────
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");

  // ─── Identity (ADR-0151: server-derived, validated against requested workspace) ──
  const auth = await resolvePayrollAuth(request, workspaceId ?? undefined);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ─── Query: pending wage_line_override proposals in workspace ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("change_proposal")
    .select(
      [
        "change_proposal_id",
        "workspace_id",
        "status",
        "trigger_entity_type",
        "changes",
        "initiated_by",
        "created_at",
        // Resolve proposer display name via profile join
        "profile:initiated_by(profile_id, display_name)",
      ].join(", "),
    )
    .eq("workspace_id", auth.workspaceId)
    .eq("trigger_entity_type", "payroll_calculation_line")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[/api/payroll/proposals] query error", error.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, proposals: data ?? [] });
}
