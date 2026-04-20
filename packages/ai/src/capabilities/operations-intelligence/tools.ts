// packages/ai/src/capabilities/operations-intelligence/tools.ts
// ADR-0088: Operations Intelligence capability — manager/system-scoped tools.
// Phase 1: triage_event. Phase 2+3 tools added later.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * triage_event — Classify and route an operational event.
 * On-demand tool: manager invokes during conversation to manually triage.
 * Background equivalent: ops-triage Edge Function (DB-trigger invoked).
 */
export const triageEvent = defineTool({
  name: "triage_event",
  description:
    "Classify an operational event by type, urgency, and relevance, then route to the appropriate person or channel",
  capability: "operations_intelligence",
  schema: z.object({
    event_type: z
      .string()
      .describe(
        "The engine_event event_type to triage (e.g. 'deviation.reported', 'session_task.overdue')",
      ),
    event_payload: z
      .record(z.unknown())
      .optional()
      .describe("Event payload for context enrichment"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department to scope triage. If omitted, inferred from event."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // 1. Classify the event
    const classification = classifyEvent(params.event_type, params.event_payload);

    // 2. Determine who is on shift in this department
    const deptId = params.department_id;
    let onShiftProfiles: string[] = [];
    if (deptId) {
      const now = new Date().toISOString();
      const { data: shifts } = await supabase
        .from("schedule_shift")
        .select("employee_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", deptId)
        .lte("start_time", now)
        .gte("end_time", now)
        .in("status", ["published", "confirmed"]);
      onShiftProfiles = (shifts ?? []).map((s) => s.employee_id).filter(Boolean) as string[];
    }

    // 3. Route based on classification
    const routing = {
      classification: classification.type,
      urgency: classification.urgency,
      tier: classification.tier,
      recipients: resolveRecipients(classification, onShiftProfiles),
      channels: classification.channels,
      context: {
        on_shift_count: onShiftProfiles.length,
        event_type: params.event_type,
      },
    };

    // 4. T1 fix: route via emit() registry — "ops.triage classified"
    // dispatches as "ops.triage.classified". Shape matches registry.
    await emit({
      event: "ops.triage classified",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          original_event: params.event_type,
          classification_type: classification.type,
          urgency: String(classification.urgency),
          tier: classification.tier,
        },
      },
    });

    return JSON.stringify(routing);
  },
});

// ── Classification logic ──────────────────────────────────────────────

type EventClassification = {
  type: "information" | "action_needed" | "deviation" | "emergency";
  urgency: "immediate" | "next_break" | "end_of_shift" | "next_day";
  tier: "ambient" | "active" | "critical";
  channels: string[];
};

function classifyEvent(eventType: string, payload?: Record<string, unknown>): EventClassification {
  // Critical events
  if (
    eventType.includes("temperature_violation") ||
    eventType.includes("no_show") ||
    eventType.includes("safety") ||
    payload?.severity === "critical"
  ) {
    return { type: "emergency", urgency: "immediate", tier: "critical", channels: ["push", "sms"] };
  }

  // Action-needed events
  if (
    eventType.includes("overdue") ||
    eventType.includes("deviation") ||
    eventType.includes("coverage_gap") ||
    payload?.severity === "high"
  ) {
    return { type: "action_needed", urgency: "next_break", tier: "active", channels: ["push"] };
  }

  // Flagged events (medium severity — deviation already caught above)
  if (eventType.includes("flagged")) {
    return { type: "deviation", urgency: "end_of_shift", tier: "active", channels: ["push"] };
  }

  // Default: informational
  return { type: "information", urgency: "next_day", tier: "ambient", channels: ["in_app"] };
}

function resolveRecipients(
  classification: EventClassification,
  onShiftProfiles: string[],
): { role: string; profile_ids: string[] }[] {
  if (classification.tier === "critical") {
    return [
      { role: "on_shift", profile_ids: onShiftProfiles },
      { role: "manager", profile_ids: [] }, // resolved at delivery time via role lookup
    ];
  }
  if (classification.tier === "active") {
    return [{ role: "shift_lead", profile_ids: [] }];
  }
  return [{ role: "on_shift", profile_ids: onShiftProfiles }];
}
