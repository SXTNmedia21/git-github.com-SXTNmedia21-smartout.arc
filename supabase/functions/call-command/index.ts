import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start":
        return await handleStart(supabase, user.id, body);
      case "respond":
        return await handleRespond(supabase, user.id, body);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleStart(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: {
    channelId: string;
    workspaceId: string;
    callType: "direct" | "group" | "ptt";
    calleeProfileId?: string;
  },
) {
  const { channelId, workspaceId, callType, calleeProfileId } = body;

  // Get caller profile
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, full_name, avatar_url")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "No active profile" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    return new Response(JSON.stringify({ error: "Not a member of this channel" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check audio policy
  const { data: channel } = await supabase
    .from("channel")
    .select("audio_policy")
    .eq("id", channelId)
    .single();

  if (!channel || channel.audio_policy === "disabled") {
    return new Response(JSON.stringify({ error: "Voice is disabled for this channel" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      video_policy: "disabled",
      recording_policy: "off",
      started_by: profile.profile_id,
    })
    .select("id")
    .single();

  if (sessionError) {
    return new Response(JSON.stringify({ error: sessionError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Broadcast signaling
  if (callType === "direct" && calleeProfileId) {
    // 1:1 call invite
    const broadcastChannel = supabase.channel(`profile:${workspaceId}:${calleeProfileId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: "call_invite",
      payload: {
        callSessionId: session.id,
        channelId,
        callerName: profile.full_name,
        callerAvatar: profile.avatar_url,
        roomName,
        workspaceId,
      },
    });
    await broadcastChannel.unsubscribe();
  } else if (callType === "group") {
    // Group call announcement
    const broadcastChannel = supabase.channel(`channel:${workspaceId}:${channelId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: "group_call_started",
      payload: {
        callSessionId: session.id,
        initiatorName: profile.full_name,
        roomName,
        participantCount: 1,
      },
    });
    await broadcastChannel.unsubscribe();
  }

  return new Response(
    JSON.stringify({
      callSessionId: session.id,
      roomName,
      callType,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleRespond(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: {
    callSessionId: string;
    workspaceId: string;
    channelId: string;
    responseAction: "accept" | "reject" | "cancel";
    targetProfileId?: string;
  },
) {
  const { callSessionId, workspaceId, channelId, responseAction, targetProfileId } = body;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, full_name")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "No active profile" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Broadcast response to the other party
  if (targetProfileId) {
    const eventMap = {
      accept: "call_accepted",
      reject: "call_rejected",
      cancel: "call_cancelled",
    } as const;

    const broadcastChannel = supabase.channel(`profile:${workspaceId}:${targetProfileId}:calls`);
    await broadcastChannel.send({
      type: "broadcast",
      event: eventMap[responseAction],
      payload: { callSessionId },
    });
    await broadcastChannel.unsubscribe();
  }

  // On reject/cancel: check if call should be ended
  if (responseAction === "reject" || responseAction === "cancel") {
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

  return new Response(JSON.stringify({ ok: true, action: responseAction }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
