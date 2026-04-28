// ============================================
// route.ts — Journey Agent API Route
// Handles POST requests from the wizard chat UI.
// Validates auth (godmode only), loads wizard session,
// runs the journey agent, and persists messages.
// Connected to: packages/ai/src/agents/journey.ts (agent logic)
// Connected to: wizard_session table (session persistence)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { runJourneyAgent } from "@smartout/ai/agents/journey";
import type { ModelMessage, JourneyToolContext } from "@smartout/ai/agents/journey";
import { getSuperAdminId } from "@/lib/platform-admin";

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
});

/**
 * POST /api/journey-agent
 *
 * Runs one turn of the journey wizard agent.
 * Loads session state from DB, passes context to agent,
 * then saves the new messages back to the session.
 *
 * Why godmode only: The wizard is a platform-admin tool
 * for defining journeys across all workspaces.
 */
export async function POST(request: NextRequest) {
  // 1. Auth check
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2. Parse request
  const admin = createAdminClient();
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Load wizard session
  const { data: session, error: sessionError } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", body.sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  try {
    // 4. Build conversation history from stored messages
    const existingMessages = (session.messages as Array<{ role: string; content: string }>) ?? [];
    const conversationHistory = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) as ModelMessage[];

    // 5. Build tool context — gives the agent DB access and session state.
    // SS-5 (ADR-0204): profileId threaded through so mutation tools can call
    // `gatedMutation()`. Channel is `"chat"` by default — the wizard UI is a
    // chat surface; if voice is later enabled it must override explicitly.
    const ctx: JourneyToolContext = {
      supabase: admin,
      workspaceId: session.workspace_id,
      sessionId: session.wizard_session_id,
      currentPhase: session.current_phase,
      draftJourney: (session.draft_journey as Record<string, unknown>) ?? {},
      profileId: adminId,
      channel: "chat",
    };

    // 6. Run the agent for one turn
    const result = await runJourneyAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory,
    });

    // 7. Append new messages to session (user + assistant)
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: body.userMessage, timestamp: now },
      { role: "assistant", content: result.text, phase: result.phase, timestamp: now },
    ];

    await admin
      .from("wizard_session")
      .update({ messages: updatedMessages })
      .eq("wizard_session_id", body.sessionId);

    // 8. Reload session to get latest draft state (tools may have updated it)
    const { data: updatedSession } = await admin
      .from("wizard_session")
      .select("current_phase, draft_journey")
      .eq("wizard_session_id", body.sessionId)
      .single();

    return NextResponse.json({
      text: result.text,
      phase: updatedSession?.current_phase ?? session.current_phase,
      draftJourney: updatedSession?.draft_journey ?? session.draft_journey,
    });
  } catch (err) {
    console.error("Journey agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
