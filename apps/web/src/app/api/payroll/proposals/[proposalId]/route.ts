/**
 * BFF GET /api/payroll/proposals/[proposalId]
 *
 * Returns detail for a single change_proposal (wage_line_override kind).
 * Used by the proposal detail page (T5.2).
 *
 * Includes:
 *   - change_proposal row with proposer profile
 *   - activity_trail rows for this proposal (audit panel)
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id derived server-side; proposalId comes from URL path,
 *              not body — the row is then verified against auth.workspaceId (L-0177).
 *   L-0177   — 404 if proposal not found or workspace mismatch (no silent fallback).
 *   ADR-0078 — payroll High-PII; channel pinned to chat.
 *   ADR-0204 — read-only; gate not required (reads are pre-filtered by workspace + RLS).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151) ───────────────────────────────────────────────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json({ ok: false, error: "missing_proposal_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ─── Step 1: Fetch proposal + proposer (L-0177: fail fast on not-found) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: proposalErr } = await (admin as any)
    .from("change_proposal")
    .select(
      [
        "change_proposal_id",
        "workspace_id",
        "status",
        "trigger_entity_type",
        "changes",
        "initiated_by",
        "resolved_by",
        "resolved_at",
        "created_at",
        "profile:initiated_by(profile_id, display_name)",
        "resolver:resolved_by(profile_id, display_name)",
      ].join(", "),
    )
    .eq("change_proposal_id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (proposalErr || !proposal) {
    // L-0177: fail fast — no silent fallback to another workspace
    return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  }

  // Verify kind — this route is for wage_line_override only
  if (proposal.kind !== "wage_line_override") {
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_kind",
        detail: `Expected wage_line_override, got ${proposal.kind}`,
      },
      { status: 422 },
    );
  }

  // ─── Step 2: Fetch activity_trail for this proposal (audit panel) ──────────
  const { data: auditRows } = await admin
    .from("activity_trail")
    .select("id, event_type, actor_id, created_at, metadata")
    .eq("entity_id", proposalId)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    ok: true,
    proposal,
    audit: auditRows ?? [],
  });
}
