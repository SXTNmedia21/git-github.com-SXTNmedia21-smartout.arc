// ============================================
// lookup-journeys.ts — Browse journeys (admin scope)
// Returns a compact index of journeys matching filters.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { Database } from "@smartout/supabase";
import type { JourneyOpsToolContext } from "./types";

export const lookupJourneys = defineTool({
  name: "lookup_journeys",
  description:
    "List/search journeys across all workspaces. Use this to keep an index, " +
    "find related journeys, or check what already exists before suggesting " +
    "changes. Filters compose with AND.",
  schema: z.object({
    module: z.string().optional().describe("Filter by module name"),
    actor: z.string().optional().describe("Filter by actor type"),
    status: z.string().optional().describe("Filter by journey status"),
    keyword: z.string().optional().describe("Search title, slug, and trigger_description (ilike)"),
    limit: z.number().int().min(1).max(50).default(20),
  }),

  async execute({ module, actor, status, keyword, limit }, ctx: JourneyOpsToolContext) {
    let query = ctx.admin
      .from("journey")
      .select(
        "journey_id, code, slug, title, module, actor, status, priority, version, trigger_event, step_event_type, entity_type, engine_process_id",
      )
      .order("code", { ascending: true })
      .limit(limit);

    if (module) query = query.eq("module", module as Database["public"]["Enums"]["journey_module"]);
    if (actor) query = query.eq("actor", actor as Database["public"]["Enums"]["journey_actor"]);
    if (status) query = query.eq("status", status as Database["public"]["Enums"]["journey_status"]);
    if (keyword)
      query = query.or(
        `title.ilike.%${keyword}%,slug.ilike.%${keyword}%,trigger_description.ilike.%${keyword}%`,
      );

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data || data.length === 0) return "No matching journeys.";

    return JSON.stringify(
      {
        count: data.length,
        rows: data.map((j) => ({
          id: j.journey_id,
          code: j.code,
          slug: j.slug,
          title: j.title,
          module: j.module,
          actor: j.actor,
          status: j.status,
          priority: j.priority,
          version: j.version,
          compiled: Boolean(j.engine_process_id),
          binding_set: Boolean(j.trigger_event && j.step_event_type && j.entity_type),
        })),
      },
      null,
      2,
    );
  },
});
