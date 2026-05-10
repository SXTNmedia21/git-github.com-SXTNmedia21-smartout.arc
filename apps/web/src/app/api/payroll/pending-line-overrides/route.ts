/**
 * BFF GET /api/payroll/pending-line-overrides?periodId=...
 *
 * Returns all pending wage_line_override change_proposal rows for a given period.
 * Used by usePendingOverrides hook (T4.2) to render the "Venter godkjenning" badge
 * on calculation_line rows in LineDrawer.
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id server-derived via resolvePayrollAuth; never from query string.
 *   ADR-0078 — payroll = Høy-PII; no sensitive personal data returned (only proposal IDs
 *              and calculation_line_ids for badge state). Read-only — no gate required.
 *   L-0177   — 4xx with explicit error if periodId is missing or malformed.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

const QuerySchema = z.object({
  periodId: z.string().uuid(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Parse + validate query params ────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const parsed = QuerySchema.safeParse({ periodId: searchParams.get("periodId") });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "periodId query param is required (UUID)" },
      { status: 400 },
    );
  }
  const { periodId } = parsed.data;

  // ─── Identity (ADR-0151: server-derived, validated against requested workspace) ──
  const auth = await resolvePayrollAuth(request, workspaceId ?? undefined);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ─── Verify period belongs to this workspace (L-0177) ─────────────────────
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id")
    .eq("id", periodId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  // ─── Fetch pending wage_line_override proposals for this period ───────────
  // changes->>'period_id' filters to only proposals for this period.
  // We return the minimal shape needed for badge state: proposal ID + calculation_line_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposals, error: proposalErr } = await (admin as any)
    .from("change_proposal")
    .select("change_proposal_id, changes, created_at, initiated_by")
    .eq("workspace_id", auth.workspaceId)
    .eq("kind", "wage_line_override")
    .eq("status", "pending")
    .filter("changes->>'period_id'", "eq", periodId);

  if (proposalErr) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: (proposalErr as { message?: string }).message },
      { status: 500 },
    );
  }

  // Flatten to the badge-state shape the hook needs.
  const pending = (
    proposals as Array<{
      change_proposal_id: string;
      changes: Record<string, unknown>;
      created_at: string;
      initiated_by: string;
    }>
  ).map((p) => ({
    change_proposal_id: p.change_proposal_id,
    calculation_line_id: p.changes["calculation_line_id"] as string,
    created_at: p.created_at,
    initiated_by: p.initiated_by,
  }));

  return NextResponse.json({ ok: true, pending });
}
