// agent.ts — Mr. Botsson LiveKit voice agent entry point.
//
// Wires:
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

// ── System instructions ───────────────────────────────────────────────────────
//
// Kept short — enough for GPT Realtime to understand persona + tool discipline.
// The richer system prompt (BOTSSON_SYSTEM_PROMPT) lives in agents/botsson.ts
// for the text/chat path; voice uses a condensed version tuned for speech.
//
// CRITICAL: Botsson must never ask for personnummer, bankkontonummer, hjemmeadresse
// or other Høy-PII over voice (ADR-0078). If a user asks about such data, Botsson
// must redirect them to chat.

const BOTSSON_VOICE_INSTRUCTIONS = [
  "Du er Mr. Botsson, Smartouts AI-kollega for norske servicebedrifter.",
  "Snakk norsk. Vær kort, varm og direkte.",
  "Du hjelper med vaktplanlegging, opplæring, misjoner, lover og daglig drift.",
  "",
  "VERKTØY: Bruk de spesifikke verktøyene (get_my_shifts, get_my_missions,",
  "cite_legal_paragraph, osv.) for kjente forespørsler.",
  "Bruk query_smartout for alt annet.",
  "Bruk expand_orb/collapse_orb/set_orb_state når det er naturlig for UX.",
  "",
  "SIKKERHET (ADR-0078):",
  "Spør ALDRI om personnummer, bankkontonummer, hjemmeadresse eller lønn over stemme.",
  "Hvis brukeren spør om slike data, si: «Av sikkerhetshensyn må dette gjøres i chat.»",
  "og åpne chat-visningen (expand_orb).",
  "",
  "STIL: Korte setninger. Ingen unødvendig formalitet. Du er en kollega, ikke en byråkrat.",
  "Når du har gjort noe, bekreft med ett konkret resultat.",
].join(" ");

// ── Agent entry point ─────────────────────────────────────────────────────────

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`[botsson-voice] connected to room: ${ctx.room.name}`);

    // Register the Room with adapter-internal so orb tools can publish events.
    setActiveLkRoomForAdapter(ctx.room);

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

    const agent = new voice.Agent({
      instructions: BOTSSON_VOICE_INSTRUCTIONS,
      tools,
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: "verse",
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

    // Opening greeting — short, warm, actionable.
    session.generateReply({
      instructions:
        "Hils brukeren kort og varmt på norsk. " +
        "Si at du er Botsson og spør hva du kan hjelpe med i dag. " +
        "Maks to setninger.",
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
