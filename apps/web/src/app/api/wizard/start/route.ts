import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

/**
 * POST /api/wizard/start
 *
 * Routes voice calls through the Stage Engine instead of calling Ultravox directly.
 * The stage engine creates a session, builds the prompt (with tuning notes),
 * wires Guardian monitoring, and returns a join URL.
 */
export async function POST(request: NextRequest) {
  const stageEngineUrl = process.env.STAGE_ENGINE_URL;
  const stageEngineApiKey = process.env.STAGE_ENGINE_API_KEY;

  if (!stageEngineUrl) {
    console.error("[wizard/start] STAGE_ENGINE_URL is not set.");
    return NextResponse.json(
      { error: "Voice assistant is not configured. Contact administrator." },
      { status: 503 },
    );
  }

  if (!stageEngineApiKey) {
    console.error("[wizard/start] STAGE_ENGINE_API_KEY is not set.");
    return NextResponse.json(
      { error: "Voice assistant is not configured. Contact administrator." },
      { status: 503 },
    );
  }

  // Get authenticated user + workspace
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_identity_id", user.id)
    .limit(1)
    .single();

  if (!profile?.workspace_id) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "onboarding-interview";

    const res = await fetch(`${stageEngineUrl}/adapters/ultravox/create-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": stageEngineApiKey,
      },
      body: JSON.stringify({
        mission_id: missionId,
        workspace_id: profile.workspace_id,
        user_id: user.id,
        voice: body.voice,
        language: body.language ?? "no",
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: "Unknown stage engine error" }));
      console.error("[wizard/start] Stage engine error:", res.status, errData);
      return NextResponse.json(
        { error: errData.message ?? "Failed to start voice session" },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      sessionId: data.session_id,
      joinUrl: data.join_url,
      callId: data.call_id,
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
