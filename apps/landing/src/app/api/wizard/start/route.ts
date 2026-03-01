// ============================================
// wizard/start/route.ts
// Initiates an Ultravox voice session for the landing page demo.
// Also logs a voice_session_started event to landing_event
// so platform admin can track demo engagement.
// Connected to: apps/landing/src/hooks/useTracking.ts (page_view/cta_click)
//               apps/web/src/app/platform-admin/landing/ (reads events)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { startMissionCall } from "@smartout/ai/missions";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ULTRAVOX_API_KEY;

  if (!apiKey) {
    console.error("[wizard/start] ULTRAVOX_API_KEY is not set. Add it to .env.local or 1Password.");
    return NextResponse.json(
      { error: "Voice assistant is not configured. Contact administrator." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "landing-demo";

    // Build templateContext from variant info if provided.
    // Ultravox replaces {{variant_context}} in the system prompt.
    const templateContext = body.template_context
      ? {
          variant_context: [
            `Du snakker med en bes\u00f8kende som er ${body.template_context.personaRole}.`,
            body.template_context.personaName
              ? `Personaen heter ${body.template_context.personaName}.`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : undefined;

    const result = await startMissionCall({
      missionId,
      apiKey,
      agentId: process.env.ULTRAVOX_AGENT_ID,
      metadata: {
        source: "landing",
        ...(body.template_context?.variant ? { variant: body.template_context.variant } : {}),
        ...(body.metadata || {}),
      },
      templateContext,
    });

    // Log the voice session start to platform admin tracking.
    // Fire-and-forget: tracking failures must never block the demo experience.
    void logVoiceSessionStarted(request, {
      callId: result.callId,
      mission: result.mission.name,
      voiceFallbackUsed: result.voiceFallbackUsed,
      variant: body.template_context?.variant ?? null,
    });

    return NextResponse.json({
      joinUrl: result.joinUrl,
      callId: result.callId,
      mission: result.mission.name,
      voiceFallbackUsed: result.voiceFallbackUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[wizard/start] Failed:", message);
    return NextResponse.json(
      { error: "Failed to start voice session", details: message },
      { status: 502 },
    );
  }
}

/**
 * Writes a voice_session_started event to landing_event.
 * Uses the admin client (service role) so no auth is needed.
 * Called fire-and-forget — never awaited by the main handler.
 */
async function logVoiceSessionStarted(
  request: NextRequest,
  details: { callId: string; mission: string; voiceFallbackUsed: boolean; variant: string | null },
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Extract server-side metadata from request headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip_address = forwarded
      ? forwarded.split(",")[0]?.trim()
      : request.headers.get("x-real-ip");
    const user_agent = request.headers.get("user-agent");

    await admin.from("landing_event").insert({
      event_type: "voice_session_started",
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      details: details as unknown as Json,
    });
  } catch (err) {
    console.warn("[wizard/start] Could not log voice session event:", err);
  }
}
