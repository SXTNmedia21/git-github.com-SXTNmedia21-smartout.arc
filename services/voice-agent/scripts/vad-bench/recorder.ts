// services/voice-agent/scripts/vad-bench/recorder.ts
//
// Drives OpenAI Realtime server-VAD with WAV fixtures and captures the
// turn_end timestamp. Mirrors services/voice-agent/src/agent.ts:114-123
// turnDetection config so the bench measures the same VAD configuration
// production uses.
//
// Council R3 2026-05-08 — coordinate-system contract:
//   evt.audio_end_ms from input_audio_buffer.speech_stopped is buffer-relative
//   (same coordinate system as fixture.audio_end_ts_ms). NEVER fall back to
//   Date.now()-startedAt (wall-clock elapsed since WS open) — different
//   coordinate system, produces garbage latency numbers. If audio_end_ms is
//   absent, hard-throw per fixture.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import type { Fixture, Recording } from "./types.js";

/** Mirror of services/voice-agent/src/agent.ts:114-123 — do NOT deviate. */
const TURN_DETECTION = {
  type: "server_vad" as const,
  threshold: 0.5,
  prefix_padding_ms: 200,
  silence_duration_ms: 250,
  create_response: true,
  interrupt_response: true,
} as const;

export const TURN_DETECTION_HASH = JSON.stringify(TURN_DETECTION);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "fixtures");

/**
 * Records a single fixture against OpenAI Realtime API. Resolves with the
 * Recording row or throws on connection / API failure.
 *
 * Coordinate-system note: uses evt.audio_end_ms (buffer-relative, same
 * coord-system as fixture.audio_end_ts_ms) as turn_end_ts_ms. Hard-throws
 * if field is absent — no wall-clock fallback (council R3 2026-05-08).
 */
export async function recordFixture(fixture: Fixture, apiKey: string): Promise<Recording> {
  const wavPath = join(FIXTURES_DIR, fixture.audio_path);
  const wavBuffer = readFileSync(wavPath);
  // WAV header is 44 bytes; strip it to get raw PCM16 for OpenAI Realtime
  const pcmBuffer = wavBuffer.slice(44);
  const audio_b64 = pcmBuffer.toString("base64");

  const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`;

  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    let speechStoppedMs: number | null = null;
    let sessionConfigured = false;

    ws.on("open", () => {
      // Configure session with production turnDetection config
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            turn_detection: TURN_DETECTION,
            input_audio_format: "pcm16",
          },
        }),
      );
    });

    ws.on("message", (data: Buffer) => {
      const evt = JSON.parse(data.toString()) as Record<string, unknown>;

      if (evt.type === "session.updated" && !sessionConfigured) {
        sessionConfigured = true;
        // Send audio after session is configured
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: audio_b64,
          }),
        );
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }

      if (evt.type === "input_audio_buffer.speech_stopped") {
        // Council R3 2026-05-08: NEVER fall back to wall-clock elapsed.
        // evt.audio_end_ms is buffer-relative (same coord-system as
        // fixture.audio_end_ts_ms). Date.now()-startedAt is wall-clock
        // elapsed since WS open — different coord-system, would produce
        // garbage latency numbers (3000-30000ms range). If field absent,
        // hard-fail this fixture.
        if (typeof evt.audio_end_ms !== "number") {
          reject(
            new Error(
              `fixture ${fixture.id}: speech_stopped event missing numeric audio_end_ms field` +
                ` — buffer-relative coord-system contract broken. Event: ${JSON.stringify(evt)}`,
            ),
          );
          ws.close();
          return;
        }
        speechStoppedMs = evt.audio_end_ms;
        ws.close();
      }

      if (evt.type === "error") {
        reject(new Error(`fixture ${fixture.id}: OpenAI Realtime error: ${JSON.stringify(evt)}`));
        ws.close();
      }
    });

    ws.on("close", () => {
      const wallMs = Date.now() - startedAt;
      if (speechStoppedMs === null) {
        reject(
          new Error(
            `fixture ${fixture.id}: connection closed without speech_stopped event. ` +
              `Check WAV format (16kHz mono PCM16 required) and OPENAI_API_KEY.`,
          ),
        );
        return;
      }
      const turn_end_ts_ms = speechStoppedMs;
      const false_end = turn_end_ts_ms < fixture.audio_end_ts_ms;
      resolve({
        fixture_id: fixture.id,
        turn_end_ts_ms,
        false_end,
        wall_ms: wallMs,
      });
    });

    ws.on("error", (err: Error) => {
      reject(new Error(`fixture ${fixture.id}: WebSocket error: ${err.message}`));
    });
  });
}
