/**
 * POST /api/wizard/start
 *
 * Mints a LiveKit token via the livekit-token Edge Function and returns
 * roomUrl + token for the caller to connect directly.
 *
 * ADR-0282 Phase E T2.5: replaces the previous Ultravox /adapters/ultravox/
 * create-call path. Voice-agent dispatches missions via room-name pattern
 * matching (e.g. {workspaceId}:wizard:{userId} → onboarding-interview).
 *
 * Auth (ADR-0151): workspace_id is derived server-side from the JWT-resolved
 * profile. The client never supplies an authoritative workspace_id. A body
 * workspace_id that disagrees with the server-resolved value is rejected 403.
 *
 * Onboarding is the only mission that works without a pre-existing user/profile
 * (account is created mid-session). All other missions require authentication.
 *
 * Error handling:
 *   - livekit-token edge function failure → 503 VOICE_PROVIDER_UNAVAILABLE
 *   - This triggers the fallback "Neste (uten stemme)" button in the wizard UI
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Try to get authenticated user — may be null during onboarding
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = (body.mission_id as string) || "onboarding-interview";

    console.info("[wizard/start] session_start_requested", {
      request_id: requestId,
      mission_id: missionId,
      context_page: typeof body.context?.page === "string" ? body.context.page : "unknown",
    });

    // Onboarding does not require auth — user has no account yet.
    // All other missions require authentication.
    if (!user && missionId !== "onboarding-interview") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ADR-0151: derive workspace_id server-side from JWT-resolved profile.
    // A forgeable body.workspace_id is rejected if it disagrees with the
    // server-derived value.
    let workspaceId: string | undefined;
    let profileId: string | undefined;

    if (user) {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const resolvedWorkspaceId = profile?.workspace_id;

      if (
        resolvedWorkspaceId &&
        typeof body.workspace_id === "string" &&
        body.workspace_id.length > 0 &&
        body.workspace_id !== resolvedWorkspaceId
      ) {
        void emit({
          event: "security.workspace_id_forgery_rejected",
          workspace_id: nonEmpty(resolvedWorkspaceId, "workspace_id"),
          actor_id: nonEmpty(user.id, "actor_id"),
          properties: {
            data: {
              request_id: requestId,
              body_workspace_id: body.workspace_id,
              resolved_workspace_id: resolvedWorkspaceId,
              user_id: user.id,
              mission_id: missionId,
            },
          },
        });
        console.warn("[wizard/start] workspace_id_mismatch", {
          request_id: requestId,
          body_workspace_id: body.workspace_id,
          resolved_workspace_id: resolvedWorkspaceId,
        });
        return NextResponse.json(
          { error: "FORBIDDEN", message: "workspace_id mismatch" },
          { status: 403 },
        );
      }

      workspaceId = resolvedWorkspaceId ?? undefined;
      profileId = profile?.profile_id ?? undefined;
    }

    if (!workspaceId && missionId !== "onboarding-interview") {
      return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    // Room name pattern drives voice-agent mission dispatch (adapter.ts pattern matching).
    // onboarding: {workspaceId}:wizard:{userId} — workspace may be null pre-identification.
    const roomName = `${workspaceId ?? "anon"}:wizard:${user?.id ?? "anon"}`;

    const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
      "livekit-token",
      {
        body: {
          room_name: roomName,
          mission_id: missionId,
          workspace_id: workspaceId ?? null,
          user_id: user?.id ?? null,
          profile_id: profileId ?? null,
          voice: (body.voice as string) ?? "coral",
          language: (body.language as string) ?? "no",
          first_speaker: (body.first_speaker as string) ?? "agent",
          context: body.context ?? null,
          // Wizard mode flag so livekit-token EF knows to use wizard-specific policy
          wizard: true,
        },
      },
    );

    if (tokenError || !tokenData) {
      console.error("[wizard/start] livekit_token_failed", {
        request_id: requestId,
        mission_id: missionId,
        error: tokenError?.message ?? "unknown_error",
      });
      return NextResponse.json(
        { error: "VOICE_PROVIDER_UNAVAILABLE", request_id: requestId },
        { status: 503 },
      );
    }

    console.info("[wizard/start] livekit_token_minted", {
      request_id: requestId,
      mission_id: missionId,
      room_name: tokenData.room_name ?? roomName,
    });

    return NextResponse.json({
      sessionId: tokenData.room_name ?? roomName,
      roomUrl: tokenData.room_url,
      token: tokenData.token,
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
