// ============================================
// find-related.ts — Sibling triggers + processes
// Returns engine_trigger.event_type values + engine_process names that
// share the journey's module/slug prefix, plus other journeys in the
// same module. Helps the agent learn naming conventions.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyOpsToolContext } from "./types";
import type { Database } from "@smartout/supabase";

export const findRelated = defineTool({
  name: "find_related",
  description:
    "Look up sibling engine_trigger.event_type values and engine_process " +
    "ids for a given module, plus other journeys in the same module. " +
    "Use this to learn naming conventions before proposing a binding.",
  schema: z.object({
    module: z.string().describe("Module to search siblings within"),
    limit: z.number().int().min(1).max(100).default(50),
  }),

  async execute({ module, limit }, ctx: JourneyOpsToolContext) {
    const [triggersRes, processesRes, journeysRes] = await Promise.all([
      ctx.admin.from("engine_trigger").select("event_type, process_id").limit(500),
      ctx.admin.from("engine_process").select("id, name").limit(500),
      ctx.admin
        .from("journey")
        .select("code, slug, title, status, trigger_event, step_event_type, entity_type")
        .eq("module", module as Database["public"]["Enums"]["journey_module"])
        .order("code")
        .limit(limit),
    ]);

    const triggers = (triggersRes.data ?? [])
      .map((r) => r.event_type)
      .filter((t) => t && t.startsWith(`${module}.`));
    const processes = (processesRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));

    const distinctTriggers = [...new Set(triggers)].sort();
    const triggerPrefixCounts = distinctTriggers.reduce<Record<string, number>>((acc, t) => {
      const head = t.split(".").slice(0, 2).join(".");
      acc[head] = (acc[head] ?? 0) + 1;
      return acc;
    }, {});

    const stepEvents = distinctTriggers.filter((t) => t.includes(".step.") || t.endsWith(".step"));

    return JSON.stringify(
      {
        module,
        sibling_journeys: (journeysRes.data ?? []).map((j) => ({
          code: j.code,
          slug: j.slug,
          title: j.title,
          status: j.status,
          binding: {
            trigger_event: j.trigger_event,
            step_event_type: j.step_event_type,
            entity_type: j.entity_type,
          },
        })),
        sibling_triggers: distinctTriggers,
        trigger_prefix_counts: triggerPrefixCounts,
        sibling_step_event_types: stepEvents,
        sibling_process_ids: processes.map((p) => p.id).slice(0, 30),
      },
      null,
      2,
    );
  },
});
