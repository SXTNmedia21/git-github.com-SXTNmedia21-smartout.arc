// ============================================
// wizard/start/route.ts
// Landing page voice session start endpoint.
// ADR-0282 Phase E E6: Ultravox deleted. LiveKit replacement is P5 scope.
// Returns 503 until landing voice is rewired to LiveKit token endpoint.
// Connected to: apps/landing/src/hooks/useTracking.ts (page_view/cta_click)
//               apps/web/src/app/platform-admin/landing/ (reads events)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

export async function POST(request: NextRequest) {
  // ADR-0282 Phase E E6: Ultravox voice provider removed.
  // Landing page voice demo will be rewired to LiveKit in Phase E P5.
  // Return 503 so the frontend shows a graceful "unavailable" state.
  console.warn(
    "[wizard/start] Landing voice session unavailable \u2014 LiveKit rewire pending (ADR-0282 Phase E P5)",
  );

  // Still log the attempt for platform admin visibility.
  void logVoiceSessionStarted(request, {
    callId: "unavailable",
    mission: "landing-demo",
    voiceFallbackUsed: false,
    variant: null,
  }).catch((error) => {
    console.warn("[wizard/start] Voice session event logging failed:", error);
  });

  return NextResponse.json(
    { error: "Voice assistant is temporarily unavailable. LiveKit migration in progress." },
    { status: 503 },
  );
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
    let ip_address: string | null;
    if (forwarded) {
      const forwardedIp = forwarded.split(",")[0]?.trim();
      ip_address = forwardedIp === "" ? null : (forwardedIp ?? null);
    } else {
      const realIp = request.headers.get("x-real-ip")?.trim();
      ip_address = realIp === "" ? null : (realIp ?? null);
    }
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
