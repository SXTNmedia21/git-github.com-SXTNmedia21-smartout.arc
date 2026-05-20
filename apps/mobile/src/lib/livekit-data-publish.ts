/**
 * livekit-data-publish.ts — Utility for publishing JSON payloads on a LiveKit
 * data channel topic with retry and deduplication support.
 *
 * ADR-0297: Mobile publishes the botsson-context snapshot on the
 * "botsson-context" data-channel topic at session start so voice-agent's
 * `setSessionContext()` fires. This module is the single place that manages
 * the encode → publish → retry logic.
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
