// adapter.ts — LiveKit voice adapter for Mr. Botsson.
//
// Provides:
//   1. ask(query, label) — forwards a natural-language query to stage-engine
//      /agent/chat and emits tool_call + tool_response activity events for
//      Arena LogView.
//   2. buildAllBotssonTools() — returns a merged ToolContext ready to be passed
//      as the `tools` option to `new voice.Agent({ instructions, tools })`.
//   3. setActiveLkRoomForAdapter(room) — registers the Room ref with
//      adapter-internal so orb tools can publish data-channel events.
//
// Design constraints:
//   - voice-agent is a standalone Node.js process. It does NOT import
//     @smartout/ai or packages/ai directly. All capability invocations route
//     via stage-engine POST /agent/chat (ADR-0132).
//   - channel="voice" is forwarded on every ask() call so chat-only tools
//     (payroll, validate_aml_14_6, contract mutations) reject gracefully from
//     the stage-engine capability's Layer 3 channel guard (ADR-0078).
//   - workspace_id + profile_id come from the context_init message (sent by
//     BotssonVoiceCall after the BFF token-mint resolved them via JWT).
//     ADR-0151 compliance: no forgeable client fields on the voice path because
//     the BFF already validated them before minting the room token.

import type { llm } from "@livekit/agents";
import type { Room } from "@livekit/rtc-node";

import { setActiveLkRoom, _publishActivity } from "./adapter-internal.js";
import { orbTools } from "./tools-orb.js";
import { buildPersonalTools } from "./tools-personal.js";
import { buildCapabilityQueryTools } from "./tools-capability.js";
import { getSessionContextSnapshot } from "./context.js";

// ---------------------------------------------------------------------------
// Stage-engine ask() — single bridge from voice to capabilities
// ---------------------------------------------------------------------------

const STAGE_ENGINE_URL = process.env.STAGE_ENGINE_URL ?? "http://localhost:5010";

type StageEngineResponse = {
  response?: string;
  error?: string;
};

/**
 * Forward a natural-language query to stage-engine /agent/chat.
 *
 * The stage-engine intent-classifier picks the right capability tool.
 * channel="voice" is forwarded so chat-only tools reject with a Norwegian
 * "bruk chat" message (ADR-0078 Layer 3 defence-in-depth).
 *
 * Emits tool_call + tool_response activity events for Arena LogView.
 */
export async function ask(query: string, label: string): Promise<string> {
  const ctx = getSessionContextSnapshot();
  if (!ctx.user || !ctx.workspace) {
    return "Botsson er ikke klar ennå — brukerdata mangler. Prøv igjen om et øyeblikk.";
  }

  const sessionId = `voice-${ctx.workspace.workspace_id}-${ctx.user.profile_id}`;
  const startMs = Date.now();

  _publishActivity({ type: "tool_call", tool: label, label, query });

  try {
    const res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ADR-0289 + Fase 4: service JWT authenticates voice-agent to stage-engine.
        // Expires: see SMA-295. Rotate every 30 days (due: mint date + 25 days).
        Authorization: `Bearer ${process.env.BOTSSON_SERVICE_JWT ?? ""}`,
      },
      body: JSON.stringify({
        message: query,
        session_id: sessionId,
        channel: "voice",
        // workspace_context threads the correct workspace through chat.ts
        // effectiveWorkspaceId path (ADR-0151). profile_id removed from body
        // per ADR-0151 — server-derived from JWT.
        workspace_context: {
          workspace_id: ctx.workspace.workspace_id,
          name: ctx.workspace.name,
          niche: ctx.workspace.niche,
          active_season_id: ctx.workspace.active_season_id,
          active_framework_id: ctx.workspace.active_framework_id,
          planning_cycle_id: ctx.workspace.planning_cycle_id,
        },
      }),
    });

    if (!res.ok) {
      const errText = `stage-engine ${res.status}`;
      _publishActivity({
        type: "tool_response",
        tool: label,
        label,
        durationMs: Date.now() - startMs,
        response: errText,
      });
      return "Beklager, kunne ikke nå tjenesten akkurat nå. Prøv via chat.";
    }

    const data = (await res.json()) as StageEngineResponse;
    const response = data.response ?? "Ingen respons.";

    _publishActivity({
      type: "tool_response",
      tool: label,
      label,
      durationMs: Date.now() - startMs,
      response,
    });

    return response;
  } catch (err) {
    const errText = err instanceof Error ? err.message : String(err);
    _publishActivity({
      type: "tool_response",
      tool: label,
      label,
      durationMs: Date.now() - startMs,
      response: errText,
    });
    return "Beklager, nettverksfeil. Prøv via chat.";
  }
}

// ---------------------------------------------------------------------------
// Room ref registration
// ---------------------------------------------------------------------------

/**
 * Register the active Room with adapter-internal so orb tools can publish
 * data channel events. Call once when the room is ready (before session.start).
 */
export function setActiveLkRoomForAdapter(room: Room | undefined): void {
  setActiveLkRoom(room);
}

// ---------------------------------------------------------------------------
// Tool registry — merged ToolContext for voice.Agent
// ---------------------------------------------------------------------------

/**
 * Build the complete ToolContext for Botsson's LiveKit voice session.
 *
 * Returns a merged record of all tools ready to be passed as:
 *   new voice.Agent({ instructions, tools: buildAllBotssonTools() })
 *
 * Tool surface:
 *   Orb control      : expand, collapse, pulse, pin, unpin, move, set_state
 *   Personal utility : add_note, create_task, set_reminder, get_history,
 *                      update_setting
 *   Capability reads : get_my_shifts, check_contract_status, get_my_missions,
 *                      cite_legal_paragraph, get_governance_summary,
 *                      get_helpdesk_status, get_training_progress,
 *                      query_operations, get_my_profile, get_knowledge
 *   Fallback         : query_smartout (free-form → stage-engine)
 *
 * Channel policy (ADR-0078):
 *   - channel="voice" forwarded to stage-engine on every ask().
 *   - Chat-only tools (payroll, validate_aml_14_6, contract mutations) return
 *     "Av sikkerhetshensyn må dette skje i chat" from stage-engine.
 *   - Voice-safe tools (cite_law, mission, personal, orb, shift reads) respond.
 */
export function buildAllBotssonTools(): llm.ToolContext {
  const personalTools = buildPersonalTools(ask);
  const capabilityTools = buildCapabilityQueryTools(ask);
  return {
    ...orbTools,
    ...personalTools,
    ...capabilityTools,
  };
}
