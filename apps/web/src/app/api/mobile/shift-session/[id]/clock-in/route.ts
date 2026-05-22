/**
 * POST /api/mobile/shift-session/[id]/clock-in
 *
 * Mobile BFF — employee clocks in to a shift_session.
 *
 * Sets shift_session.status = 'clocked_in' and clocked_in_at = now().
 * Identity is ALWAYS derived server-side from the Bearer JWT (ADR-0151).
 * Body MUST be empty — strict schema rejects any unknown keys (ADR-0151).
 * Emits "shift_session.clocked_in" (4 destinations: posthog, logger,
 * activity_trail, engine_event) per registry (ADR-0134).
 *
 * Ownership guard: the resolved profile_id must match shift_session.employee_id.
 * A mismatch returns 403 — employees can only clock in to their own session.
 *
 * References: ADR-0132, ADR-0133, ADR-0134, ADR-0151, ADR-0367.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveMobileActor } from "../../../_shared/actor";

export const runtime = "nodejs";

// Strict empty-body schema — rejects ALL unknown keys per ADR-0151.
const RequestSchema = z.object({}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Validate path param.
  const { id: sessionId } = await params;
  if (!z.string().uuid().safeParse(sessionId).success) {
    return NextResponse.json({ ok: false, error: "Ugyldig sesjon-ID" }, { status: 422 });
  }

  // 2. Bearer auth — identity ALWAYS server-derived from JWT (ADR-0151).
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fail-fast on empty identity (ADR-0134 / L-0177 — never pass "" to emit()).
  if (!actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  // 3. Parse body — strict empty object.
  let bodyRaw: unknown = {};
  try {
    const text = await request.text();
    bodyRaw = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 422 });
  }
  const parsed = RequestSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    const path = parsed.error.errors[0]?.path.join(".") ?? "ukjent";
    return NextResponse.json(
      { ok: false, error: `Body inneholder ulovlige felt: ${path}` },
      { status: 422 },
    );
  }

  const admin = createAdminClient();

  // 4. Load the shift_session row — verify ownership + current status.
  const { data: session, error: fetchErr } = await admin
    .from("shift_session")
    .select("shift_session_id, employee_id, workspace_id, status")
    .eq("shift_session_id", sessionId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[mobile/shift-session/clock-in] fetch error:", fetchErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sesjon ikke funnet" }, { status: 404 });
  }

  // Ownership guard: employee can only clock in to their own session (ADR-0151).
  if (session.employee_id !== actor.profileId) {
    return NextResponse.json(
      { ok: false, error: "Ikke autorisert — session tilhører annen ansatt" },
      { status: 403 },
    );
  }

  // Workspace scope guard.
  if (session.workspace_id !== actor.workspaceId) {
    return NextResponse.json(
      { ok: false, error: "Ikke autorisert — session tilhører annet arbeidsrom" },
      { status: 403 },
    );
  }

  // Idempotency: already clocked in → return success with current state.
  if (session.status === "clocked_in") {
    return NextResponse.json({ ok: true, shiftSessionId: sessionId, alreadyClockedIn: true });
  }

  // Guard: only 'scheduled' sessions may clock in.
  if (session.status !== "scheduled") {
    return NextResponse.json(
      { ok: false, error: `Kan ikke stemple inn — status er '${session.status}'` },
      { status: 422 },
    );
  }

  // 5. Mutate: set status + clocked_in_at.
  const clockedInAt = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("shift_session")
    .update({ status: "clocked_in", clocked_in_at: clockedInAt })
    .eq("shift_session_id", sessionId)
    .eq("status", "scheduled"); // optimistic lock: guard against a concurrent clock-in

  if (updateErr) {
    console.error("[mobile/shift-session/clock-in] update error:", updateErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // 6. Emit (ADR-0134): ONCE, after write, nested entity shape.
  // workspace_id + actor_id are non-empty (verified by resolveMobileActor + fail-fast above).
  await emit({
    event: "shift_session.clocked_in",
    workspace_id: nonEmpty(actor.workspaceId, "workspaceId"),
    actor_id: nonEmpty(actor.profileId, "profileId"),
    properties: {
      entity: {
        entity_type: "shift_session",
        entity_id: sessionId,
      },
      data: {
        shift_session_id: sessionId,
        clocked_in_at: clockedInAt,
      },
    },
  });

  return NextResponse.json({ ok: true, shiftSessionId: sessionId, clocked_in_at: clockedInAt });
}
