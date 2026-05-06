/**
 * BFF /api/availability/query — team/peer availability lookup for
 * schedulers and managers. See /api/availability/set for full
 * invariants.
 *
 * Capability: availability.query_others (seeded read_only / employee,
 * chat-only per ADR-0202). Employees can read their own rows via the
 * JWT RLS SELECT policy; this endpoint is the explicit "look at others"
 * surface that managers use when planning.
 *
 * Body omits workspace_id — it is re-derived from the session per
 * ADR-0176 Invariant 3. `profile_ids` is an optional filter; empty/
 * omitted = whole workspace (bounded by RLS's SELECT policy, which
 * allows anyone in the workspace to read peer availability rows).
 *
 * This is POST (not GET) because the input is a structured filter
 * (arrays, ranges) and we want body-based schema validation; REST
 * purity yields to ergonomics here.
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
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be ISO date"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be ISO date"),
  profile_ids: z.array(z.string().uuid()).max(500).optional(),
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

  // Chat-only per ADR-0202. Voice surface for this capability does not
  // exist (forbidden — PII concerns on peer availability reasons).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "availability.query_others",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "query",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  const userClient = createUserClient(auth.accessToken);

  // Query rows that OVERLAP the [start_date, end_date] window. A row is in
  // scope when its `valid_from <= end_date` AND (valid_to IS NULL OR
  // valid_to >= start_date). Workspace scope is implicit via RLS + an
  // explicit eq() for belt-and-braces.
  let query = userClient
    .from("employee_availability")
    .select(
      "id, workspace_id, profile_id, valid_from, valid_to, rrule, preference_type, reason, created_at, updated_at, created_by",
    )
    .eq("workspace_id", auth.workspaceId)
    .lte("valid_from", body.end_date)
    .or(`valid_to.is.null,valid_to.gte.${body.start_date}`)
    .order("valid_from", { ascending: true })
    .limit(2000);

  if (body.profile_ids && body.profile_ids.length > 0) {
    query = query.in("profile_id", body.profile_ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "query_error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    rows: data ?? [],
    surface: auth.surface,
  });
}
