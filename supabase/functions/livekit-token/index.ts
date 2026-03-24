import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.15.0";

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
    const { channelId, workspaceId } = body;

    // H2: Validate required fields
    if (!channelId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: channelId, workspaceId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify profile exists in workspace
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("profile_id, display_name, avatar_url")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "No active profile in workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify channel membership
    const { data: membership } = await supabase
      .from("channel_member")
      .select("id, role")
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

    // Read channel policies for grant decisions
    const { data: channel } = await supabase
      .from("channel")
      .select("audio_policy, video_policy")
      .eq("id", channelId)
      .single();

    const audioPolicy = channel?.audio_policy ?? "disabled";
    const videoPolicy = channel?.video_policy ?? "disabled";

    if (audioPolicy === "disabled" && videoPolicy === "disabled") {
      return new Response(
        JSON.stringify({ error: "Voice and video are disabled for this channel" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const roomName = `${workspaceId}:${channelId}`;

    const at = new AccessToken(
      Deno.env.get("LIVEKIT_API_KEY")!,
      Deno.env.get("LIVEKIT_API_SECRET")!,
      {
        identity: profile.profile_id,
        name: profile.display_name ?? "Unknown",
        ttl: "6h",
        metadata: JSON.stringify({
          device_type: "web",
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          is_ai: false,
        }),
      },
    );

    // Build publishable sources based on channel policies
    const sources: string[] = [];
    if (audioPolicy !== "disabled" && audioPolicy !== "listen_only") {
      sources.push("microphone");
    }
    if (videoPolicy !== "disabled") {
      sources.push("camera", "screen_share");
    }

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: sources.length > 0,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      canPublishSources: sources,
    });

    const token = await at.toJwt();

    return new Response(
      JSON.stringify({
        token,
        serverUrl: Deno.env.get("LIVEKIT_URL") ?? Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL"),
        roomName,
        profileId: profile.profile_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
