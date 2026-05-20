/**
 * BFF POST /api/scheduler/accept-bundle
 *
 * Atomic all-or-nothing accept of a pending scheduler bundle proposal.
 * Inserts all proposed_shifts and marks the change_proposal as applied.
 *
 * Scoped per supervisor "one capability one BFF" verdict (ADR-0309 §BFF).
 * NOT a generalized /api/proposals/accept-bundle — scheduler-specific only.
 *
 * Mobile-allowed Approve verb per ADR-0133. Both web + mobile surfaces call this.
 * Chat-only per ADR-0288 — channel pinned to "chat" at BFF.
 *
 * ADR compliance:
 *   ADR-0151 — workspace_id + profile_id server-derived.
 *   ADR-0309 — atomic accept: one UPDATE + N INSERT in single exec callback.
 *   ADR-0134 — ONE emit per accept (scheduler.proposal.accepted).
 *   L-0177   — 404 on proposal not found; 409 on wrong status.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolveSchedulerAuth } from "@/app/api/scheduler/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { acceptProposal } from "@smartout/ai/capabilities/scheduler";

export const runtime = "nodejs";

const RequestSchema = z.object({
  change_proposal_id: z.string().uuid("change_proposal_id must be a UUID"),
  workspace_id: z.string().uuid().optional(),
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

  const auth = await resolveSchedulerAuth(request, body.workspace_id);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const supabaseAdmin = createAdminClient();

  const result = await acceptProposal.execute(
    { change_proposal_id: body.change_proposal_id },
    {
      workspaceId: auth.workspaceId as Parameters<typeof acceptProposal.execute>[1]["workspaceId"],
      profileId: auth.profileId as Parameters<typeof acceptProposal.execute>[1]["profileId"],
      sessionId: "bff-accept-bundle",
      supabaseAdmin,
      channel: "chat", // ADR-0288: pinned to chat at BFF
    },
  );

  const isError = result.startsWith("Feil") || result.startsWith("Ikke tillatt");
  if (isError) {
    return NextResponse.json(
      { ok: false, error: result },
      { status: result.includes("Ikke tillatt") ? 403 : 500 },
    );
  }

  return NextResponse.json({ ok: true, message: result });
}
