// ============================================
// engine-start/route.ts
// Landing voice session via Stage Engine — DISABLED.
// ADR-0282 Phase E E6: voice adapter endpoint deleted from stage-engine.
// ADR-0282 acceptance: landing voice is text-only. Web wizard is the
// sole voice surface. LiveKit token endpoint is NOT wired to landing.
// Phase F0 T1: returns 410 Gone so the frontend shows "voice unavailable".
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

export async function POST(request: NextRequest) {
  // ADR-0282 Phase F0: Landing voice permanently removed. Web wizard is the
  // sole voice surface. Log the attempt so platform admin can observe
  // landing → web redirect rate, then return 410 Gone.
  console.warn(
    "[engine-start] Landing voice unavailable — use web wizard at smartout.ai/onboarding (ADR-0282 Phase F0 T1)",
  );

  void logVoiceUnavailable(request).catch((err) => {
    console.warn("[engine-start] Voice unavailable event logging failed:", err);
  });

  return NextResponse.json(
    {
      error: "Stemmefunksjonen er ikke tilgjengelig her.",
      redirect: "Bruk vår fulle wizard på smartout.ai/onboarding",
      voice_available: false,
    },
    { status: 410 },
  );
}

/**
 * Writes a voice_unavailable event to landing_event.
 * Mirrors the pattern in wizard/start/route.ts — fire-and-forget.
 */
async function logVoiceUnavailable(request: NextRequest): Promise<void> {
  try {
    const admin = createAdminClient();

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
      event_type: "voice_unavailable",
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      details: {
        source: "engine-start",
        reason: "ADR-0282-phase-f0-landing-text-only",
      } as unknown as Json,
    });
  } catch (err) {
    console.warn("[engine-start] Could not log voice_unavailable event:", err);
  }
}
