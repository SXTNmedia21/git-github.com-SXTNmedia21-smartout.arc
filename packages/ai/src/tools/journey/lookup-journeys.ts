// ============================================
// lookup-journeys.ts — Look Up Existing Journeys
// Allows the journey agent to search and browse existing
// journeys in the workspace. Used for finding related journeys,
// checking module coverage, and understanding what already exists.
// Connected to: journey table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { Database } from "@smartout/supabase";
import type { JourneyToolContext } from "./types";

export const lookupJourneys = defineTool({
  name: "lookup_journeys",
  description:
    "Search existing journeys by module, actor, keyword, or code. " +
    "Use this to find related journeys, check for gaps, and understand " +
    "what already exists before defining new ones.",
  schema: z.object({
    module: z.string().optional().describe("Filter by module name"),
    actor: z.string().optional().describe("Filter by actor type"),
    keyword: z.string().optional().describe("Search title and trigger_description"),
    limit: z.number().int().min(1).max(20).default(10).describe("Max results"),
  }),

  /**
   * Queries the journey table with optional filters.
   * Returns a formatted list of matching journeys with code, title, module, status.
   */
  async execute({ module, actor, keyword, limit }, ctx: JourneyToolContext) {
    let query = ctx.supabase
      .from("journey")
      .select("code, title, module, actor, status, priority, slug")
      .eq("workspace_id", ctx.workspaceId)
      .order("code", { ascending: true })
      .limit(limit);

    if (module) query = query.eq("module", module as Database["public"]["Enums"]["journey_module"]);
    if (actor) query = query.eq("actor", actor as Database["public"]["Enums"]["journey_actor"]);
    if (keyword)
      query = query.or(`title.ilike.%${keyword}%,trigger_description.ilike.%${keyword}%`);

    const { data, error } = await query;

    if (error) return `Error looking up journeys: ${error.message}`;
    if (!data || data.length === 0) return "No matching journeys found.";

    const rows = data.map(
      (j) => `${j.code} | ${j.title} | ${j.module} | ${j.actor} | ${j.status} | ${j.priority}`,
    );

    return `Found ${data.length} journeys:\nCode | Title | Module | Actor | Status | Priority\n${rows.join("\n")}`;
  },
});
