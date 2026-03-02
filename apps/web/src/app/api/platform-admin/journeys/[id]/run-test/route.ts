// ============================================
// route.ts — Journey Test Runner
// POST: Receives test results from an automated agent or manual test,
// logs them to journey_test_run, updates journey metadata,
// and optionally transitions the journey status.
// Connected to: apps/web/src/lib/journey/status-transitions.ts (state machine)
// Connected to: apps/web/src/lib/platform-admin.ts (godmode check)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@smartout/supabase";
import type { JourneyStatus } from "@smartout/types";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { isValidTransition } from "@/lib/journey/status-transitions";

const TestRunRequestSchema = z.object({
  result: z.enum(["pass", "fail", "skip"]),
  duration_ms: z.number().int().nonnegative().optional(),
  error_message: z.string().optional(),
  test_output: z.record(z.unknown()).optional(),
  test_type: z.enum(["automated", "manual"]).default("automated"),
  auto_transition: z.boolean().default(true),
});

type Props = { params: Promise<{ id: string }> };

/**
 * Receives test results and logs them to journey_test_run.
 * Updates journey.last_test_result and journey.last_test_run_at.
 * Optionally auto-transitions the journey status on passing results.
 *
 * Status transitions on pass + auto_transition:
 * - automated: ready_test -> testing, or testing -> ready_validation
 * - manual: ready_validation -> implemented
 *
 * @param request - POST body matching TestRunRequestSchema
 * @param params - Route params with journey ID
 * @returns The test run record + transition details
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
  let body: z.infer<typeof TestRunRequestSchema>;
  try {
    body = TestRunRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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

  const now = new Date().toISOString();
  const currentStatus = journey.status as JourneyStatus;

  // 1. Insert test run record
  const { data: testRun, error: insertError } = await admin
    .from("journey_test_run")
    .insert({
      journey_id: id,
      workspace_id: journey.workspace_id,
      result: body.result as never,
      duration_ms: body.duration_ms ?? null,
      error_message: body.error_message ?? null,
      test_output: (body.test_output as Json) ?? null,
      triggered_by: superAdminId,
      test_type: body.test_type as never,
    })
    .select()
    .single();

  if (insertError || !testRun) {
    console.error(`[journey-run-test] Insert test run failed for journey ${id}:`, insertError);
    return NextResponse.json({ error: "Failed to insert test run" }, { status: 500 });
  }

  // 2. Update journey metadata
  const { error: updateError } = await admin
    .from("journey")
    .update({
      last_test_result: body.result as never,
      last_test_run_at: now,
    })
    .eq("journey_id", id);

  if (updateError) {
    console.error(`[journey-run-test] Update journey metadata failed for ${id}:`, updateError);
  }

  // 3. Log test_run event
  const { error: eventError } = await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "test_run" as never,
    actor_id: superAdminId,
    metadata: {
      result: body.result,
      test_type: body.test_type,
      duration_ms: body.duration_ms ?? null,
      error_message: body.error_message ?? null,
    } as unknown as Json,
  });

  if (eventError) {
    console.error(`[journey-run-test] Event logging failed for journey ${id}:`, eventError);
  }

  // 4. Auto-transition on pass
  let transitioned = false;
  let fromStatus: JourneyStatus | null = null;
  let toStatus: JourneyStatus | null = null;

  if (body.result === "pass" && body.auto_transition) {
    // Determine target status based on test type and current status
    let targetStatus: JourneyStatus | null = null;

    if (body.test_type === "automated") {
      if (currentStatus === "ready_test") {
        targetStatus = "testing";
      } else if (currentStatus === "testing") {
        targetStatus = "ready_validation";
      }
    } else if (body.test_type === "manual") {
      if (currentStatus === "ready_validation") {
        targetStatus = "implemented";
      }
    }

    if (targetStatus && isValidTransition(currentStatus, targetStatus)) {
      const { error: transitionError } = await admin
        .from("journey")
        .update({ status: targetStatus as never })
        .eq("journey_id", id);

      if (!transitionError) {
        transitioned = true;
        fromStatus = currentStatus;
        toStatus = targetStatus;

        // Log status_change event for the transition
        const { error: transitionEventError } = await admin.from("journey_event").insert({
          journey_id: id,
          workspace_id: journey.workspace_id,
          event_type: "status_change" as never,
          from_status: currentStatus as never,
          to_status: targetStatus as never,
          actor_id: superAdminId,
        });

        if (transitionEventError) {
          console.error(
            `[journey-run-test] Transition event logging failed for journey ${id}:`,
            transitionEventError,
          );
        }
      } else {
        console.error(
          `[journey-run-test] Status transition failed for journey ${id}:`,
          transitionError,
        );
      }
    }
  }

  return NextResponse.json({
    test_run: testRun,
    transition: transitioned ? { from_status: fromStatus, to_status: toStatus } : null,
  });
}
