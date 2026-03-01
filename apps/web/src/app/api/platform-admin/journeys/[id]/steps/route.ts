// ============================================
// route.ts — Journey Steps Bulk Replace
// PUT: Replaces all steps for a journey in one operation.
// Deletes existing steps, inserts new ones with correct step_order.
// Connected to: journey_step, journey_event tables
// Connected to: apps/web/src/lib/platform-admin.ts (getSuperAdminId)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

const StepSchema = z.object({
  title: z.string().min(1),
  action: z.string().min(1),
  expects: z.string().nullable().optional(),
  screen: z.string().nullable().optional(),
  component: z.string().nullable().optional(),
  data_reads: z.array(z.string()).optional(),
  data_writes: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

const PutSchema = z.object({
  steps: z.array(StepSchema),
});

type Props = { params: Promise<{ id: string }> };

/**
 * Replaces ALL steps for a journey in a single bulk operation.
 * Deletes existing steps, inserts new ones with correct step_order (1-based).
 */
export async function PUT(request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof PutSchema>;
  try {
    body = PutSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify journey exists and get workspace_id
  const { data: journey, error: fetchError } = await admin
    .from("journey")
    .select("journey_id, workspace_id")
    .eq("journey_id", id)
    .single();

  if (fetchError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  // Delete all existing steps for this journey
  const { error: deleteError } = await admin.from("journey_step").delete().eq("journey_id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete existing steps" }, { status: 500 });
  }

  // Build new step rows with correct step_order (1-based)
  const stepRows = body.steps.map((step, index) => ({
    journey_id: id,
    workspace_id: journey.workspace_id,
    step_order: index + 1,
    title: step.title,
    action: step.action,
    expects: step.expects ?? null,
    screen: step.screen ?? null,
    component: step.component ?? null,
    data_reads: step.data_reads ?? [],
    data_writes: step.data_writes ?? [],
    notes: step.notes ?? null,
  }));

  // Insert new steps — if this fails after delete, we have partial data loss.
  // Log clearly so the admin knows to retry.
  const { data: insertedSteps, error: insertError } = await admin
    .from("journey_step")
    .insert(stepRows)
    .select("*");

  if (insertError) {
    console.error(`[journey-steps] Insert failed after delete for journey ${id}:`, insertError);
    return NextResponse.json(
      { error: "Failed to insert steps after deleting old ones. Please retry with the same data." },
      { status: 500 },
    );
  }

  // Log the edit event (non-blocking — audit failure shouldn't break the operation)
  const { error: eventError } = await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "edit" as never,
    actor_id: superAdminId,
    metadata: { changed: "steps", step_count: body.steps.length },
  });
  if (eventError) {
    console.error(`[journey-steps] Event logging failed for journey ${id}:`, eventError);
  }

  return NextResponse.json({ steps: insertedSteps ?? [] });
}
