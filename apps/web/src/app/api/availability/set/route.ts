/**
 * BFF /api/availability/set — employee sets an availability rule on self
 * (hard rule into `employee_availability`). Mobile MUST route through
 * this endpoint (ADR-0132). Web hooks route here too — one canonical path.
 *
 * Auth: dual path — cookie (web) or Bearer (mobile).
 *
 * Invariants:
 *   - ADR-0151 / ADR-0176 Invariant 3: workspace_id + profile_id are
 *     server-derived; body MUST NOT carry identity fields.
 *   - ADR-0132: mobile never calls capabilities / tables directly.
 *   - ADR-0201: every availability mutation is gated by
 *     `gate_action('availability.set_own', ...)` (seeded in Task H).
 *   - ADR-0202: availability.set_own is voice-OK; this route pins
 *     channel='chat' because it is the explicit chat/mobile-UI surface.
 *     The voice path lives in the capability tool itself.
 *
 * Defence-in-depth: BFF gates via gate_action then writes via a JWT-scoped
 * user client — `employee_availability` RLS enforces "profile_id belongs
 * to auth.uid()" independently (Sortie 1 pattern).
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

// Schema omits identity fields (ADR-0176 Invariant 3). `valid_from` is the
// only required date — `valid_to` null = indefinite, per migration
// contract.
const RequestSchema = z.object({
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "valid_from must be ISO date"),
  valid_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "valid_to must be ISO date")
    .nullable()
    .optional(),
  rrule: z.string().max(2000).nullable().optional(),
  preference_type: z.enum(["unavailable", "preferred", "blocked"]),
  reason: z.string().max(2000).nullable().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 0. Same-origin guard.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie or Bearer; derive workspace + profile server-side.
  const auth = await resolveAvailabilityAuth(request);
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

  // 3. C4 authority gate (ADR-0099 / ADR-0201). Channel is "chat" because
  // this is the UI path; voice path lives in the capability tool.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "availability.set_own",
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

  // 4. Write via JWT-scoped client — table RLS re-verifies profile
  // ownership independently (defence-in-depth).
  const userClient = createUserClient(auth.accessToken);
  const { data, error } = await userClient
    .from("employee_availability")
    .insert({
      workspace_id: auth.workspaceId,
      profile_id: auth.profileId,
      valid_from: body.valid_from,
      valid_to: body.valid_to ?? null,
      rrule: body.rrule ?? null,
      preference_type: body.preference_type,
      reason: body.reason ?? null,
      created_by: auth.profileId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message ?? "insert_error" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    availability_id: data?.id ?? null,
    surface: auth.surface,
  });
}
