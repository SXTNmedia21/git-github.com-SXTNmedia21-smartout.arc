/**
 * pin-message.ts — Agent capability tool for pinning/unpinning channel messages.
 *
 * WHY: The human-author path (usePinMessage hook → pinMessageAction Server Action)
 * emits telemetry client-side in an onSuccess callback — a fire-and-forget `void emit()`
 * that races with page unload and silently drops on fast navigations (BUG-3).
 * This tool adds the agent-author path and fixes the race by co-locating the
 * awaited emit() in the server-side capability body per ADR-0415 Path A.
 *
 * Server Action pinMessageAction is updated to thin-wrap this tool so both
 * agent and human paths share the same gate + emit semantics.
 *
 * Authority: callGateAction (capability=communication) evaluates
 * engine_authority_config for action 'pin_message' / 'unpin_message'.
 * Role resolution happens inside gate_action RPC, not here — never read ctx.role.
 *
 * ADR references:
 *   ADR-0099  — gate_action RPC + four-eyes invariant
 *   ADR-0151  — server-derived workspace_id + profile_id (never body-supplied)
 *   ADR-0173  — capability boundary (communication owns channel_message)
 *   ADR-0204  — gatedMutation body-first pattern
 *   ADR-0287  — gate_action mandatory on all mutation capability tools
 *   ADR-0415  — awaited emit() co-located in capability body (Path A)
 *   L-0176    — write body first, verify compliance, then write docstring
 *   L-0177    — fail-fast on row-not-found (no silent workspace fallback)
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { callGateAction } from "./gate.js";
import { emit, nonEmpty } from "@smartout/telemetry";

export const pinMessage = defineTool({
  name: "pin_message",
  description:
    "Pin or unpin a channel message. pin=true pins the message; pin=false unpins it. " +
    "Requires manager+ authority. Gate precheck is mandatory before the UPDATE. " +
    "Telemetry is emitted server-side after a successful write (ADR-0415 Path A).",
  capability: "communication",
  schema: z.object({
    channel_message_id: z.string().uuid().describe("The UUID of the channel_message to pin/unpin"),
    channel_id: z
      .string()
      .uuid()
      .describe("The channel containing the message — used for telemetry routing"),
    pin: z.boolean().describe("true = pin the message; false = unpin it"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // ADR-0287: gate precheck before any mutation. Evaluates engine_authority_config.
    // Fail-closed on RPC error (L-0066 default-deny). Role is resolved by gate_action
    // RPC from ctx.profileId — NEVER read ctx.role here (field does not exist).
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "communication",
      actionType: params.pin ? "pin_message" : "unpin_message",
      channel: ctx.channel ?? "chat",
      entityId: params.channel_message_id,
    });

    if (!gate.allow) {
      const reason = gate.reason ?? "unknown";
      return `Cannot ${params.pin ? "pin" : "unpin"} message: authority gate denied — ${reason}.`;
    }

    // L-0177: verify the row exists in this workspace before UPDATE.
    // Explicit fail-fast avoids silent no-op when channel_message_id is stale or
    // cross-workspace (service role bypasses RLS but we must not silently succeed).
    const { data: existing, error: fetchErr } = await supabase
      .from("channel_message")
      .select("id, workspace_id")
      .eq("id", params.channel_message_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (fetchErr || !existing) {
      return `Message not found in this workspace (id=${params.channel_message_id}).`;
    }

    // Mutation — mirror the same columns used by pinMessageAction Server Action
    // (is_pinned + pinned_by + pinned_at) for RLS-bypass parity via supabaseAdmin.
    const { error: updateErr } = await supabase
      .from("channel_message")
      .update({
        is_pinned: params.pin,
        pinned_by: params.pin ? ctx.profileId : null,
        pinned_at: params.pin ? new Date().toISOString() : null,
      })
      .eq("id", params.channel_message_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateErr) {
      return `pin_message failed: ${updateErr.message}`;
    }

    // ADR-0415 Path A: awaited emit — co-located in capability body, not React onSuccess.
    // Eliminates fire-and-forget race (BUG-3) between client void-emit and page unload.
    // Uses nonEmpty() fail-fast per ADR-0134 (L-0177 complement for telemetry IDs).
    // Event shape mirrors registry.ts ChannelMessagePinned / ChannelMessageUnpinned.
    const eventName = params.pin ? "channel.message.pinned" : "channel.message.unpinned";
    await emit({
      event: eventName,
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        channel_id: params.channel_id,
        message_id: params.channel_message_id,
      },
      entity: {
        entity_type: "channel_message",
        entity_id: params.channel_message_id,
      },
    });

    return JSON.stringify({
      ok: true,
      channel_message_id: params.channel_message_id,
      pinned: params.pin,
    });
  },
});
