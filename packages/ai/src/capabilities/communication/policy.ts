// packages/ai/src/capabilities/communication/policy.ts
// Channel AI policy enforcement — reads channel_ai_policy to gate agent participation.
// ADR-0078: defence-in-depth layer for AI access control per channel.
import type { SupabaseClient } from "@supabase/supabase-js";

type TextMode = "disabled" | "mention_only" | "proactive";
type VoiceMode = "disabled" | "listen_only" | "interactive";

type ChannelAiPolicy = {
  text_participation: TextMode;
  voice_participation: VoiceMode;
  auto_reminders: boolean;
  auto_shift_prep: boolean;
  auto_summarize: boolean;
};

/** Default policy when no row exists for a channel — conservative mention_only for text. */
const DEFAULT_POLICY: ChannelAiPolicy = {
  text_participation: "mention_only",
  voice_participation: "disabled",
  auto_reminders: false,
  auto_shift_prep: false,
  auto_summarize: false,
};

/**
 * Fetch the channel_ai_policy for a given channel.
 * Returns the stored policy or conservative defaults if none exists.
 */
export async function getChannelAiPolicy(
  supabase: SupabaseClient,
  channelId: string,
): Promise<ChannelAiPolicy> {
  const { data, error } = await supabase
    .from("channel_ai_policy")
    .select(
      "text_participation, voice_participation, auto_reminders, auto_shift_prep, auto_summarize",
    )
    .eq("channel_id", channelId)
    .single();

  if (error || !data) {
    return DEFAULT_POLICY;
  }

  return data as ChannelAiPolicy;
}

/**
 * Check whether the AI agent is allowed to respond in a channel.
 *
 * @param supabase - Supabase client (admin or RLS-scoped)
 * @param channelId - The channel UUID to check
 * @param interactionType - "text" or "voice"
 * @param isDirectlyMentioned - Whether the user explicitly addressed the AI (e.g. @botsson)
 * @returns true if the AI is permitted to respond, false otherwise
 *
 * Policy logic:
 * - text disabled → never respond
 * - text mention_only → only respond when isDirectlyMentioned
 * - text proactive → always respond
 * - voice disabled → never respond
 * - voice listen_only → can listen/transcribe but not speak
 * - voice interactive → full voice participation
 *
 * TODO: Integrate this check into the agent router's response pipeline.
 * Call isAiAllowedInChannel() before generating a response when the context
 * includes a channel_id. The router should:
 *   1. Extract channel_id from the conversation/session context
 *   2. Call isAiAllowedInChannel(supabase, channelId, "text", isMentioned)
 *   3. If false, return a silent no-op or a polite "I'm not active in this channel" message
 */
export async function isAiAllowedInChannel(
  supabase: SupabaseClient,
  channelId: string,
  interactionType: "text" | "voice",
  isDirectlyMentioned = false,
): Promise<boolean> {
  const policy = await getChannelAiPolicy(supabase, channelId);

  if (interactionType === "text") {
    switch (policy.text_participation) {
      case "disabled":
        return false;
      case "mention_only":
        return isDirectlyMentioned;
      case "proactive":
        return true;
    }
  }

  if (interactionType === "voice") {
    switch (policy.voice_participation) {
      case "disabled":
        return false;
      case "listen_only":
        // listen_only means the AI can process audio but not generate speech responses
        return false;
      case "interactive":
        return true;
    }
  }

  return false;
}
