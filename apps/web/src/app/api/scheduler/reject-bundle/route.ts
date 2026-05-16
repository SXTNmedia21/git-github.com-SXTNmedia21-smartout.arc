/**
 * BFF POST /api/scheduler/reject-bundle
 *
 * Rejects a pending scheduler bundle proposal. No shifts are created.
 *
 * Mobile-allowed Approve verb per ADR-0133.
 * Chat-only per ADR-0288 — channel pinned to "chat" at BFF.
 *
 * ADR compliance:
 *   ADR-0151 — workspace_id + profile_id server-derived.
 *   ADR-0309 — single UPDATE status='rejected'.
 *   ADR-0134 — ONE emit: scheduler.proposal.rejected.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { rejectCrossOrigin, resolveSchedulerAuth } from "@/app/api/scheduler/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { rejectProposal } from "@smartout/ai/capabilities/scheduler";

export const runtime = "nodejs";

const RequestSchema = z.object({
  change_proposal_id: z.string().uuid("change_proposal_id must be a UUID"),
  reason: z.string().optional(),
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

  const result = await rejectProposal.execute(
    { change_proposal_id: body.change_proposal_id, reason: body.reason },
    {
      workspaceId: auth.workspaceId as Parameters<typeof rejectProposal.execute>[1]["workspaceId"],
      profileId: auth.profileId as Parameters<typeof rejectProposal.execute>[1]["profileId"],
      sessionId: "bff-reject-bundle",
      supabaseAdmin,
      channel: "chat",
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
