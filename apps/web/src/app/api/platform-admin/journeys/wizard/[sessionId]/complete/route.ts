// ============================================
// route.ts — Wizard Session Complete
// POST: Finalizes a wizard session by creating the journey
// and steps from the draft, then marking the session complete.
// Auto-assigns the next J-XXX code in the workspace.
// Connected to: wizard_session, journey, journey_step, journey_event tables
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

type Props = { params: Promise<{ sessionId: string }> };

/**
 * POST /api/platform-admin/journeys/wizard/[sessionId]/complete
 *
 * Finalizes the wizard session:
 * 1. Validates the draft has required fields (title, module, actor)
 * 2. Generates the next J-XXX code for the workspace
 * 3. Creates the journey record from draft data
 * 4. Creates journey_step records from draft steps
 * 5. Logs a status_change event
 * 6. Marks the wizard session as completed
 *
 * Why not a transaction: Supabase JS client doesn't support
 * multi-statement transactions. Each insert is independent.
 * Partial failure is acceptable — the journey can be manually
 * completed if step insertion fails.
 */
export async function POST(_request: NextRequest, { params }: Props) {
  const { sessionId } = await params;

  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // Load session
  const { data: session } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active")
    return NextResponse.json({ error: "Session not active" }, { status: 400 });

  // Validate draft has minimum required fields
  const draft = session.draft_journey as Record<string, unknown>;
  if (!draft.title || !draft.module || !draft.actor) {
    return NextResponse.json(
      { error: "Draft is incomplete — needs title, module, and actor" },
      { status: 400 },
    );
  }

  // Generate slug from title (lowercase, kebab-case, ASCII only)
  const slug = String(draft.title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Generate journey code with retry — handles concurrent completions
  // The UNIQUE constraint on (workspace_id, code) prevents duplicates.
  let journey: Record<string, unknown> | null = null;
  let nextCode = "";
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: lastJourney } = await admin
      .from("journey")
      .select("code")
      .eq("workspace_id", session.workspace_id)
      .order("code", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastJourney ? parseInt(lastJourney.code.replace("J-", ""), 10) : 0;
    nextCode = `J-${String(lastNum + 1 + attempt).padStart(3, "0")}`;

    const { data, error: insertError } = await admin
      .from("journey")
      .insert({
        workspace_id: session.workspace_id,
        code: nextCode,
        title: String(draft.title),
        slug: `${slug}-${nextCode.toLowerCase()}`,
        module: String(draft.module) as never,
        actor: String(draft.actor) as never,
        platform: String(draft.platform ?? "both") as never,
        priority: String(draft.priority ?? "P1") as never,
        status: "defined" as never,
        tags: (draft.tags as string[]) ?? [],
        trigger_description: draft.trigger_description ? String(draft.trigger_description) : null,
        preconditions: (draft.preconditions as string[]) ?? [],
        test_assertion: draft.test_assertion ? String(draft.test_assertion) : null,
        doc_title: draft.doc_title ? String(draft.doc_title) : null,
        outcomes_success: draft.outcomes_success ? String(draft.outcomes_success) : null,
        outcomes_empty: draft.outcomes_empty ? String(draft.outcomes_empty) : null,
        outcomes_error: draft.outcomes_error ? String(draft.outcomes_error) : null,
        created_by: adminId,
      })
      .select()
      .single();

    if (!insertError && data) {
      journey = data as Record<string, unknown>;
      break;
    }

    // Unique violation on code — retry with next number
    if (insertError?.code === "23505" && insertError.message.includes("code")) {
      continue;
    }

    // Any other error — bail out
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create journey" },
      { status: 500 },
    );
  }

  if (!journey) {
    return NextResponse.json(
      { error: "Failed to generate unique journey code after retries" },
      { status: 500 },
    );
  }

  // Create journey steps from draft
  const draftSteps =
    (draft.steps as Array<{
      title: string;
      action: string;
      expects?: string;
      screen?: string;
      component?: string;
    }>) ?? [];

  if (draftSteps.length > 0) {
    const stepRows = draftSteps.map((s, i) => ({
      journey_id: journey.journey_id as string,
      workspace_id: session.workspace_id,
      step_order: i + 1,
      title: s.title,
      action: s.action,
      expects: s.expects ?? null,
      screen: s.screen ?? null,
      component: s.component ?? null,
    }));

    await admin.from("journey_step").insert(stepRows);
  }

  // Log the creation event for audit trail
  await admin.from("journey_event").insert({
    journey_id: journey.journey_id as string,
    workspace_id: session.workspace_id,
    event_type: "status_change" as never,
    from_status: null,
    to_status: "defined" as never,
    actor_id: adminId,
    metadata: { source: "wizard", session_id: sessionId },
  });

  // Mark wizard session as completed and link to created journey
  await admin
    .from("wizard_session")
    .update({
      status: "completed" as never,
      journey_id: journey.journey_id as string,
      completed_at: new Date().toISOString(),
    })
    .eq("wizard_session_id", sessionId);

  return NextResponse.json({
    journey_id: journey.journey_id as string,
    code: nextCode,
    title: journey.title as string,
  });
}
