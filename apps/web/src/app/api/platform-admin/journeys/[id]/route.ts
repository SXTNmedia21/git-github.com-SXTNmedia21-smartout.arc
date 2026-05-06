// ============================================
// route.ts — Journey CRUD
// GET: Returns journey + steps + events for detail page refresh
// PATCH: Updates editable journey metadata fields
// DELETE: Hard deletes a journey (cascade cleans up related rows)
// Connected to: journey, journey_step, journey_event tables
// Connected to: apps/web/src/lib/platform-admin.ts (getSuperAdminId)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

const uuidSchema = z.string().uuid();

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  module: z
    .enum([
      "core",
      "onboarding",
      "org",
      "scheduling",
      "operations",
      "haccp",
      "training",
      "absence",
      "payroll",
      "communication",
      "reports",
      "settings",
      "ai",
      "season",
      "governance",
      "contracts",
      "certifications",
      "meta",
    ])
    .optional(),
  actor: z.enum(["employee", "trainee", "manager", "admin", "owner", "all"]).optional(),
  platform: z.enum(["mobile", "desktop", "both"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  tags: z.array(z.string()).optional(),
  trigger_description: z.string().nullable().optional(),
  preconditions: z.array(z.string()).optional(),
  test_assertion: z.string().nullable().optional(),
  doc_title: z.string().nullable().optional(),
  outcomes_success: z.string().nullable().optional(),
  outcomes_empty: z.string().nullable().optional(),
  outcomes_error: z.string().nullable().optional(),
  trigger_event: z.string().nullable().optional(),
  step_event_type: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
});

type Props = { params: Promise<{ id: string }> };

/**
 * Returns a journey with its steps and recent events.
 * Used by the detail page for client-side refresh after edits.
 */
export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: journey, error: journeyError }, { data: steps }, { data: events }] =
    await Promise.all([
      admin.from("journey").select("*").eq("journey_id", id).single(),
      admin.from("journey_step").select("*").eq("journey_id", id).order("step_order"),
      admin
        .from("journey_event")
        .select("*")
        .eq("journey_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (journeyError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  return NextResponse.json({
    journey,
    steps: steps ?? [],
    events: events ?? [],
  });
}

/**
 * Updates editable journey metadata fields.
 * Non-editable fields (code, slug, status, workspace_id, journey_id) are excluded.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: z.infer<typeof PatchSchema>;
  try {
    parsed = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Build update object with only provided fields
  const update: Record<string, unknown> = {};

  if (parsed.title !== undefined) update.title = parsed.title;
  if (parsed.module !== undefined) update.module = parsed.module as never;
  if (parsed.actor !== undefined) update.actor = parsed.actor as never;
  if (parsed.platform !== undefined) update.platform = parsed.platform as never;
  if (parsed.priority !== undefined) update.priority = parsed.priority as never;
  if (parsed.tags !== undefined) update.tags = parsed.tags;
  if (parsed.trigger_description !== undefined)
    update.trigger_description = parsed.trigger_description;
  if (parsed.preconditions !== undefined) update.preconditions = parsed.preconditions;
  if (parsed.test_assertion !== undefined) update.test_assertion = parsed.test_assertion;
  if (parsed.doc_title !== undefined) update.doc_title = parsed.doc_title;
  if (parsed.outcomes_success !== undefined) update.outcomes_success = parsed.outcomes_success;
  if (parsed.outcomes_empty !== undefined) update.outcomes_empty = parsed.outcomes_empty;
  if (parsed.outcomes_error !== undefined) update.outcomes_error = parsed.outcomes_error;
  if (parsed.trigger_event !== undefined) update.trigger_event = parsed.trigger_event;
  if (parsed.step_event_type !== undefined) update.step_event_type = parsed.step_event_type;
  if (parsed.entity_type !== undefined) update.entity_type = parsed.entity_type;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify journey exists and get workspace_id for event logging
  const { data: existing, error: fetchError } = await admin
    .from("journey")
    .select("journey_id, workspace_id")
    .eq("journey_id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  // Update journey record
  const { data: updated, error: updateError } = await admin
    .from("journey")
    .update(update as never)
    .eq("journey_id", id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update journey" }, { status: 500 });
  }

  // Log the edit event (non-blocking — audit failure shouldn't break the operation)
  const { error: eventError } = await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: existing.workspace_id,
    event_type: "edit" as never,
    actor_id: superAdminId,
    metadata: { changed: Object.keys(update) },
  });
  if (eventError) {
    console.error(`[journey-edit] Event logging failed for journey ${id}:`, eventError);
  }

  return NextResponse.json({ journey: updated });
}

/**
 * Hard deletes a journey. Cascade will handle steps, events, and test_runs.
 */
export async function DELETE(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const superAdminId = await getSuperAdminId();
  if (!superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verify journey exists
  const { data: existing, error: fetchError } = await admin
    .from("journey")
    .select("journey_id")
    .eq("journey_id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  // Hard delete — cascade handles related rows
  const { error: deleteError } = await admin.from("journey").delete().eq("journey_id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete journey" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, journey_id: id });
}
