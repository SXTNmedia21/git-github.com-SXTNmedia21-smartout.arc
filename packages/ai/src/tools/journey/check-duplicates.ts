// ============================================
// check-duplicates.ts — Check for Duplicate Journeys
// Searches existing journeys for potential duplicates based
// on title similarity, same module+actor combination, or
// overlapping trigger descriptions.
// Connected to: journey table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { Database } from "@smartout/supabase";
import type { JourneyToolContext } from "./types";

export const checkDuplicates = defineTool({
  name: "check_duplicates",
  description:
    "Check if a proposed journey might duplicate an existing one. " +
    "Pass the draft title, module, and actor to find potential overlaps. " +
    "Always call this before saving a new journey.",
  schema: z.object({
    title: z.string().describe("Proposed journey title"),
    module: z.string().describe("Proposed module"),
    actor: z.string().describe("Proposed actor"),
  }),

  /**
   * Checks for duplicates by searching same module+actor combinations
   * and doing a fuzzy title match. Returns warnings if potential
   * duplicates are found.
   */
  async execute({ title, module, actor }, ctx: JourneyToolContext) {
    // Check same module+actor journeys
    const { data: sameModuleActor } = await ctx.supabase
      .from("journey")
      .select("code, title, slug, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("module", module as Database["public"]["Enums"]["journey_module"])
      .eq("actor", actor as Database["public"]["Enums"]["journey_actor"])
      .order("code", { ascending: true });

    // Check title similarity across all journeys
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const { data: allJourneys } = await ctx.supabase
      .from("journey")
      .select("code, title, module, actor")
      .eq("workspace_id", ctx.workspaceId);

    const titleMatches = (allJourneys ?? []).filter((j) => {
      const jTitle = j.title.toLowerCase();
      return titleWords.some((word) => jTitle.includes(word));
    });

    const parts: string[] = [];

    if (sameModuleActor && sameModuleActor.length > 0) {
      parts.push(
        `Same module (${module}) + actor (${actor}) — ${sameModuleActor.length} existing:\n` +
          sameModuleActor.map((j) => `  ${j.code}: ${j.title} [${j.status}]`).join("\n"),
      );
    }

    if (titleMatches.length > 0) {
      parts.push(
        `Title keyword overlap — ${titleMatches.length} matches:\n` +
          titleMatches.map((j) => `  ${j.code}: ${j.title} (${j.module}/${j.actor})`).join("\n"),
      );
    }

    if (parts.length === 0) {
      return "No potential duplicates found. Safe to proceed.";
    }

    return `POTENTIAL DUPLICATES:\n\n${parts.join("\n\n")}\n\nReview carefully before proceeding. Ask the user to confirm this is a new journey.`;
  },
});
