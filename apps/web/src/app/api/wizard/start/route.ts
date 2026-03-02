import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { startMissionCall } from "@smartout/ai/missions";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";

export async function POST(request: NextRequest) {
  let apiKey: string;
  try {
    apiKey = await getServiceKey(createAdminClient(), "ultravox");
  } catch {
    console.error(
      "[wizard/start] ULTRAVOX_API_KEY not found in Vault. Save it via /platform-admin/keys.",
    );
    return NextResponse.json(
      { error: "Voice assistant is not configured. Contact administrator." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "mr-botsson";

    const result = await startMissionCall({
      missionId,
      apiKey,
      agentId: process.env.ULTRAVOX_AGENT_ID,
      metadata: {
        source: "web-dashboard",
        ...(body.metadata || {}),
      },
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
