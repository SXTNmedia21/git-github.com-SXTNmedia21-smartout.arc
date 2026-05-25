/**
 * availability capability tools (D2 source-data per ADR-0200).
 *
 * Three tools:
 *   - set_own_availability      (voice-OK per ADR-0202; gated autonomous/employee)
 *   - clear_own_availability    (voice-OK per ADR-0202; gated autonomous/employee)
 *   - query_others_availability (chat-only per ADR-0202; gated read_only/employee)
 *
 * Capability names are DOTTED so engine_authority_config can gate per
 * action independently (availability.set_own / .clear_own / .query_others).
 *
 * All three tools MUST call gate_action (ADR-0201) before any DB read/write.
 * query_others is read_only in the authority map, but "read_only" does NOT
 * mean skip the gate — it means the tool-selector surfaces it to agents
 * without raising authority. The gate row stays the CVE-class safety line
 * (L-0066 / L-0097).
 *
 * Writes use ctx.supabaseAdmin since gate_action is the authority decision
 * (belt-and-suspenders: RLS on employee_availability also enforces
 * profile_id = auth.uid() for the JWT path — Task G).
 *
 * Emits three events (registered in packages/telemetry/src/registry.ts,
 * ADR-0175 contract): availability.set_own / availability.cleared /
 * availability.queried. set_own + cleared route to 4 destinations
 * (posthog + logger + activity_trail + engine_event); queried routes to 3
 * (no engine_event — queries aren't state mutations, L-0023).
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

// Dotted capability literals — one engine_authority_config row per tool.
const CAPABILITY_SET_OWN = "availability.set_own" as const;
const CAPABILITY_CLEAR_OWN = "availability.clear_own" as const;
const CAPABILITY_QUERY_OTHERS = "availability.query_others" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ── set_own_availability ────────────────────────────────────────────────────
// Voice-OK per ADR-0202 split — own availability is not PII-sensitive and
// fits voice ergonomics ("I can't work next Tuesday"). Gated autonomous/
// employee by default.
export const setOwnAvailability = defineTool({
  name: "set_own_availability",
  description:
    "Register an availability preference for yourself — a window when you can/cannot work, or have a preference. Voice-OK (per ADR-0202).",
  capability: CAPABILITY_SET_OWN,
  schema: z.object({
    valid_from: z
      .string()
      .describe("ISO-8601 timestamp — start of the availability window (inclusive)."),
    valid_to: z
      .string()
      .optional()
      .describe("ISO-8601 timestamp — end of the window (inclusive). Omit for open-ended."),
    rrule: z
      .string()
      .optional()
      .describe(
        "Optional RFC 5545 RRULE for recurring availability (e.g. every Monday). Omit for one-off.",
      ),
    preference_type: z
      .string()
      .describe(
        "Preference class: 'unavailable', 'preferred', 'blocked', etc. (free-text; validated by Task G enum if present).",
      ),
    reason: z.string().optional().describe("Optional free-text explanation."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // ADR-0201: mandatory gate BEFORE any DB read/write. Fail CLOSED on
    // RPC error (handled inside callGateAction). Default-allow is banned.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_SET_OWN,
      channel,
      actionType: "set_own",
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        reason: "authority_denied" as const,
        detail: gate.reason ?? "denied",
      });
    }

    // Insert owned availability. profile_id = actor, created_by = actor,
    // workspace_id from context. RLS on the JWT path also enforces
    // profile_id = auth.uid() — but we're using supabaseAdmin because
    // gate_action already made the authority decision.
    const { data, error } = await supabase
      .from("employee_availability")
      .insert({
        profile_id: ctx.profileId,
        created_by: ctx.profileId,
        workspace_id: ctx.workspaceId,
        valid_from: params.valid_from,
        valid_to: params.valid_to ?? null,
        rrule: params.rrule ?? null,
        preference_type: params.preference_type,
        reason: params.reason ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return JSON.stringify({
        ok: false as const,
        reason: "insert_failed" as const,
        detail: error?.message ?? "no row returned",
      });
    }

    // Emit registered event — 4 destinations (posthog + logger +
    // activity_trail + engine_event). entity_type = "availability".
    void emit({
      event: "availability.set_own",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "availability",
        entity_id: data.id,
        data: {
          availability_id: data.id,
          profile_id: ctx.profileId,
          workspace_id: ctx.workspaceId,
          preference_type: params.preference_type,
          valid_from: params.valid_from,
          valid_to: params.valid_to ?? null,
          rrule: params.rrule ?? null,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      availability_id: data.id,
    });
  },
});

// ── clear_own_availability ──────────────────────────────────────────────────
// Voice-OK per ADR-0202 split. Double-checks ownership via the WHERE
// clause (profile_id = ctx.profileId) as a belt alongside gate_action and
// RLS.
export const clearOwnAvailability = defineTool({
  name: "clear_own_availability",
  description:
    "Remove one of your own availability preferences by its ID. Voice-OK (per ADR-0202).",
  capability: CAPABILITY_CLEAR_OWN,
  schema: z.object({
    availability_id: z
      .string()
      .uuid()
      .describe("The employee_availability.id to delete. Must belong to the caller."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_CLEAR_OWN,
      channel,
      actionType: "clear_own",
      entityId: params.availability_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        reason: "authority_denied" as const,
        detail: gate.reason ?? "denied",
      });
    }

    // Double-check ownership in the DELETE. Even with admin client, we
    // refuse to delete rows the caller doesn't own — matches the RLS
    // intent from Task G.
    const { data, error } = await supabase
      .from("employee_availability")
      .delete()
      .eq("id", params.availability_id)
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .select("id");

    if (error) {
      return JSON.stringify({
        ok: false as const,
        reason: "delete_failed" as const,
        detail: error.message,
      });
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        ok: false as const,
        reason: "not_found" as const,
      });
    }

    void emit({
      event: "availability.cleared",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "availability",
        entity_id: params.availability_id,
        data: {
          availability_id: params.availability_id,
          profile_id: ctx.profileId,
          workspace_id: ctx.workspaceId,
        },
      },
    });

    return JSON.stringify({ ok: true as const });
  },
});

// ── query_others_availability ───────────────────────────────────────────────
// Chat-only per ADR-0202 — querying other employees' availability exposes
// second-party data and fits chat ergonomics, not voice. The channel guard
// in this tool + the capability-level allowedChannels list are both needed:
// capability gates at router-time, tool gates at execute-time (defence-in-
// depth L-0097).
export const queryOthersAvailability = defineTool({
  name: "query_others_availability",
  description:
    "Query colleagues' availability preferences within a date window. Chat-only (per ADR-0202 — reveals second-party data).",
  capability: CAPABILITY_QUERY_OTHERS,
  schema: z.object({
    start_date: z.string().describe("ISO-8601 date — start of the query window (inclusive)."),
    end_date: z.string().describe("ISO-8601 date — end of the query window (inclusive)."),
    profile_ids: z
      .array(z.string().uuid())
      .optional()
      .describe("Optional profile_ids to filter by. Omit to query all colleagues in the window."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // ADR-0151: workspace_id is server-derived from ctx (no longer in schema).
    // Earlier versions accepted workspace_id as a tool parameter with a
    // post-hoc mismatch check; LLM tool-call could still hint cross-workspace
    // intent in payloads. Audit 2026-05-25 (cap-tools H-5) flagged this.
    //
    // ADR-0202 layer 2: defence-in-depth channel guard. The capability-level
    // allowedChannels (["chat"]) also blocks at router-time; this inline
    // check covers the case where a tool is invoked outside the normal router
    // (e.g. Ultravox adapter misconfigured).
    if (channel !== "chat") {
      return JSON.stringify({
        ok: false as const,
        reason: "voice_forbidden" as const,
        detail: "Availability of colleagues is only queryable over chat. Bytt til chat.",
      });
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_QUERY_OTHERS,
      channel,
      actionType: "query_others",
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        reason: "authority_denied" as const,
        detail: gate.reason ?? "denied",
      });
    }

    let query = supabase
      .from("employee_availability")
      .select(
        "id, profile_id, valid_from, valid_to, rrule, preference_type, reason, profile:profile_id(display_name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .lte("valid_from", params.end_date)
      .or(`valid_to.is.null,valid_to.gte.${params.start_date}`);

    if (params.profile_ids && params.profile_ids.length > 0) {
      query = query.in("profile_id", params.profile_ids);
    }

    const { data, error } = await query;

    if (error) {
      return JSON.stringify({
        ok: false as const,
        reason: "query_failed" as const,
        detail: error.message,
      });
    }

    const availabilities = (data ?? []).map((row) => {
      const profileRel = row.profile as unknown as { display_name: string | null } | null;
      return {
        id: row.id,
        profile_id: row.profile_id,
        display_name: profileRel?.display_name ?? null,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        rrule: row.rrule,
        preference_type: row.preference_type,
        reason: row.reason,
      };
    });

    void emit({
      event: "availability.queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "availability",
        // No single entity for a query — use workspace_id as correlation.
        entity_id: ctx.workspaceId,
        data: {
          profile_id_filter: params.profile_ids ?? null,
          start_date: params.start_date,
          end_date: params.end_date,
          result_count: availabilities.length,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      availabilities,
    });
  },
});
