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

    const body = await req.json();

    // Phase C1 / ADR-0135: `purpose` distinguishes which policy gate applies.
    //   - 'human_call' (default): human-to-human audio gated by channel.audio_policy.
    //   - 'ai_voice'           : AI-driven voice session gated by
    //                             channel_ai_policy.voice_participation.
    //   - 'wizard'             : Onboarding interview flow. No channelId binding.
    //                             Room name: {workspaceId|"anon"}:wizard:{userId|"anon"}.
    //                             ADR-0151 server-derive: workspaceId from JWT profile, not body.
    //                             Allows anonymous (unauthenticated) for pre-signup demos.
    const purpose: "human_call" | "ai_voice" | "wizard" =
      body.purpose === "ai_voice"
        ? "ai_voice"
        : body.purpose === "wizard"
          ? "wizard"
          : "human_call";

    // --- Wizard branch (pre-Phase-E onboarding interview) ---
    // Bypass channel-membership checks — wizard has no channelId.
    // ADR-0151: derive workspaceId from authenticated profile, not body.
    // Allows unauthenticated callers (anon) for landing-page interview demos.
    if (purpose === "wizard") {
      const userId = user?.id ?? "anon";

      // Server-derive workspace_id per ADR-0151.
      // If authenticated, look up profile to get canonical workspaceId.
      let wizardWorkspaceId = "anon";
      if (user) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: profile } = await admin
          .from("profile")
          .select("workspace_id")
          .eq("user_id", user.id)
          .in("status", ["active", "trainee"])
          .limit(1)
          .maybeSingle();
        wizardWorkspaceId = profile?.workspace_id ?? "anon";
      }

      const roomName = `${wizardWorkspaceId}:wizard:${userId}`;
      const identity = user?.id ?? `anon-${crypto.randomUUID()}`;

      const at = new AccessToken(
        Deno.env.get("LIVEKIT_API_KEY")!,
        Deno.env.get("LIVEKIT_API_SECRET")!,
        {
          identity,
          name: user?.email ?? "Onboarding Guest",
          ttl: "2h",
          metadata: JSON.stringify({
            device_type: "web",
            purpose: "wizard",
            is_ai: false,
            // Belt-and-suspenders: forward mission config for future explicit-config
            // use cases. voice-agent currently resolves mission via room-name pattern,
            // but these fields allow client-side override when needed (C3 R4).
            voice: body.voice ?? null,
            mission_id: body.mission_id ?? null,
            first_speaker: body.first_speaker ?? null,
            language: body.language ?? null,
          }),
        },
      );

      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
      });

      const token = await at.toJwt();

      return new Response(
        JSON.stringify({
          token,
          serverUrl: Deno.env.get("LIVEKIT_URL") ?? Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL"),
          roomName,
          purpose: "wizard",
          voiceParticipation: "interactive",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Existing paths (human_call / ai_voice) require authentication ---
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      .in("status", ["active", "trainee"])
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

    // Phase C1: AI-voice purpose is gated by channel_ai_policy, not channel.*_policy.
    // Default policy when no row exists is 'disabled' (matches policy.ts default —
    // conservative deny). Returning the policy in the response lets the mobile
    // client know whether to subscribe-only ('listen_only') or fully participate
    // ('interactive').
    let voiceParticipation: "disabled" | "listen_only" | "interactive" = "disabled";
    if (purpose === "ai_voice") {
      const { data: aiPolicy } = await supabase
        .from("channel_ai_policy")
        .select("voice_participation")
        .eq("channel_id", channelId)
        .maybeSingle();
      voiceParticipation = (aiPolicy?.voice_participation ?? "disabled") as typeof voiceParticipation;

      if (voiceParticipation === "disabled") {
        return new Response(
          JSON.stringify({
            error: "AI voice is disabled for this channel",
            code: "VOICE_PARTICIPATION_DISABLED",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else {
      // human_call path keeps its original gate.
      if (audioPolicy === "disabled" && videoPolicy === "disabled") {
        return new Response(
          JSON.stringify({ error: "Voice and video are disabled for this channel" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
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

    // Grant logic differs by purpose:
    //   - human_call: existing audio/video policy on `channel`.
    //   - ai_voice  : voice_participation drives mic publish.
    //                 'listen_only' → token allows subscribe + data, mic locked.
    //                 'interactive' → full bidirectional.
    let canPublishAudio: boolean;
    let canPublishVideo: boolean;
    if (purpose === "ai_voice") {
      canPublishAudio = voiceParticipation === "interactive";
      canPublishVideo = false;
    } else {
      canPublishAudio = audioPolicy !== "disabled" && audioPolicy !== "listen_only";
      canPublishVideo = videoPolicy !== "disabled";
    }

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublishAudio || canPublishVideo,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    const token = await at.toJwt();

    return new Response(
      JSON.stringify({
        token,
        serverUrl: Deno.env.get("LIVEKIT_URL") ?? Deno.env.get("NEXT_PUBLIC_LIVEKIT_URL"),
        roomName,
        profileId: profile.profile_id,
        // Phase C1: surface the resolved policy so the mobile client knows
        // which UX to render (mic locked vs. open) without a second round-trip.
        purpose,
        voiceParticipation: purpose === "ai_voice" ? voiceParticipation : null,
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
