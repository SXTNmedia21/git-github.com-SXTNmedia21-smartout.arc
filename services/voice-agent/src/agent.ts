// agent.ts — Mr. Botsson LiveKit voice agent entry point.
//
// Wires:
//   - Mission dispatch: room name pattern resolves mission → system prompt + voice.
//     {ws}:wizard:{user}  → lise-interview  (warm wizard guide, voice=coral)
//     {ws}:dashboard:{u}  → mr-botsson      (Jarvis butler, voice=mark)
//     fallback            → mr-botsson
//   - Context pipe: listens for "botsson-context" data messages (workspace_id,
//     profile_id, route). Sent by BotssonVoiceCall after room connect.
//   - Full tool surface: orb control + personal utility + capability queries.
//     All tools route via stage-engine /agent/chat (ADR-0132).
//   - Channel policy: channel="voice" forwarded to stage-engine; chat-only
//     tools (payroll, AML validation, contract mutations) reject gracefully
//     from stage-engine's Layer 3 channel guard (ADR-0078).
//   - Activity events: tool_call + tool_response published over
//     "botsson-activity" data channel for Arena LogView.
//
// ADR-0220: Botsson is the sole conversational front door.
// ADR-0151: workspace_id / profile_id resolved via JWT at BFF token-mint;
//           context_init carries these trusted values.

import { type JobContext, WorkerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import { RoomEvent } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { setSessionContext, parseContextPayload } from "./context.js";
import { setActiveLkRoomForAdapter, buildAllBotssonTools } from "./adapter.js";
import { MISSION_MANIFEST, getMissionManifest } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";

// ── Mission resolution from room name ────────────────────────────────────────
//
// Room name pattern (minted in apps/web/src/app/api/wizard/start/route.ts):
//   {workspaceId}:wizard:{userId}    → lise-interview (onboarding interview flow)
//   {workspaceId}:dashboard:{userId} → mr-botsson (in-dashboard assistant)
//   fallback                         → mr-botsson
//
// CRITICAL: Botsson must never ask for personnummer, bankkontonummer, hjemmeadresse
// or other Høy-PII over voice (ADR-0078). If a user asks about such data, Botsson
// must redirect them to chat.

function resolveMissionIdFromRoomName(roomName: string): MissionId {
  if (roomName.includes(":wizard:")) return "lise-interview";
  if (roomName.includes(":dashboard:")) return "mr-botsson";
  return "mr-botsson";
}

// Voices supported by OpenAI Realtime API. The mission registry uses Ultravox
// voice IDs (mark, coral, etc.) — map to the OpenAI Realtime equivalents.
// Unmapped voices fall back to "verse" (neutral, previously the default).
const ULTRAVOX_TO_OPENAI_VOICE: Record<string, string> = {
  coral: "coral",
  verse: "verse",
  mark: "verse", // no direct OpenAI equivalent — verse is closest (measured, calm)
  jessica: "shimmer",
  sarah: "shimmer",
  tina: "alloy",
  terrence: "echo",
};

function resolveOpenAIVoice(ultravoxVoice: string | undefined): string {
  if (!ultravoxVoice) return "verse";
  return ULTRAVOX_TO_OPENAI_VOICE[ultravoxVoice.toLowerCase()] ?? "verse";
}

// ── Agent entry point ─────────────────────────────────────────────────────────

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`[botsson-voice] connected to room: ${ctx.room.name}`);

    // Register the Room with adapter-internal so orb tools can publish events.
    setActiveLkRoomForAdapter(ctx.room);

    // Resolve mission from room name — drives system prompt + voice.
    // ctx.room.name is string | undefined per @livekit/rtc-node types.
    const missionId = resolveMissionIdFromRoomName(ctx.room.name ?? "");
    const manifest = getMissionManifest(missionId) ?? MISSION_MANIFEST["mr-botsson"];
    const resolvedVoice = resolveOpenAIVoice(manifest.voice);

    console.log(`[botsson-voice] mission resolved: ${missionId}, voice: ${resolvedVoice}`);

    // Listen for context messages from the browser.
    // BotssonVoiceCall publishes:
    //   - "context_init"  on connect (workspace_id, profile_id, role, etc.)
    //   - "context_route" on route change (current page + focused entity)
    ctx.room.on(
      RoomEvent.DataReceived,
      (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
        const msg = parseContextPayload(payload, topic);
        if (msg) {
          setSessionContext(msg);
          console.log(`[botsson-voice] context updated: ${msg.type}`);
        }
      },
    );

    // Clear Room ref on disconnect.
    ctx.room.on(RoomEvent.Disconnected, () => {
      setActiveLkRoomForAdapter(undefined);
      console.log(`[botsson-voice] disconnected from room: ${ctx.room.name}`);
    });

    // Build the complete tool surface for this session.
    const tools = buildAllBotssonTools();

    // Mission system prompt is loaded from MISSION_MANIFEST which is derived
    // from MISSIONS in packages/ai/src/missions/registry.ts. The manifest entry
    // only carries display metadata (no systemPrompt) — we need the full mission
    // for the prompt. Import getMission for the full entry.
    const { getMission } = await import("@smartout/ai/missions");
    const fullMission = getMission(missionId);
    const systemPrompt = fullMission?.systemPrompt ?? "";

    const agent = new voice.Agent({
      instructions: systemPrompt,
      tools,
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: resolvedVoice,
        modalities: ["text", "audio"],
        speed: 1.2,
        // Snappier turn-taking. OpenAI Realtime defaults silence_duration to
        // 500 ms which feels laggy in conversation. 250 ms is the sweet spot
        // before false-end-of-turn on natural pauses. interrupt_response
        // keeps barge-in working — user can cut Botsson off mid-sentence.
        turnDetection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 200,
          silence_duration_ms: 250,
          create_response: true,
          interrupt_response: true,
        },
      }),
    });

    await session.start({ agent, room: ctx.room });

    // Mission-specific first speaker: lise-interview opens immediately, mr-botsson waits.
    if (fullMission?.firstSpeaker === "agent") {
      session.generateReply({
        instructions:
          manifest.greeting || "Hils brukeren kort og varmt på norsk. Maks to setninger.",
      });
    }
    // firstSpeaker === "user" (mr-botsson) → Jarvis-mode, stay silent until addressed.
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
