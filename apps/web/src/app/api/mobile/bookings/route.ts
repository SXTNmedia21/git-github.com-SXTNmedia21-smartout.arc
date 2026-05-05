/**
 * POST /api/mobile/bookings — create a booking from the mobile AddSheet.
 *
 * ADR-0270 (mobile shift authoring via BFF): mobile is a thin client; all
 * mutation authority flows through this BFF into addBookingAction, never
 * directly to Supabase. workspace_id and profile_id are NEVER accepted from
 * the request body — both are server-derived from the Bearer JWT (ADR-0151).
 *
 * ADR-0267 (booking-PII access control): contact field transit is allowed
 * only on chat or system channels. Voice path is blocked at the action layer
 * as an extra guard; channel is pinned to 'system' here (mobile BFF = system
 * channel per ADR-0132 mobile routing pattern).
 *
 * ADR-0078: voice channel is forbidden for PII. Mobile BFF always sends
 * channel='system' — the action layer validates this.
 *
 * ADR-0134: telemetry is emitted inside addBookingAction — this route does
 * not emit independently.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { z } from "zod";
import { addBookingAction } from "@/app/dashboard/_actions/add-booking-action";

// Request schema. workspace_id and profile_id are NOT accepted from the body
// (ADR-0151 — forgeable IDs). The server resolves them from the Bearer JWT.
const requestSchema = z.object({
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  booking_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM[:SS]"),
  title: z.string().min(1).max(255),
  guest_count: z.number().int().min(1),
  contact: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  // Auth: Bearer token from mobile. createClient() reads the Authorization
  // header via Supabase's SSR helper — returns the user from the JWT.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate request body.
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Derive workspace_id and profile_id server-side from the authenticated JWT.
  // Never accepted from the body (ADR-0151).
  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profileRow) {
    return NextResponse.json({ error: "Forbidden: no active profile" }, { status: 403 });
  }

  // Delegate to the canonical Server Action. channel='system' pins the
  // mobile BFF path — this is correct per ADR-0132 (mobile routes through BFF,
  // channel is system). The action enforces the ADR-0078 voice guard
  // independently; 'system' always passes.
  const result = await addBookingAction(
    {
      shiftDate: parsed.data.shift_date,
      bookingTime: parsed.data.booking_time,
      title: parsed.data.title,
      guestCount: parsed.data.guest_count,
      contact: parsed.data.contact,
      notes: parsed.data.notes,
      channel: "system",
    },
    {
      profileId: profileRow.profile_id,
      workspaceId: profileRow.workspace_id,
      role: profileRow.role ?? null,
    },
  );

  if (!result.ok) {
    // Distinguish auth failures from other errors. gate_action() returns
    // specific denial messages — surface them as 403 so mobile can render
    // appropriate feedback. Explicit cast to the failure branch because
    // cross-module discriminated-union narrowing degrades when module
    // resolution is absent in the typecheck environment (pre-existing
    // node_modules gap). At runtime, the discriminated union is correct.
    const failure = result as { ok: false; error: string; warnings?: string[] };
    const isAuthFailure =
      failure.error.includes("autentisert") || failure.error.includes("autorisert");
    const status = isAuthFailure ? 403 : 422;
    return NextResponse.json({ error: failure.error }, { status });
  }

  return NextResponse.json({ ok: true, booking_id: result.bookingId }, { status: 200 });
}
