/**
 * BFF POST /api/tips/set-pot
 *
 * Registers a tip pool for a department session and triggers distribution
 * calculation. Fronts the `tips.set_pot` capability (suggest/manager).
 *
 * Phase 1 — BFF wire only. The capability body (Phase 2) returns
 * `{ ok: false, error: "not_implemented" }` until Sortie 2 fills it in.
 * The BFF gate runs correctly regardless of skeleton state.
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id are server-derived; body MUST NOT
 *     carry identity fields.
 *   - ADR-0078 / ADR-0163: tips are PII-adjacent payroll data — chat-only,
 *     no voice. Channel is pinned to "chat" at this BFF layer.
 *   - ADR-0099 / ADR-0201: gate_action called before any mutation.
 *   - ADR-0132: mobile routes through this BFF; no direct capability imports.
 *
 * Body schema mirrors `tipsSetPotTool.schema` (packages/ai/src/capabilities/tips/tools.ts).
 * Identity fields (workspace_id, profile_id) are absent from the schema per ADR-0151.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolveTipsAuth } from "@/app/api/tips/_shared";

// Mirrors tipsSetPotTool.schema — no identity fields (ADR-0151).
const RequestSchema = z.object({
  department_session_id: z
    .string()
    .uuid("department_session_id must be a valid UUID"),
  amount_nok: z.number().min(0, "amount_nok must be >= 0"),
  notes: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 0. Same-origin guard.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie (web) or Bearer (mobile). Derives workspace + profile
  //    server-side per ADR-0151. Never trust body for identity.
  const auth = await resolveTipsAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Validate body. No identity fields.
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Invalid request body")
        : "Invalid request body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // 3. C4 authority gate (ADR-0099 / ADR-0201). Channel is "chat" because
  //    tips are PII-adjacent payroll data (ADR-0078 / ADR-0163). Voice
  //    is never permitted for this capability.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "tips.set_pot",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "insert",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // Four-eyes check (Delta 11 from fact-check). Capability default is
  // requires_four_eyes=false; check is here for when admin sets it later.
  if (gate.four_eyes_required) {
    return NextResponse.json(
      {
        ok: false,
        error: "four_eyes_required",
        approvers_needed: gate.approvers_needed,
      },
      { status: 403 },
    );
  }

  // 4. Phase 1: capability body lands in Phase 2 (Sortie 2 tips-leader-flows).
  //    Skeletons return { ok: false, error: "not_implemented" } — BFF passes
  //    this through so the wire is provably connected end-to-end.
  //    Phase 2 replaces this block with the real DB mutation inside the
  //    capability's execute().
  //
  //    NOTE: telemetry (emit) lives in the capability layer, NOT here.
  //    BFF does not emit directly (per harness law 4 — ADR-0134).
  return NextResponse.json(
    {
      ok: false,
      error: "not_implemented",
      note: "Phase 2 (tips-leader-flows) will fill the capability body",
      surface: auth.surface,
    },
    { status: 501 },
  );
}
