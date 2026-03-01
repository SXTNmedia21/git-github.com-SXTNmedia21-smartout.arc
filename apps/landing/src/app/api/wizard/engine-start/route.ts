// ============================================
// engine-start/route.ts
// Initiates a voice session through the Stage Engine.
// Stage Engine creates the session, builds Ultravox tools,
// and calls Ultravox API — returning a joinUrl.
// Connected to: stage-engine /adapters/ultravox/create-call
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const engineUrl = process.env.STAGE_ENGINE_URL;
  const apiKey = process.env.STAGE_ENGINE_API_KEY;

  if (!engineUrl || !apiKey) {
    console.error("[engine-start] STAGE_ENGINE_URL or STAGE_ENGINE_API_KEY not set");
    return NextResponse.json(
      { error: "Stage Engine is not configured. Set STAGE_ENGINE_URL and STAGE_ENGINE_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "landing-demo";

    const res = await fetch(`${engineUrl}/adapters/ultravox/create-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        mission_id: missionId,
        workspace_id: "b0000000-0000-0000-0000-000000000000",
        language: "no",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[engine-start] Stage Engine error: ${res.status} ${errText}`);
      return NextResponse.json(
        { error: "Stage Engine call failed", details: errText },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      joinUrl: data.join_url,
      callId: data.call_id,
      sessionId: data.session_id,
      mission: missionId,
      engine: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[engine-start] Failed:", message);
    return NextResponse.json(
      { error: "Failed to start engine session", details: message },
      { status: 502 },
    );
  }
}
