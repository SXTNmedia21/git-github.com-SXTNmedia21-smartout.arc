import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { RoomServiceClient } from "npm:livekit-server-sdk@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json();
    const { action } = body;

    // H2: Validate action field
    if (!action || typeof action !== "string") {
      return errorResponse("Missing or invalid 'action' field", 400);
    }

    switch (action) {
      case "start":
        return await handleStart(supabase, user.id, body);
      case "respond":
        return await handleRespond(supabase, user.id, body);
      case "mute_participant":
        return await handleMuteParticipant(supabase, user.id, body);
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
});

// Broadcast via Supabase Realtime using REST API (no WebSocket subscribe needed)
async function broadcastEvent(
  supabase: ReturnType<typeof createClient>,
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Use Supabase REST broadcast endpoint — works from edge functions without WebSocket
  const url = `${Deno.env.get("SUPABASE_URL")}/realtime/v1/api/broadcast`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:${channelName}`,
          event,
          payload,
        },
      ],
    }),
  });
}

async function handleStart(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  // H2: Validate required fields
  const channelId = body.channelId as string | undefined;
  const workspaceId = body.workspaceId as string | undefined;
  const callType = body.callType as string | undefined;
  const calleeProfileId = body.calleeProfileId as string | undefined;

  if (!channelId || !workspaceId || !callType) {
    return errorResponse("Missing required fields: channelId, workspaceId, callType", 400);
  }
  if (!["direct", "group", "ptt"].includes(callType)) {
    return errorResponse("Invalid callType. Must be: direct, group, ptt", 400);
  }

  // Get caller profile
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, display_name, avatar_url")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return errorResponse("No active profile", 403);
  }

  // Verify channel membership
  const { data: membership } = await supabase
    .from("channel_member")
    .select("id")
    .eq("channel_id", channelId)
    .eq("profile_id", profile.profile_id)
    .is("left_at", null)
    .single();

  if (!membership) {
    return errorResponse("Not a member of this channel", 403);
  }

  // Check channel policies
  const { data: channel } = await supabase
    .from("channel")
    .select("audio_policy, video_policy")
    .eq("id", channelId)
    .single();

  if (!channel || (channel.audio_policy === "disabled" && channel.video_policy === "disabled")) {
    return errorResponse("Voice and video are disabled for this channel", 400);
  }

  const roomName = `${workspaceId}:${channelId}`;

  // Create call session (service role for insert reliability)
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: session, error: sessionError } = await serviceSupabase
    .from("channel_call_session")
    .insert({
      channel_id: channelId,
      workspace_id: workspaceId,
      call_type: callType,
      livekit_room_name: roomName,
      status: "active",
      audio_policy: channel.audio_policy,
      video_policy: channel.video_policy ?? "disabled",
      recording_policy: "off",
      started_by: profile.profile_id,
    })
    .select("id")
    .single();

  if (sessionError) {
    return errorResponse(sessionError.message, 500);
  }

  // C1 + C2: Broadcast signaling with proper subscribe pattern
  try {
    if (callType === "direct" && calleeProfileId) {
      await broadcastEvent(
        supabase,
        `profile:${workspaceId}:${calleeProfileId}:calls`,
        "call_invite",
        {
          callSessionId: session.id,
          channelId,
          callerName: profile.display_name,
          callerAvatar: profile.avatar_url,
          roomName,
          workspaceId,
        },
      );
    } else if (callType === "group") {
      await broadcastEvent(
        supabase,
        `channel:${workspaceId}:${channelId}:calls`,
        "group_call_started",
        {
          callSessionId: session.id,
          initiatorName: profile.display_name,
          roomName,
          participantCount: 1,
        },
      );
    }
  } catch (err) {
    // Signaling failure is non-fatal — call session is still created
    console.error("[call-command] Broadcast failed:", err);
  }

  return jsonResponse({
    callSessionId: session.id,
    roomName,
    callType,
  });
}

async function handleRespond(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  // H2: Validate required fields
  const callSessionId = body.callSessionId as string | undefined;
  const workspaceId = body.workspaceId as string | undefined;
  const channelId = body.channelId as string | undefined;
  const responseAction = body.responseAction as string | undefined;
  const targetProfileId = body.targetProfileId as string | undefined;

  if (!callSessionId || !workspaceId || !channelId || !responseAction) {
    return errorResponse(
      "Missing required fields: callSessionId, workspaceId, channelId, responseAction",
      400,
    );
  }
  if (!["accept", "reject", "cancel"].includes(responseAction)) {
    return errorResponse("Invalid responseAction. Must be: accept, reject, cancel", 400);
  }

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, display_name")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return errorResponse("No active profile", 403);
  }

  // H1: Verify the call session exists and belongs to this workspace
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: sessionCheck } = await serviceSupabase
    .from("channel_call_session")
    .select("id, workspace_id")
    .eq("id", callSessionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!sessionCheck) {
    return errorResponse("Call session not found in this workspace", 404);
  }

  // Broadcast response to the other party
  if (targetProfileId) {
    const eventMap = {
      accept: "call_accepted",
      reject: "call_rejected",
      cancel: "call_cancelled",
    } as const;

    try {
      await broadcastEvent(
        supabase,
        `profile:${workspaceId}:${targetProfileId}:calls`,
        eventMap[responseAction as keyof typeof eventMap],
        { callSessionId },
      );
    } catch (err) {
      console.error("[call-command] Response broadcast failed:", err);
    }
  }

  // On reject/cancel: check if call should be ended
  if (responseAction === "reject" || responseAction === "cancel") {
    const { count } = await serviceSupabase
      .from("channel_call_participant")
      .select("id", { count: "exact", head: true })
      .eq("call_session_id", callSessionId)
      .is("left_at", null);

    if (!count || count === 0) {
      await serviceSupabase
        .from("channel_call_session")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callSessionId);
    }
  }

  return jsonResponse({ ok: true, action: responseAction });
}

async function handleMuteParticipant(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const workspaceId = body.workspaceId as string | undefined;
  const channelId = body.channelId as string | undefined;
  const targetIdentity = body.targetIdentity as string | undefined;
  const trackSid = body.trackSid as string | undefined;
  const muted = body.muted as boolean | undefined;

  if (!workspaceId || !channelId || !targetIdentity) {
    return errorResponse("Missing required fields: workspaceId, channelId, targetIdentity", 400);
  }

  // Verify the caller is an admin/owner in this workspace
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return errorResponse("No active profile", 403);
  }

  if (!["admin", "owner"].includes(profile.workspace_role)) {
    return errorResponse("Only admins can mute other participants", 403);
  }

  // Use LiveKit Room Service to mute the participant's audio track
  const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL");
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

  if (!livekitUrl || !apiKey || !apiSecret) {
    return errorResponse("LiveKit not configured", 500);
  }

  const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  const roomName = `${workspaceId}:${channelId}`;

  try {
    if (trackSid) {
      // Mute a specific track
      await roomService.mutePublishedTrack(roomName, targetIdentity, trackSid, muted ?? true);
    } else {
      // Mute all audio tracks — list participant's tracks and mute audio ones
      const participants = await roomService.listParticipants(roomName);
      const target = participants.find((p) => p.identity === targetIdentity);

      if (!target) {
        return errorResponse("Participant not found in room", 404);
      }

      for (const track of target.tracks) {
        if (track.type === 1 /* AUDIO */ && track.sid) {
          await roomService.mutePublishedTrack(roomName, targetIdentity, track.sid, muted ?? true);
        }
      }
    }
  } catch (err) {
    console.error("[call-command] Mute failed:", err);
    return errorResponse("Failed to mute participant", 500);
  }

  return jsonResponse({ ok: true, muted: muted ?? true, targetIdentity });
}
