/**
 * BFF /api/shift-swap/respond — target employee accepts or rejects a swap.
 * See /api/shift-swap/initiate/route.ts for invariants + rationale.
 *
 * Capability: shift_swap.respond  (seeded 'suggest' / min_role='employee').
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

const RequestSchema = z.object({
  swap_id: z.string().uuid(),
  accepted: z.boolean(),
  reason: z.string().max(2000).optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  const auth = await resolveShiftSwapAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "shift_swap.respond",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: body.accepted ? "accept" : "reject",
    entityId: body.swap_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  const userClient = createUserClient(auth.accessToken);
  const { error } = await userClient.rpc(
    "respond_to_shift_swap" as never,
    {
      p_swap_id: body.swap_id,
      p_accepted: body.accepted,
      p_reason: body.reason ?? null,
    } as never,
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "rpc_error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    swap_id: body.swap_id,
    accepted: body.accepted,
    surface: auth.surface,
  });
}
