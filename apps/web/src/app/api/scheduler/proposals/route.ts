/**
 * BFF GET /api/scheduler/proposals
 *
 * Inbox of pending scheduler bundle proposals for the authenticated workspace.
 * Filtered to kind='scheduler_bundle' only.
 *
 * Read-only. No gate evaluation required (read-only capability default).
 * Returns proposals ordered by created_at DESC (newest first).
 *
 * ADR-0151 — workspace_id server-derived from JWT.
 * ADR-0309 — kind='scheduler_bundle' filter.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolveSchedulerAuth } from "@/app/api/scheduler/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

const QuerySchema = z.object({
  workspace_id: z.string().uuid().optional(),
  status: z.enum(["pending", "applied", "rejected"]).optional().default("pending"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // Parse query params
  const url = new URL(request.url);
  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(Object.fromEntries(url.searchParams));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", detail: String(err) },
      { status: 400 },
    );
  }

  const auth = await resolveSchedulerAuth(request, query.workspace_id);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const admin = createAdminClient();

  // Fetch scheduler bundle proposals — workspace-scoped (Law 1).
  // Column names per database.types.ts: initiated_by (not proposed_by).
  const { data, error } = await admin
    .from("change_proposal")
    .select("change_proposal_id, kind, status, trigger_type, initiated_by, created_at, changes")
    .eq("workspace_id", auth.workspaceId)
    .eq("kind", "scheduler_bundle") // ADR-0309: only scheduler bundles
    .eq("status", query.status)
    .order("created_at", { ascending: false })
    .limit(query.limit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "fetch_failed", detail: error.message },
      { status: 500 },
    );
  }

  // Extract summary fields from JSONB for the list view (avoid sending full proposed_shifts[]).
  const proposals = (data ?? []).map((p) => {
    const changes = p.changes as {
      solver_version?: string;
      solver_run_id?: string;
      objective_score?: number;
      gap_count?: number;
      proposed_shifts?: unknown[];
    } | null;

    return {
      change_proposal_id: p.change_proposal_id,
      kind: p.kind,
      status: p.status,
      trigger_type: p.trigger_type,
      initiated_by: p.initiated_by,
      created_at: p.created_at,
      solver_version: changes?.solver_version ?? null,
      solver_run_id: changes?.solver_run_id ?? null,
      objective_score: changes?.objective_score ?? null,
      gap_count: changes?.gap_count ?? null,
      proposed_shift_count: changes?.proposed_shifts?.length ?? null,
    };
  });

  return NextResponse.json({ ok: true, proposals });
}
