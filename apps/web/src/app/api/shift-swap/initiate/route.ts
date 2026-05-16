/**
 * BFF /api/shift-swap/initiate — employee requests a shift swap with a
 * colleague. Mobile MUST route through this endpoint (ADR-0132). Web hooks
 * route through here too to keep one canonical swap path.
 *
 * Auth: dual path — cookie (web) or Bearer (mobile).
 *
 * Invariants:
 *   - ADR-0151 / ADR-0176 (Invariant 3): workspace_id + profile_id are
 *     server-derived from the authenticated user; the request body MUST NOT
 *     carry identity fields.
 *   - ADR-0132: mobile never calls capabilities/RPCs directly.
 *   - ADR-0201 / Trust Gate 2026-04-23: every shift_swap mutation is gated
 *     by `gate_action('shift_swap.request', ...)` (seeded by
 *     20260518100000_seed_shift_swap_authority.sql).
 *   - ADR-0078: shift_swap is chat-only. Routes pin channel='chat'; there
 *     is no voice path.
 *
 * The underlying RPC `initiate_shift_swap` is SECURITY DEFINER and reads
 * `auth.uid()`. We call it via a JWT-scoped client (not the service-role
 * admin client) so the DB sees the user identity.
 *
 * NOTE on telemetry: emit() is intentionally NOT wired here. Task D of the
 * shift-swap-harness sortie renames the registry events to dot-form and
 * wires emit() at a single point. Hooks keep their existing onSuccess
 * emit() until that task lands — no regression.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import {
  createUserClient,
  rejectCrossOrigin,
  resolveShiftSwapAuth,
} from "@/app/api/shift-swap/_shared";
import { PipelineLockHeldError } from "@smartout/ai/engine/authority-pipeline";

// No identity fields allowed in the body (ADR-0176 Invariant 3).
const RequestSchema = z.object({
  requester_shift_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),
  target_shift_id: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 0. Same-origin guard.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie or Bearer; derive workspace + profile server-side.
  const auth = await resolveShiftSwapAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // 3. C4 authority gate (ADR-0099 / ADR-0201). `channel` pinned to "chat"
  // per ADR-0078 — shift_swap has no voice path.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "shift_swap.request",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "request",
    entityId: body.requester_shift_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // 4. Call SECURITY DEFINER RPC via JWT-scoped client so `auth.uid()`
  // inside the function matches the caller. Keeps the RPC's own ownership
  // + workspace checks intact.
  //
  // Pipeline lock contention (PipelineLockHeldError / ADR-0340) surfaces here
  // as either a thrown Error from the capability layer or an RPC error message
  // carrying the canonical code. Both are mapped to 409 PIPELINE_LOCK_HELD
  // (ADR-0328) so clients can distinguish contention from generic 5xx.
  try {
    const userClient = createUserClient(auth.accessToken);
    const { data, error } = await userClient.rpc(
      "initiate_shift_swap" as never,
      {
        p_requester_shift_id: body.requester_shift_id,
        p_target_profile_id: body.target_profile_id,
        p_target_shift_id: body.target_shift_id,
        p_reason: body.reason ?? null,
      } as never,
    );

    if (error) {
      if (isLockHeldMessage(error.message)) {
        return pipelineLockResponse("shift_swap_lifecycle");
      }
      return NextResponse.json({ ok: false, error: error.message ?? "rpc_error" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      swap_id: data as string | null,
      surface: auth.surface,
    });
  } catch (err) {
    if (err instanceof PipelineLockHeldError) {
      return pipelineLockResponse("shift_swap_lifecycle");
    }
    if (err instanceof Error && isLockHeldMessage(err.message)) {
      return pipelineLockResponse("shift_swap_lifecycle");
    }
    throw err;
  }
}

// ── Pipeline lock helpers (ADR-0328) ────────────────────────────────────────

/** Returns true for error messages that signal a held pipeline lock. */
function isLockHeldMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return (
    msg.includes("PIPELINE_LOCK_HELD") ||
    msg.includes("pipeline_lock_held") ||
    msg.includes("Pipeline lock is already held")
  );
}

/** Structured 409 response for pipeline lock contention (ADR-0328). */
function pipelineLockResponse(lockingBlueprintId: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: "PIPELINE_LOCK_HELD",
      locking_blueprint_id: lockingBlueprintId,
    },
    { status: 409 },
  );
}
