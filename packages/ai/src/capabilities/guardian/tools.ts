// packages/ai/src/capabilities/guardian/tools.ts
import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callGateAction } from "./gate.js";

const CAPABILITY = "guardian" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

export const getSignals = defineTool({
  name: "get_signals",
  description:
    "Get active guardian signals (health alerts) for the workspace. Can filter by domain, severity, or status.",
  capability: "guardian",
  schema: z.object({
    domain: z
      .enum(["readiness", "workspace_maturity", "agent_behavior", "journey_health"])
      .optional()
      .describe("Filter by signal domain"),
    severity: z
      .enum(["info", "warning", "critical"])
      .optional()
      .describe("Filter by severity level"),
    status: z
      .enum(["active", "acknowledged", "resolved", "dismissed"])
      .optional()
      .default("active")
      .describe("Filter by signal status"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    let query = supabase
      .from("guardian_signal")
      .select(
        "id, signal_type, domain, severity, entity_type, entity_label, title, description, status, created_at, expires_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("severity", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(20);

    if (params.status) query = query.eq("status", params.status);
    if (params.domain) query = query.eq("domain", params.domain);
    if (params.severity) query = query.eq("severity", params.severity);

    const { data, error } = await query;
    if (error) return `Error loading signals: ${error.message}`;
    if (!data || data.length === 0) return "No signals found matching the filters.";
    return JSON.stringify(data);
  },
});

export const acknowledgeSignal = defineTool({
  name: "acknowledge_signal",
  description: "Acknowledge a guardian signal, indicating it has been seen and is being handled.",
  capability: "guardian",
  schema: z.object({
    signal_id: z.string().uuid().describe("The ID of the signal to acknowledge"),
    note: z.string().optional().describe("Optional note about why it was acknowledged"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = normaliseChannel(ctx.channel);

    // Gate check before mutation (ADR-0099 §2). acknowledge_signal updates
    // guardian_signal.status — a state mutation. Router-level gate covers
    // the turn; per-action gate is required for ADR-0099 §2 compliance.
    // Closes G4-guardian gap.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "acknowledge",
      entityId: params.signal_id,
    });
    if (!gate.allow) {
      return `Signal not acknowledged: ${gate.reason ?? "ikke tillatt"}.`;
    }

    // Load the signal row up front — `title` feeds the guardian_log summary
    // (F-CT-06 / ADR-0186) and `data` is needed for note-merge below. One read
    // covers both responsibilities.
    const { data: existing } = await supabase
      .from("guardian_signal")
      .select("title, data, entity_id")
      .eq("id", params.signal_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    // Build update payload — persist note in data JSONB if provided
    const updatePayload: Record<string, unknown> = {
      status: "acknowledged",
      acknowledged_by: ctx.profileId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (params.note) {
      updatePayload.data = {
        ...((existing?.data as Record<string, unknown>) ?? {}),
        acknowledged_note: params.note,
      };
    }

    const { error } = await supabase
      .from("guardian_signal")
      .update(updatePayload)
      .eq("id", params.signal_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active");

    if (error) return `Failed to acknowledge signal: ${error.message}`;

    // F-CT-06 / ADR-0186: every guardian state change must produce a bus
    // event. The AFTER INSERT trigger on guardian_log fires pg_notify
    // 'guardian_events', which every stage-engine instance LISTENs on and
    // fans out to its WS clients. Same shape as supabase/functions/
    // guardian-actions/index.ts.
    await supabase.from("guardian_log").insert({
      workspace_id: ctx.workspaceId,
      session_id: (existing?.entity_id as string | null) ?? "00000000-0000-0000-0000-000000000000",
      event_type: "guardian.signal_acknowledged",
      actor: "agent",
      summary: `Signal "${(existing?.title as string | undefined) ?? params.signal_id.slice(0, 8)}" acknowledged by ${ctx.profileId.slice(0, 8)}`,
      data: {
        signal_id: params.signal_id,
        action: "acknowledge",
        profile_id: ctx.profileId,
        note: params.note ?? null,
      },
    });

    // ADR-0358: register telemetry emit so PostHog + activity_trail receive
    // the event. The guardian_log insert above is the bus event for stage-
    // engine WS fan-out (ADR-0186); telemetry is a separate concern.
    // Audit 2026-05-25 (cap-tools H-2) flagged this gap.
    // L-0177 fail-fast on workspace_id + actor_id.
    void emit({
      event: "guardian_signal acknowledged",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        data: {
          signal_id: params.signal_id,
          note: params.note,
        },
      },
    });

    return `Signal acknowledged.${params.note ? ` Note: ${params.note}` : ""}`;
  },
});

export const getWorkspaceHealth = defineTool({
  name: "get_workspace_health",
  description:
    "Get a summary of the workspace's health across all domains: readiness, workspace maturity, and agent behavior.",
  capability: "guardian",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const { data, error } = await supabase
      .from("guardian_signal")
      .select("domain, severity")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active");

    if (error) return `Error loading health data: ${error.message}`;
    if (!data || data.length === 0) {
      return JSON.stringify({
        overall: "healthy",
        signals: { total: 0, critical: 0, warning: 0, info: 0 },
        domains: {},
      });
    }

    const byDomain: Record<string, { critical: number; warning: number; info: number }> = {};
    let critical = 0;
    let warning = 0;
    let info = 0;

    for (const signal of data) {
      const d = signal.domain;
      if (!byDomain[d]) byDomain[d] = { critical: 0, warning: 0, info: 0 };
      if (signal.severity === "critical") {
        critical++;
        byDomain[d].critical++;
      } else if (signal.severity === "warning") {
        warning++;
        byDomain[d].warning++;
      } else {
        info++;
        byDomain[d].info++;
      }
    }

    const overall = critical > 0 ? "critical" : warning > 0 ? "warning" : "healthy";

    return JSON.stringify({
      overall,
      signals: { total: data.length, critical, warning, info },
      domains: byDomain,
    });
  },
});
