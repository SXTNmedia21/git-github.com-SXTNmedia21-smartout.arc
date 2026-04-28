/**
 * BFF /api/availability/me — employee reads their own availability rules.
 * Separate from /api/availability/query (which gates on
 * `availability.query_others` and is for managers looking at peers).
 *
 * No gate_action call here — reading one's own availability is always
 * allowed. RLS on `employee_availability` (JWT SELECT policy) enforces
 * the scope via `profile_id IN (profile WHERE user_id = auth.uid())`;
 * the BFF adds an explicit `profile_id = auth.profileId` filter on top
 * for belt-and-braces.
 *
 * Query params:
 *   - start (YYYY-MM-DD, optional, default=today)
 *   - end   (YYYY-MM-DD, optional, default=today+60d)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createUserClient,
  rejectCrossOrigin,
  resolveAvailabilityAuth,
} from "@/app/api/availability/_shared";

export const runtime = "nodejs";

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  const auth = await resolveAvailabilityAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const startRaw = url.searchParams.get("start");
  const endRaw = url.searchParams.get("end");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in60 = new Date(today);
  in60.setDate(today.getDate() + 60);

  const start = startRaw && DATE_RE.test(startRaw) ? startRaw : isoDate(today);
  const end = endRaw && DATE_RE.test(endRaw) ? endRaw : isoDate(in60);

  const userClient = createUserClient(auth.accessToken);

  const { data, error } = await userClient
    .from("employee_availability")
    .select(
      "id, workspace_id, profile_id, valid_from, valid_to, rrule, preference_type, reason, created_at, updated_at, created_by",
    )
    .eq("workspace_id", auth.workspaceId)
    .eq("profile_id", auth.profileId)
    .lte("valid_from", end)
    .or(`valid_to.is.null,valid_to.gte.${start}`)
    .order("valid_from", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "query_error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    rows: data ?? [],
    start,
    end,
    surface: auth.surface,
  });
}
