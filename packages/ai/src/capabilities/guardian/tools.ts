// packages/ai/src/capabilities/guardian/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getSignals = defineTool({
  name: "get_signals",
  description:
    "Get active guardian signals (health alerts) for the workspace. Can filter by domain, severity, or status.",
  schema: z.object({
    domain: z
      .enum(["readiness", "workspace_maturity", "agent_behavior"])
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
  schema: z.object({
    signal_id: z.string().uuid().describe("The ID of the signal to acknowledge"),
    note: z.string().optional().describe("Optional note about why it was acknowledged"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Build update payload — persist note in data JSONB if provided
    const updatePayload: Record<string, unknown> = {
      status: "acknowledged",
      acknowledged_by: ctx.profileId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (params.note) {
      // Merge note into existing data JSONB
      const { data: existing } = await supabase
        .from("guardian_signal")
        .select("data")
        .eq("id", params.signal_id)
        .single();

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
    return `Signal acknowledged.${params.note ? ` Note: ${params.note}` : ""}`;
  },
});

export const getWorkspaceHealth = defineTool({
  name: "get_workspace_health",
  description:
    "Get a summary of the workspace's health across all domains: readiness, workspace maturity, and agent behavior.",
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
