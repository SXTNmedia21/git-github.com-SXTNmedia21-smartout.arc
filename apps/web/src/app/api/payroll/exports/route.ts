/**
 * GET /api/payroll/exports?periodId=<uuid>
 *
 * List recent payroll.export_event rows for a period, workspace-scoped.
 * Returns the last 10 events ordered by started_at DESC.
 *
 * Read-only — no gate_action required. Workspace scope enforced via
 * resolvePayrollAuth (server-derived, never from body — ADR-0151).
 * L-0177 — empty result returns [] (not 404); row-not-found is not an error
 * on a list endpoint.
 * ADR-0133 — web-only authoring surface.
 *
 * Response: JSON array of ExportEventRow.
 *
 * L-0176 compliance: docstring written after body verified.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

export type ExportEventRow = {
  id: string;
  variant: "aggregate" | "audit" | null;
  masked: boolean | null;
  exported_by: string;
  exported_at: string; // started_at from DB — aliased for clarity in UI
  row_count: number | null;
  file_hash: string | null;
  status: string;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151) ──────────────────────────────────────────────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Input validation ──────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get("periodId");

  if (!periodId) {
    return NextResponse.json({ ok: false, error: "periodId is required" }, { status: 400 });
  }

  // ─── Query (read-only, admin client for cross-schema access) ──────────────
  const admin = createAdminClient();

  // Cast to `any` for the Phase 3 columns (variant, masked, row_count, file_hash)
  // that exist in the DB (migration 20260508110000) but are not yet in
  // database.types.ts (types were generated before the local migration ran).
  // Pattern mirrors apply-line-override/route.ts:102 for the same reason.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("payroll") as any)
    .from("export_event")
    .select("id, variant, masked, exported_by, started_at, row_count, file_hash, status")
    .eq("workspace_id", auth.workspaceId)
    .eq("period_id", periodId)
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    const err = error as { message?: string };
    console.error("[payroll/exports] DB error:", err.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // L-0177: empty result → [] (not 404)
  const rows: ExportEventRow[] = ((data as unknown[]) ?? []).map((rawRow) => {
    const row = rawRow as {
      id: string;
      variant: string | null;
      masked: boolean | null;
      exported_by: string;
      started_at: string;
      row_count: number | null;
      file_hash: string | null;
      status: string;
    };
    return {
      id: row.id,
      variant: (row.variant as "aggregate" | "audit" | null) ?? null,
      masked: row.masked ?? null,
      exported_by: row.exported_by,
      exported_at: row.started_at, // alias for UI clarity
      row_count: row.row_count ?? null,
      file_hash: row.file_hash ?? null,
      status: row.status,
    };
  });

  return NextResponse.json(rows);
}
