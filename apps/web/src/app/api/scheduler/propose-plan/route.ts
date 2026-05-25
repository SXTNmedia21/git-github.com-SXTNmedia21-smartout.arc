/**
 * BFF POST /api/scheduler/propose-plan
 *
 * Triggers the greedy solver on a planning cycle and writes a
 * change_proposal (kind='scheduler_bundle') via the propose_plan capability tool.
 *
 * Scope: web Compose verb per ADR-0133 (propose is web-only — managers
 * authorize a solver run from the dashboard, not from mobile).
 * Chat-only per ADR-0288 — channel pinned to "chat" at BFF.
 *
 * ADR compliance:
 *   ADR-0151 — workspace_id + profile_id server-derived (never from body).
 *   ADR-0307 — greedy V1 propose_plan capability tool called here.
 *   ADR-0309 — one change_proposal row per solver run.
 *   L-0177   — 404 on planning_cycle not found; no silent fallback.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolveSchedulerAuth } from "@/app/api/scheduler/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { proposePlan } from "@smartout/ai/capabilities/scheduler";

export const runtime = "nodejs";

const RequestSchema = z.object({
  planning_cycle_id: z.string().uuid("planning_cycle_id must be a UUID"),
  department_id: z.string().uuid("department_id must be a UUID"),
  workspace_id: z
    .string()
    .uuid()
    .optional()
    .describe("Workspace scope hint (UI-resolved, optional — server re-derives from JWT)"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", detail: String(err) },
      { status: 400 },
    );
  }

  // ── Server-derived identity (ADR-0151) ────────────────────────────────────
  const auth = await resolveSchedulerAuth(request, body.workspace_id);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const supabaseAdmin = createAdminClient();

  // ── Invoke capability tool ─────────────────────────────────────────────────
  // Tool handles its own gate_action + mutateWithGate + emit.
  const result = await proposePlan.execute(
    { planning_cycle_id: body.planning_cycle_id, department_id: body.department_id },
    {
      workspaceId: auth.workspaceId as Parameters<typeof proposePlan.execute>[1]["workspaceId"],
      profileId: auth.profileId as Parameters<typeof proposePlan.execute>[1]["profileId"],
      sessionId: "bff-propose-plan",
      supabaseAdmin,
      channel: "chat", // ADR-0288: pinned to chat at BFF
    },
  );

  // Tool returns a Norwegian string on success or error.
  // Detect error conditions by string prefix.
  const isError =
    result.startsWith("Feil") ||
    result.startsWith("Ikke tillatt") ||
    result.startsWith("propose_plan");

  if (isError) {
    return NextResponse.json(
      { ok: false, error: result },
      { status: isError && result.includes("Ikke tillatt") ? 403 : 500 },
    );
  }

  return NextResponse.json({ ok: true, message: result });
}
