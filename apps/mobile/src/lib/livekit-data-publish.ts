/**
 * livekit-data-publish.ts — Utility for publishing JSON payloads on LiveKit
 * data channel topics with retry support.
 *
 * ADR-0297: Mobile publishes the botsson-context snapshot on the
 * "botsson-context" data-channel topic at session start so voice-agent's
 * `setSessionContext()` fires.
 *
 * P4 (mobile-voice-runtime-wire, L-0234): Adds two new helpers:
 *   - publishBotssonToolsRegister: publishes tool definitions on
 *     "botsson-tools-register" so voice-agent builds stub llm.tool() entries.
 *   - publishBotssonToolResult: publishes RPC result on "botsson-tool-result"
 *     so voice-agent's pending Promise resolves.
 *
 * Why a separate module:
 *   - Retry + dedup policy must be identical for snapshot_published +
 *     publish_failed telemetry to be meaningful. A single implementation
 *     prevents divergence.
 *   - The Room.localParticipant.publishData API is a thin wrapper; the
 *     complexity is in the retry back-off and the dedup ref update site.
 *   - Testable without a full React render (pure async function, no hooks).
 *
 * Caller contract:
 *   - Caller owns the `lastPublishedVersion` ref and passes it as an output
 *     parameter. On success this module updates it (via `onSuccess`); on
 *     failure it leaves it unchanged so a future reconnect retries.
 *   - Caller is responsible for emitting telemetry — this module returns a
 *     `PublishResult` so the caller can emit with correct IDs (workspace_id,
 *     actor_id) without this module needing to know the profile context.
 */

import type { Room } from "livekit-client";

/**
 * The payload shape the voice-agent's context.ts expects on topic
 * "botsson-context". The worker's `parseContextPayload` validates the `type`
 * discriminant — any payload that passes through must carry `type: "context_init"`.
 *
 * Matches `ContextInitMessage` in services/voice-agent/src/context.ts.
 * We do NOT import from voice-agent directly (separate package, no cross-dep).
 */
export type BotssonContextInitPayload = {
  type: "context_init";
  user: Record<string, unknown>;
  workspace: Record<string, unknown>;
  workforce?: Record<string, unknown>;
};

/**
 * One tool definition sent on "botsson-tools-register".
 *
 * Shape mirrors ClientToolDefinition from packages/ai/src/harness/types.ts —
 * duplicated here to avoid a cross-package dependency from mobile → @smartout/ai.
 * voice-agent's DataReceived handler validates the `definitions` array shape.
 */
export type MobileToolRegistrationEntry = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: string;
      description: string;
      required?: boolean;
      schema:
        | { type: "string"; enum?: string[] }
        | { type: "number" }
        | { type: "boolean" }
        | { type: "object"; properties?: Record<string, unknown> }
        | { type: "array"; items?: unknown };
    }>;
    client: Record<string, never>;
  };
};

/**
 * The payload published on "botsson-tools-register".
 * Matches the shape validated by agent.ts DataReceived handler:
 *   { definitions: ClientToolDefinition[] }
 */
export type BotssonToolsRegisterPayload = {
  definitions: MobileToolRegistrationEntry[];
};

/**
 * The payload published on "botsson-tool-result".
 * Matches the shape validated by agent.ts DataReceived handler:
 *   { call_id: string, result: string }
 *
 * Note: voice-agent expects `result` to be a plain string — not a JSON object.
 * Callers must stringify the tool result or error before passing here.
 */
export type BotssonToolResultPayload = {
  call_id: string;
  result: string;
};

export type PublishResult =
  | {
      ok: true;
      /** How many bytes were sent */
      payload_bytes: number;
      /** Monotonic ms from call-start to successful publish */
      latency_ms: number;
      /** Number of attempts (1 on first-try success, 2 on retry success) */
      attempts: number;
    }
  | {
      ok: false;
      reason: string;
      attempts: number;
    };

const RETRY_DELAY_MS = 500;
const TOPIC = "botsson-context";

/**
 * Publish a JSON payload on the "botsson-context" LiveKit data channel.
 *
 * Retry policy: one retry after RETRY_DELAY_MS on failure. Two attempts total.
 * The caller should treat 2 failures as degraded-mode and emit
 * `voice.bootstrap.publish_failed` without aborting the voice session.
 */
export async function publishBotssonContext(
  room: Room,
  payload: BotssonContextInitPayload,
): Promise<PublishResult> {
  const t0 = Date.now();
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const payload_bytes = encoded.length;
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2) {
      // Back-off before retry.
      await delay(RETRY_DELAY_MS);
    }

    try {
      await room.localParticipant.publishData(encoded, { topic: TOPIC, reliable: true });
      return {
        ok: true,
        payload_bytes,
        latency_ms: Date.now() - t0,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "publishData failed";
      // Continue to retry or fall through to failure.
    }
  }

  return {
    ok: false,
    reason: lastError,
    attempts: 2,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tool-register publish ─────────────────────────────────────────────────────

const TOOLS_REGISTER_TOPIC = "botsson-tools-register";

/**
 * Publish tool definitions on "botsson-tools-register" so voice-agent can
 * build stub llm.tool() entries for each mobile tool.
 *
 * No retry: registration is best-effort. If voice-agent never received the
 * payload, the RPC calls will never arrive — the session degrades gracefully
 * to server-side tools only. The caller emits `voice.bootstrap.tool_registered`
 * on success or `voice.bootstrap.tool_register_failed` on failure.
 *
 * Called immediately after `publishBotssonContext` succeeds (P4 ordering).
 */
export async function publishBotssonToolsRegister(
  room: Room,
  payload: BotssonToolsRegisterPayload,
): Promise<PublishResult> {
  const t0 = Date.now();
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const payload_bytes = encoded.length;

  try {
    await room.localParticipant.publishData(encoded, {
      topic: TOOLS_REGISTER_TOPIC,
      reliable: true,
    });
    return {
      ok: true,
      payload_bytes,
      latency_ms: Date.now() - t0,
      attempts: 1,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "publishData failed",
      attempts: 1,
    };
  }
}

// ── Tool-result publish ───────────────────────────────────────────────────────

const TOOL_RESULT_TOPIC = "botsson-tool-result";

/**
 * Publish a tool-call result on "botsson-tool-result" so voice-agent's
 * pending Promise for this call_id resolves.
 *
 * No retry: voice-agent has a 10 s timeout and the RPC loop is designed for
 * at-most-once delivery. A retry could deliver two results for the same
 * call_id (the second would be silently dropped by voice-agent per its
 * `pendingRPCCalls.get(callId)` guard in `resolveToolResult()`).
 *
 * Result shape: voice-agent validates `{ call_id: string, result: string }`.
 * The `result` field must be a plain string (not a JSON object).
 */
export async function publishBotssonToolResult(
  room: Room,
  payload: BotssonToolResultPayload,
): Promise<PublishResult> {
  const t0 = Date.now();
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const payload_bytes = encoded.length;

  try {
    await room.localParticipant.publishData(encoded, {
      topic: TOOL_RESULT_TOPIC,
      reliable: true,
    });
    return {
      ok: true,
      payload_bytes,
      latency_ms: Date.now() - t0,
      attempts: 1,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "publishData failed",
      attempts: 1,
    };
  }
}
