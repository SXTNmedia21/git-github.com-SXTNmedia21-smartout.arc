import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
});

// C2: Helper to broadcast via Supabase Realtime — subscribe before send
async function broadcastEvent(
  supabase: ReturnType<typeof createClient>,
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = supabase.channel(channelName);

  // Must subscribe before sending — Supabase requires active subscription for broadcast
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Broadcast subscribe timeout")), 5000);
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  await channel.send({ type: "broadcast", event, payload });
  await supabase.removeChannel(channel);
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
