/**
 * BotssonProvider channel derivation — ADR-0107.
 *
 * This module is intentionally framework-free (no React, no React Native)
 * so jest-node can exercise the security invariant directly: the `channel`
 * exposed to downstream agents MUST be derived from session mode, never
 * from a device/platform label. See ADR-0107 for the full rationale.
 */

export type BotssonMode = "voice" | "text";

/**
 * Subset of SessionChannel (`packages/ai/src/capabilities/types.ts`) that
 * the mobile provider is allowed to emit. The other members of the full
 * union ('sms' | 'email' | 'autonomous' | 'telegram' | 'system') are
 * reserved for server-side dispatchers.
 */
export type BotssonSessionChannel = "chat" | "voice";

/** Device/platform metadata for telemetry only — NEVER the channel. */
export type BotssonDeviceType = "mobile" | "tablet" | "web";

/**
 * ADR-0107: derive SessionChannel from session mode. Never from platform.
 *
 * Mode null (no active session) defaults to 'chat' so any pre-session
 * consumer sees the safest value — 'chat' keeps voice-PII tools blocked
 * until voice is actually chosen.
 */
export function deriveBotssonChannel(mode: BotssonMode | null): BotssonSessionChannel {
  return mode === "voice" ? "voice" : "chat";
}
