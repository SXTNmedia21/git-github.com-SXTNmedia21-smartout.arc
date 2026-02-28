import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { startMissionCall } from "@smartout/ai/missions";

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

    const result = await startMissionCall({
      missionId,
      apiKey,
      agentId: process.env.ULTRAVOX_AGENT_ID,
      metadata: {
        source: "landing",
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
