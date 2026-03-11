import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

type CreateCallPayload = {
  mission_id: string;
  workspace_id?: string;
  user_id?: string;
  profile_id?: string;
  voice?: string;
  language: string;
  first_speaker?: "user" | "agent";
  context?: Record<string, unknown>;
  selected_tools?: Array<Record<string, unknown>>;
};

/**
 * POST /api/wizard/start
 *
 * Routes voice calls through the Stage Engine instead of calling Ultravox directly.
 * The stage engine creates a session, builds the prompt (with tuning notes),
 * wires Guardian monitoring, and returns a join URL.
 *
 * Auth: Optional. Onboarding works without login (user has no account yet).
 * Other missions require authentication.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
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

  // Try to get authenticated user — may be null during onboarding
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "onboarding-interview";
    const isShowcaseVoice =
      typeof body.context?.page === "string" && body.context.page.startsWith("dashboard.");
    console.info("[wizard/start] session_start_requested", {
      request_id: requestId,
      mission_id: missionId,
      context_page: typeof body.context?.page === "string" ? body.context.page : "unknown",
      selected_tool_count: Array.isArray(body.selected_tools) ? body.selected_tools.length : 0,
    });

    // Onboarding does not require auth — user has no account yet
    if (!user && missionId !== "onboarding-interview" && !isShowcaseVoice) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up profile — may not exist yet during onboarding
    let workspaceId: string | undefined;
    let profileId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      workspaceId = body.workspace_id ?? profile?.workspace_id;
      profileId = profile?.profile_id;
    }

    if (!workspaceId && missionId !== "onboarding-interview" && !isShowcaseVoice) {
      return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    const createPayload: CreateCallPayload = {
      mission_id: missionId,
      workspace_id: workspaceId,
      user_id: user?.id,
      profile_id: profileId,
      voice: body.voice,
      language: body.language ?? "no",
      first_speaker: body.first_speaker,
      context: body.context,
      selected_tools: body.selected_tools,
    };

    const res = await fetch(`${stageEngineUrl}/adapters/ultravox/create-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": stageEngineApiKey,
      },
      body: JSON.stringify(createPayload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: "Unknown stage engine error" }));
      console.error("[wizard/start] create_call_failed", {
        request_id: requestId,
        mission_id: missionId,
        status: res.status,
        provider_error: errData.error ?? "unknown_error",
        provider_message: errData.message ?? "Unknown stage engine error",
        provider_details: errData.details ?? "none",
      });
      const missionNotFound =
        res.status === 404 &&
        (errData.error === "NOT_FOUND" || String(errData.message ?? "").includes("not found"));

      if (missionNotFound && missionId !== "mr-botsson") {
        console.warn(
          `[wizard/start] Mission "${missionId}" not found in Stage Engine. Falling back to "mr-botsson".`,
        );

        const fallbackRes = await fetch(`${stageEngineUrl}/adapters/ultravox/create-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": stageEngineApiKey,
          },
          body: JSON.stringify({
            ...createPayload,
            mission_id: "mr-botsson",
          }),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          console.info("[wizard/start] mission_fallback_used", {
            request_id: requestId,
            requested_mission: missionId,
            actual_mission: "mr-botsson",
          });
          return NextResponse.json({
            sessionId: fallbackData.session_id,
            joinUrl: fallbackData.join_url,
            callId: fallbackData.call_id,
            missionFallbackUsed: true,
            requestedMission: missionId,
            actualMission: "mr-botsson",
            requestId,
          });
        }

        const fallbackErr = await fallbackRes
          .json()
          .catch(() => ({ message: "Unknown stage engine fallback error" }));
        console.error(
          "[wizard/start] Stage engine fallback error:",
          fallbackRes.status,
          fallbackErr,
        );
        return NextResponse.json(
          {
            error: fallbackErr.message ?? "Failed to start voice session",
            requestId,
          },
          { status: fallbackRes.status },
        );
      }

      console.error("[wizard/start] Stage engine error:", res.status, errData);
      return NextResponse.json(
        {
          error: errData.message ?? "Failed to start voice session",
          details: errData.details ?? errData.error ?? undefined,
          upstream_status: errData.upstream_status ?? res.status,
          requestId,
        },
        { status: res.status },
      );
    }

    const data = await res.json();
    console.info("[wizard/start] join_url_received", {
      request_id: requestId,
      mission_id: missionId,
      call_id: data.call_id,
    });

    return NextResponse.json({
      sessionId: data.session_id,
      joinUrl: data.join_url,
      callId: data.call_id,
      requestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[wizard/start] session_start_failed", {
      request_id: requestId,
      error: message,
    });
    return NextResponse.json(
      { error: "Failed to start voice session", details: message, requestId },
      { status: 502 },
    );
  }
}
