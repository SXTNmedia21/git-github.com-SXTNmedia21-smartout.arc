/**
 * BFF /api/availability/clear — employee removes their own availability
 * rule by id. See /api/availability/set for full invariants.
 *
 * Capability: availability.clear_own (seeded autonomous / employee).
 * Ownership is defence-in-depth: BFF binds `profile_id = auth.profileId`
 * in the DELETE filter AND the `employee_availability` RLS UPDATE/DELETE
 * policy enforces "profile_id belongs to auth.uid()" independently.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import {
  createUserClient,
  rejectCrossOrigin,
  resolveAvailabilityAuth,
} from "@/app/api/availability/_shared";

const RequestSchema = z.object({
  availability_id: z.string().uuid(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  const auth = await resolveAvailabilityAuth(request);
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
    capability: "availability.clear_own",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "delete",
    entityId: body.availability_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // Delete via JWT-scoped client with explicit profile_id filter (BFF
  // ownership guard) — table RLS is the second line of defence.
  const userClient = createUserClient(auth.accessToken);
  const { error, count } = await userClient
    .from("employee_availability")
    .delete({ count: "exact" })
    .eq("id", body.availability_id)
    .eq("profile_id", auth.profileId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "delete_error" },
      { status: 500 },
    );
  }

  if ((count ?? 0) === 0) {
    // Either the id doesn't exist, belongs to someone else, or RLS
    // silently filtered it. Don't leak which.
    return NextResponse.json({ ok: false, error: "not_found_or_forbidden" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    availability_id: body.availability_id,
    surface: auth.surface,
  });
}
