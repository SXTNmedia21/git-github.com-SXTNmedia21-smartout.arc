/**
 * BFF /api/shift-swap/cancel — requester cancels their own pending swap.
 * See /api/shift-swap/initiate/route.ts for invariants + rationale.
 *
 * Capability: shift_swap.cancel  (seeded 'confirm' / min_role='employee';
 * ownership-scoped: the RPC itself enforces that only the original
 * requester can cancel).
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
    capability: "shift_swap.cancel",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "cancel",
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
    "cancel_shift_swap" as never,
    {
      p_swap_id: body.swap_id,
    } as never,
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "rpc_error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    swap_id: body.swap_id,
    surface: auth.surface,
  });
}
