// ============================================
// route.ts — Journey Status Transition
// POST: Validates and applies a status transition for a journey,
// logging the change as a journey_event for the audit trail.
// Connected to: apps/web/src/lib/journey/status-transitions.ts (state machine)
// Connected to: apps/web/src/lib/platform-admin.ts (godmode check)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { JourneyStatus } from "@smartout/types";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { isValidTransition, getValidTransitions } from "@/lib/journey/status-transitions";

const JOURNEY_STATUSES = [
  "idea",
  "wizard",
  "defined",
  "ready_impl",
  "building",
  "review",
  "ready_test",
  "testing",
  "ready_validation",
  "implemented",
  "active",
  "inactive",
  "broken",
] as const;

const TransitionRequestSchema = z.object({
  newStatus: z.enum(JOURNEY_STATUSES),
});

type Props = { params: Promise<{ id: string }> };

/**
 * Applies a status transition to a journey.
 * Requires godmode access. Validates the transition against the
 * state machine, updates the journey, and logs a status_change event.
 *
 * @param request - POST body with { newStatus: string }
 * @param params - Route params with journey ID
 * @returns The transition result { journey_id, from_status, to_status }
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  // Auth: require godmode
  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse and validate request body
  let body: z.infer<typeof TransitionRequestSchema>;
  try {
    body = TransitionRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const newStatus = body.newStatus satisfies JourneyStatus;
  const admin = createAdminClient();

  // Load the current journey
  const { data: journey, error: fetchError } = await admin
    .from("journey")
    .select("journey_id, workspace_id, status")
    .eq("journey_id", id)
    .single();

  if (fetchError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const currentStatus = journey.status as JourneyStatus;

  // Validate the transition against the state machine
  if (!isValidTransition(currentStatus, newStatus)) {
    const validTargets = getValidTransitions(currentStatus);
    return NextResponse.json(
      {
        error: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
        valid_transitions: validTargets,
      },
      { status: 422 },
    );
  }

  // Update the journey status
  const { error: updateError } = await admin
    .from("journey")
    .update({ status: newStatus as never })
    .eq("journey_id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update journey status" }, { status: 500 });
  }

  // Insert a status_change event for the audit trail (non-blocking)
  const { error: eventError } = await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "status_change" as never,
    from_status: currentStatus as never,
    to_status: newStatus as never,
    actor_id: superAdminId,
  });
  if (eventError) {
    console.error(`[journey-transition] Event logging failed for journey ${id}:`, eventError);
  }

  return NextResponse.json({
    journey_id: id,
    from_status: currentStatus,
    to_status: newStatus,
  });
}
