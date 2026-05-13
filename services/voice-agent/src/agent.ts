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
import { setSessionContext, parseContextPayload, getSessionContextSnapshot } from "./context.js";
import { setActiveLkRoomForAdapter, buildAllBotssonTools } from "./adapter.js";
import { MISSION_MANIFEST, getMissionManifest } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";
import { emit, nonEmpty } from "@smartout/telemetry/server";

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

// 2026-05-13: workforce snapshot rendering. Mirrors
// services/stage-engine/src/core/agent-router.ts:renderWorkforceSlice so
// voice (Realtime LLM) + chat (stage-engine LLM) see the SAME format.
// Duplicated here because voice-agent is a leaf service that does not import
// @smartout/ai for runtime code paths (only @smartout/ai/missions for the
// mission registry). PII (ADR-0078): no bank/tax/personnummer — snapshot
// upstream BFF already filtered these.
type WorkforceCtx = {
  employees: Array<{
    profile_id: string;
    display_name: string;
    role: string;
    status: string;
    department_id: string | null;
    department_name: string | null;
    phone: string | null;
  }>;
  shifts_today: Array<{
    shift_id: string;
    employee_name: string | null;
    shift_date: string;
    start_time: string;
    end_time: string;
    department_name: string | null;
    position_label: string | null;
  }>;
  shifts_tomorrow: Array<{
    shift_id: string;
    employee_name: string | null;
    shift_date: string;
    start_time: string;
    end_time: string;
    department_name: string | null;
    position_label: string | null;
  }>;
  absences_active: Array<{
    profile_id: string;
    employee_name: string | null;
    absence_type: string;
    start_date: string;
    end_date: string;
  }>;
  sessions_today: Array<{
    department_name: string | null;
    status: string;
  }>;
  snapshot_at: string;
};

