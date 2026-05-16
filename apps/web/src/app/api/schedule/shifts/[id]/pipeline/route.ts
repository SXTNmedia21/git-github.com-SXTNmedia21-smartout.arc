/**
 * GET /api/schedule/shifts/[id]/pipeline
 *
 * Lightweight lookup for the shift-card pipeline-lock indicator (U2).
 * Returns the pipeline instance bound to a shift via `pipeline_lock_state_id`,
 * or `{ pipeline: null }` when no pipeline is active on the shift.
 *
 * Auth (ADR-0132 + ADR-0151):
 *   - Cookie session (web) OR Bearer JWT (mobile) — dual-auth via getServerContext.
 *   - workspace_id is NEVER accepted from query params or request body;
 *     it is derived server-side from the validated session (ADR-0151 fail-fast).
 *
 * Access level:
 *   - ALL workspace members (employee+) may read — this is a UI indicator
 *     visible to every shift participant, not an admin-only surface.
 *
 * Security (ADR-0151 / L-0177):
 *   - 404 on shift not found OR cross-workspace shift ID — never leaks
 *     existence of shifts belonging to other workspaces.
 *
 * Response shape:
 *   { pipeline: null }                                — no active pipeline
 *   { pipeline: { pipeline_instance_id, blueprint_id, status } }
 *
 * Caching:
 *   Cache-Control: max-age=10, s-maxage=10 — pipeline state changes
 *   infrequently at human timescales; 10 s is safe for UI polling.
 *
 * References:
 *   ADR-0132 (mobile thin-client, dual-auth)
 *   ADR-0151 (server-derived workspace_id + profile_id)
 *   L-0177   (no silent workspace fallback)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServerContext } from "@/lib/auth/get-server-context";

// ── Response schema ───────────────────────────────────────────────────────────

const PipelineInfoSchema = z.object({
  pipeline_instance_id: z.string().uuid(),
  blueprint_id: z.string(),
  status: z.string(),
});

const PipelineResponseSchema = z.object({
  pipeline: PipelineInfoSchema.nullable(),
});

export type PipelineInfo = z.infer<typeof PipelineInfoSchema>;
export type PipelineResponse = z.infer<typeof PipelineResponseSchema>;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // ── Auth: cookie (web) or Bearer (mobile) ─────────────────────────────────
  const ctx = await getServerContext(req);
  if (!ctx) {
    return NextResponse.json(
      { error: "unauthorized", reason: "Authentication required" },
      { status: 401 },
    );
  }
  if (!ctx.profile) {
    return NextResponse.json(
      { error: "forbidden", reason: "No active profile for this user" },
      { status: 403 },
    );
  }

  const { workspace_id: workspaceId } = ctx.profile;
  const { id: shiftId } = await params;

  const admin = createAdminClient();

  // ── Step 1: read schedule_shift, scoped to workspace (ADR-0151) ───────────
  // A cross-workspace ID or a non-existent ID both return 404 — never reveal
  // whether the shift exists outside this workspace (L-0177 / ADR-0151).
  const { data: shift, error: shiftErr } = await admin
    .from("schedule_shift")
    .select("schedule_shift_id, pipeline_lock_state_id")
    .eq("schedule_shift_id", shiftId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (shiftErr) {
    console.error("[shifts/pipeline] DB error on shift lookup:", shiftErr.message);
    return NextResponse.json(
      { error: "db_error", reason: "Failed to look up shift" },
      { status: 500 },
    );
  }

  if (!shift) {
    // 404 for both "not found" and "cross-workspace" — consistent non-disclosure.
    return NextResponse.json({ error: "not_found", reason: "Shift not found" }, { status: 404 });
  }

  // ── Step 2: no pipeline lock → return early ───────────────────────────────
  if (!shift.pipeline_lock_state_id) {
    const body: PipelineResponse = { pipeline: null };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "max-age=10, s-maxage=10" },
    });
  }

  // ── Step 3: read the engine_state row for the locked pipeline ────────────
  // engine_state.workspace_id may be null (platform-level processes) so we
  // look up by id only; workspace scope is already enforced via the shift row
  // above — the FK guarantees the engine_state belongs to the same workspace.
  const { data: engineState, error: stateErr } = await admin
    .from("engine_state")
    .select("id, process_id, status")
    .eq("id", shift.pipeline_lock_state_id)
    .maybeSingle();

  if (stateErr) {
    console.error("[shifts/pipeline] DB error on engine_state lookup:", stateErr.message);
    return NextResponse.json(
      { error: "db_error", reason: "Failed to look up pipeline state" },
      { status: 500 },
    );
  }

  if (!engineState) {
    // pipeline_lock_state_id points to a deleted/missing state — treat as unlocked.
    const body: PipelineResponse = { pipeline: null };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "max-age=10, s-maxage=10" },
    });
  }

  // ── Build response ────────────────────────────────────────────────────────
  const pipeline: PipelineInfo = {
    pipeline_instance_id: engineState.id,
    blueprint_id: engineState.process_id,
    status: engineState.status,
  };

  const body: PipelineResponse = PipelineResponseSchema.parse({ pipeline });

  return NextResponse.json(body, {
    headers: { "Cache-Control": "max-age=10, s-maxage=10" },
  });
}
