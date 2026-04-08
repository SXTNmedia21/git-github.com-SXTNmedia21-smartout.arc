/**
 * Channel guard for InputRequestDescriptor.
 *
 * Refuses to surface an InputRequest to the user if the active session channel is not in the
 * descriptor's allowed_channels list. PII fields are mechanically forced to chat-only by
 * buildInputRequest(), so this guard's primary job is to enforce that constraint at the
 * runtime boundary, before the descriptor is rendered.
 *
 * Per ADR-0078: three-layer channel restriction (process, capability, tool). This is the
 * tool-output enforcement layer — the InputRequest itself carries the constraint, and the
 * runtime that hands it to the UI must consult this guard.
 */

import type { InputRequestDescriptor, SessionChannel } from "./types.js";

export type ChannelGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string; suggested_channel?: SessionChannel };

/**
 * Checks whether an InputRequest can be safely surfaced over the given channel.
 *
 * @param request The InputRequestDescriptor a tool has returned.
 * @param channel The current session's active channel.
 * @returns ChannelGuardResult — `{allowed: true}` or `{allowed: false, reason}`.
 */
export function checkChannelGuard(
  request: InputRequestDescriptor,
  channel: SessionChannel,
): ChannelGuardResult {
  // No constraint declared — descriptor is open to all channels.
  if (!request.allowed_channels || request.allowed_channels.length === 0) {
    return { allowed: true };
  }

  if (request.allowed_channels.includes(channel)) {
    return { allowed: true };
  }

  // Channel is not allowed. Build a useful refusal reason.
  const piiFields = request.fields.filter((f) => f.sensitivity === "pii").map((f) => f.label);
  const isPiiBlock = piiFields.length > 0;

  const reason = isPiiBlock
    ? `Sensitive data (${piiFields.join(", ")}) cannot be collected over '${channel}'. Switch to chat or escalate to admin per ADR-0081.`
    : `This input is restricted to channels: ${request.allowed_channels.join(", ")}. Active channel is '${channel}'.`;

  // Suggest the most user-friendly fallback if chat is allowed.
  const suggested_channel: SessionChannel | undefined = request.allowed_channels.includes("chat")
    ? "chat"
    : request.allowed_channels[0];

  return { allowed: false, reason, suggested_channel };
}

/**
 * Builds a tool-output string when an InputRequest is rejected by the channel guard. This is
 * what the agent runtime returns to the LLM in place of the descriptor, so the LLM can
 * decide how to respond (typically: "Please switch to chat" or "I'll escalate to admin").
 */
export function formatChannelRejection(
  result: Extract<ChannelGuardResult, { allowed: false }>,
): string {
  const suggestion = result.suggested_channel
    ? ` Suggested channel: ${result.suggested_channel}.`
    : "";
  return `[input_request_rejected] ${result.reason}${suggestion}`;
}
