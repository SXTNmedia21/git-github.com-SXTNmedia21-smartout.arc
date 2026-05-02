/**
 * POST /api/botsson/voice/token
 *
 * BFF proxy for the livekit-token Edge Function when used with purpose="ai_voice".
 * Used by @smartout/botsson-sdk's mintLiveKitToken() to start a Botsson voice session.
 *
 * The Edge Function requires a valid authenticated user and:
 *   - channelId: which LiveKit room the token grants access to
 *   - workspaceId: tenant scope
 *   - purpose: "ai_voice" — applies channel_ai_policy gate (ADR-0135)
 *
 * This route uses a synthetic channelId ("botsson-direct") when no channelId
 * is provided, for direct Botsson voice sessions not bound to a komm channel.
 *
 * NOTE: "botsson-direct" is a synthetic channel ID. A production sortie
 * must either create a real channel + channel_ai_policy row, or add a
 * dedicated Botsson voice token endpoint that bypasses the channel-membership
 * check in the Edge Function. Out of scope for this package sortie.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";

const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().optional(),
  purpose: z.literal("ai_voice").default("ai_voice"),
});

export async function POST(request: NextRequest) {
  // 1. Auth — cookie session only (voice is web-only per ADR-0133)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve the workspace's Botsson AI channel.
  //    Migration 20260519201000 ensures every workspace has exactly one
  //    `channel_type='ai'` channel with channel_ai_policy.voice_participation
  //    set to 'interactive', and that all active/trainee profiles are members.
  let channelId = body.channelId;
  if (!channelId) {
    const { data: aiChannel, error: chErr } = await supabase
      .from("channel")
      .select("id")
      .eq("workspace_id", body.workspaceId)
      .eq("channel_type", "ai")
      .is("is_archived", false)
      .limit(1)
      .single();

    if (chErr || !aiChannel) {
      console.error(
        "[/api/botsson/voice/token] no AI channel for workspace:",
        body.workspaceId,
        chErr,
      );
      return NextResponse.json(
        {
          error:
            "No Botsson AI channel configured for this workspace. Run seed migration 20260519201000.",
        },
        { status: 503 },
      );
    }
    channelId = aiChannel.id;
  }

  // 4. Delegate to the livekit-token Edge Function.
  //    The Edge Function handles profile + channel membership checks.
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: {
      workspaceId: body.workspaceId,
      channelId,
      purpose: "ai_voice",
    },
  });

  if (error) {
    console.error("[/api/botsson/voice/token] livekit-token error:", error);
    return NextResponse.json(
      { error: error.message ?? "Token generation failed" },
      { status: 502 },
    );
  }

  return NextResponse.json(data);
}
