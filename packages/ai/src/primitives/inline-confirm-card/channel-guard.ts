/**
 * Channel guard for InlineConfirmCardDescriptor.
 *
 * Refuses to surface a card descriptor to the user if the active session channel is not in
 * the descriptor's channel_constraint list. Voice can NEVER render a card; this guard
 * enforces that mechanically at the runtime boundary before the descriptor is forwarded
 * to the BFF/browser.
 *
 * Per ADR-0078: three-layer channel restriction (process, capability, tool-output).
 * This is the tool-output enforcement layer — the InlineConfirmCardDescriptor carries
 * the constraint, and the runtime that forwards it to the UI must consult this guard
 * before emission. Stage-engine L3 result-descriptor inspection (ADR-0399 §Enforcement
 * Layer 3) calls checkInlineConfirmCardChannelGuard before emitting to BFF.
 *
 * Per ADR-0399 §Option 3: channel_constraint and platforms are independent axes.
 * This guard covers ONLY the channel axis. Platform enforcement is handled separately
 * by stage-engine's platform-filter pass (platforms array on the descriptor).
 *
 * References: ADR-0078 (channel pinning), ADR-0398 (InlineConfirmCard primitive),
 * ADR-0399 (channel + platform descriptors).
 */

import type { InlineConfirmCardDescriptor } from "./types.js";
import type { SessionChannel } from "../input-request/types.js";

export type ChannelGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string; suggested_channel?: string };

/**
 * Checks whether an InlineConfirmCardDescriptor can be safely surfaced over the given channel.
 *
 * @param descriptor The InlineConfirmCardDescriptor a tool (show_proposal_card) has produced.
 * @param activeChannel The current session's active channel.
 * @returns ChannelGuardResult — `{allowed: true}` or `{allowed: false, reason}`.
 */
export function checkInlineConfirmCardChannelGuard(
  descriptor: InlineConfirmCardDescriptor,
  activeChannel: SessionChannel,
): ChannelGuardResult {
  // channel_constraint defaults to ["chat","voice"] via Zod .default() —
  // an empty array after parse would be a schema violation, but guard defensively anyway.
  if (descriptor.channel_constraint.length === 0) {
    return { allowed: true };
  }

  if ((descriptor.channel_constraint as string[]).includes(activeChannel)) {
    return { allowed: true };
  }

  // Channel is not in the constraint list. Build a useful refusal reason.
  const allowedList = descriptor.channel_constraint.join(", ");
  const reason = `channel '${activeChannel}' not in allowed list [${allowedList}]`;

  // Suggest chat as the most user-friendly fallback when chat is in the allowed list.
  const suggested_channel: string | undefined = descriptor.channel_constraint.includes("chat")
    ? "chat"
    : descriptor.channel_constraint[0];

  return { allowed: false, reason, suggested_channel };
}

/**
 * Builds a tool-output string when an InlineConfirmCardDescriptor is rejected by the channel
 * guard. This is what stage-engine returns to the LLM in place of the descriptor (using
 * voice_prompt when available, falling back to a generic Norwegian message per ADR-0399
 * §Stage-engine maintainers).
 *
 * When voice_prompt is set on the descriptor, it carries server-controlled copy — use it
 * verbatim so the LLM reads the intended phrasing rather than synthesizing one.
 */
export function formatInlineConfirmCardChannelRejection(
  descriptor: InlineConfirmCardDescriptor,
): string {
  if (descriptor.voice_prompt) {
    return `[inline_confirm_card_rejected] ${descriptor.voice_prompt}`;
  }
  const allowedList = descriptor.channel_constraint.join(", ");
  return `[inline_confirm_card_rejected] Du har et nytt forslag til gjennomgang. Kanalen er begrenset til: ${allowedList}. Bruk chat for å bekrefte, endre eller avbryte.`;
}
