// POST /api/observer-requests — create an observer_request for a protocol assignment
// Task 14 (Phase 1 governance/training MVP). See ADR-0103.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  protocol_assignment_id: z.string().uuid(),
  subject_profile_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

const ALLOWED_ROLES = ["manager", "admin", "owner"] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workspace_id, protocol_assignment_id, subject_profile_id, notes } = parsed.data;

  const { data: callerProfile } = await supabase
    .from("profile")
    .select("role")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id)
    .single();

  if (
    !callerProfile ||
    !ALLOWED_ROLES.includes(callerProfile.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return NextResponse.json(
      { error: "Forbidden: manager, admin, or owner role required" },
      { status: 403 },
    );
  }

  // Verify assignment exists in this workspace — 404 if not found.
  const { data: assignment } = await supabase
    .from("protocol_assignment")
    .select("assignment_id")
    .eq("assignment_id", protocol_assignment_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: "Protocol assignment not found" }, { status: 404 });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("observer_request")
    .insert({
      workspace_id,
      protocol_assignment_id,
      subject_profile_id,
      notes: notes ?? null,
      status: "pending",
    })
    .select("observer_request_id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create observer_request" },
      { status: 500 },
    );
  }

  void emit({
    event: "observer_request created",
    workspace_id,
    actor_id: user.id,
    properties: {
      entity: {
        entity_type: "observer_request" as const,
        entity_id: inserted.observer_request_id,
      },
      data: {
        subject_profile_id,
        protocol_assignment_id,
      },
    },
  });

  return NextResponse.json({ observer_request_id: inserted.observer_request_id }, { status: 201 });
}