function renderWorkforceSlice(wf: WorkforceCtx): string {
  const lines: string[] = ["## Arbeidsstokk"];
  const snapshotAt = new Date(wf.snapshot_at);
  const ageMin = Math.round((Date.now() - snapshotAt.getTime()) / 60000);
  lines.push(`Snapshot: ${snapshotAt.toISOString()} (${ageMin} min siden)`);

  if (wf.employees.length > 0) {
    lines.push(`\n### Ansatte (${wf.employees.length})`);
    for (const e of wf.employees.slice(0, 20)) {
      const dept = e.department_name ?? "ingen avdeling";
      const phone = e.phone ? ` | ${e.phone}` : "";
      lines.push(
        `- ${e.display_name} (${e.role}, ${e.status}) — ${dept}${phone} [profile_id=${e.profile_id}]`,
      );
    }
    if (wf.employees.length > 20) {
      lines.push(`- … +${wf.employees.length - 20} flere`);
    }
  }

  if (wf.shifts_today.length > 0) {
    lines.push(`\n### Vakter i dag (${wf.shifts_today.length})`);
    for (const s of wf.shifts_today.slice(0, 15)) {
      const who = s.employee_name ?? "ubemannet";
      const pos = s.position_label ? ` ${s.position_label}` : "";
      const dept = s.department_name ? ` @ ${s.department_name}` : "";
      lines.push(
        `- ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} ${who}${pos}${dept} [shift_id=${s.shift_id}]`,
      );
    }
  } else {
    lines.push(`\n### Vakter i dag\nIngen vakter registrert.`);
  }

  if (wf.shifts_tomorrow.length > 0) {
    lines.push(`\n### Vakter i morgen (${wf.shifts_tomorrow.length})`);
    for (const s of wf.shifts_tomorrow.slice(0, 15)) {
      const who = s.employee_name ?? "ubemannet";
      const pos = s.position_label ? ` ${s.position_label}` : "";
      const dept = s.department_name ? ` @ ${s.department_name}` : "";
      lines.push(
        `- ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} ${who}${pos}${dept} [shift_id=${s.shift_id}]`,
      );
    }
  }

  if (wf.absences_active.length > 0) {
    lines.push(`\n### Aktive fravær (${wf.absences_active.length})`);
    for (const a of wf.absences_active.slice(0, 10)) {
      const who = a.employee_name ?? `profile ${a.profile_id}`;
      lines.push(`- ${who}: ${a.absence_type} ${a.start_date} → ${a.end_date}`);
    }
  }

  if (wf.sessions_today.length > 0) {
    lines.push(`\n### Avdelingsøkter i dag (${wf.sessions_today.length})`);
    for (const sn of wf.sessions_today.slice(0, 6)) {
      const dept = sn.department_name ?? "ukjent avd";
      lines.push(`- ${dept} (${sn.status})`);
    }
  }

  return lines.join("\n");
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

    // Listen for context messages from the browser.
    // BotssonVoiceCall publishes:
    //   - "context_init"  on connect (workspace_id, profile_id, role, workforce)
    //   - "context_route" on route change (current page + focused entity)
    //
    // 2026-05-13: when context_init carries a workforce snapshot we inject it as
    // a developer message into the Realtime LLM's chat context BEFORE the user
    // speaks. Without this the Realtime LLM has to call query_smartout to find
    // any employee/shift fact (multi-second roundtrip per question). With it,
    // Botsson can answer "hvem jobber i dag?" / "finn vakt for Jonas" directly.
    ctx.room.on(
      RoomEvent.DataReceived,
      (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
        const msg = parseContextPayload(payload, topic);
        if (!msg) return;
        setSessionContext(msg);
        console.log(`[botsson-voice] context updated: ${msg.type}`);
        if (msg.type === "context_init" && msg.workforce) {
          const slice = renderWorkforceSlice(msg.workforce);
          const next = agent.chatCtx.copy();
          next.addMessage({ role: "developer", content: slice });
          void agent.updateChatCtx(next).catch((err) => {
            console.warn("[botsson-voice] workforce inject failed:", err);
          });
          console.log(
            `[botsson-voice] workforce injected: ${msg.workforce.employees.length} emp, ` +
              `${msg.workforce.shifts_today.length} shifts today`,
          );
        }
      },
    );

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: resolvedVoice,
        modalities: ["text", "audio"],
        // 2026-05-13: 1.35 vs prior 1.2 — Pontus reported "prater litt sakt"
        // on dashboard mission. Still under 1.5 (where prosody starts breaking).
        speed: 1.35,
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

    // ── Runtime voice-quality telemetry (ADR-0282 R6 amendment 2026-05-10) ─────
    //
    // Replaces synthetic VAD-bench gate (E9) with runtime observability.
    // OBSERVATIONAL only — no thresholds, no alarms, no Phase E action gates.
    // Phase F1 reads PostHog dashboards + decides if config tuning is needed.
    //
    // All four events use the resolved session_id and mission_id from this scope.
    // Context (workspace_id, profile_id) is resolved from getSessionContextSnapshot()
    // at event-fire time so late-arriving context_init messages are captured.
    // Falls back to "anon" if context hasn't arrived yet — valid for early events.

    const sessionStartMs = Date.now();
    let firstSpeechFired = false;
    let lastAgentSpeechEndMs = 0;
    let turnCount = 0;

    // Lazily resolve session meta at emit time — captures late-arriving context_init.
    // workspace_id: null when context has not arrived yet (allowed by BaseEvent for
    // platform/pre-context events per ADR-0193). When present, branded via nonEmpty().
    // actor_id: "anon" sentinel when profile not resolved yet — nonEmpty("anon") is valid.
    const getSessionMeta = () => {
      const ctx_meta = getSessionContextSnapshot();
      const rawWorkspaceId = ctx_meta.workspace?.workspace_id ?? null;
      const rawProfileId = ctx_meta.user?.profile_id ?? "anon";
      const wsStr = rawWorkspaceId ?? "anon";
      return {
        workspace_id: rawWorkspaceId !== null ? nonEmpty(rawWorkspaceId, "workspace_id") : null,
        actor_id: nonEmpty(rawProfileId, "actor_id"),
        session_id: `voice-${wsStr}-${rawProfileId}`,
      };
    };

    // 1. first_speech_ts_ms — time from session start to first user speech.
    //    Also fires user_recut if user starts speaking within 2 s of agent ending.
    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.newState === "speaking") {
        if (!firstSpeechFired) {
          firstSpeechFired = true;
          const meta = getSessionMeta();
          void emit({
            event: "voice.first_speech_ts_ms",
            workspace_id: meta.workspace_id,
            actor_id: meta.actor_id,
            properties: {
              data: {
                session_id: meta.session_id,
                mission_id: missionId,
                ts_ms: Date.now() - sessionStartMs,
              },
            },
          });
        }
        // 3. user_recut — user re-starts within 2 s of agent speech end
        if (lastAgentSpeechEndMs > 0) {
          const gap = Date.now() - lastAgentSpeechEndMs;
          if (gap < 2000) {
            const meta = getSessionMeta();
            void emit({
              event: "voice.user_recut",
              workspace_id: meta.workspace_id,
              actor_id: meta.actor_id,
              properties: {
                data: {
                  session_id: meta.session_id,
                  mission_id: missionId,
                  silence_duration_ms: gap,
                },
              },
            });
          }
        }
      }
    });

    // Track agent speech end for recut detection (reset on each agent speaking→not-speaking).
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (ev.oldState === "speaking" && ev.newState !== "speaking") {
        lastAgentSpeechEndMs = Date.now();
      }
    });

    // 2. turn_end_ts_ms — fires on each final user transcript (one per turn).
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (ev.isFinal) {
        turnCount += 1;
        const meta = getSessionMeta();
        void emit({
          event: "voice.turn_end_ts_ms",
          workspace_id: meta.workspace_id,
          actor_id: meta.actor_id,
          properties: {
            data: {
              session_id: meta.session_id,
              mission_id: missionId,
              ts_ms: Date.now() - sessionStartMs,
              turn_count: turnCount,
            },
          },
        });
      }
    });

    // 4. session_abandonment — user disconnects before first speech detected.
    //    Merged into the existing room Disconnected handler — fires only when
    //    firstSpeechFired is still false (user gave up before engaging).
    ctx.room.on(RoomEvent.Disconnected, () => {
      if (!firstSpeechFired) {
        const meta = getSessionMeta();
        void emit({
          event: "voice.session_abandonment",
          workspace_id: meta.workspace_id,
          actor_id: meta.actor_id,
          properties: {
            data: {
              session_id: meta.session_id,
              mission_id: missionId,
              ts_ms: Date.now() - sessionStartMs,
            },
          },
        });
      }
      setActiveLkRoomForAdapter(undefined);
      console.log(`[botsson-voice] disconnected from room: ${ctx.room.name}`);
    });

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
