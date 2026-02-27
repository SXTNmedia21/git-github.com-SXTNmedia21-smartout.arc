// packages/ai/src/tools/onboarding.ts
import { z } from "zod";
import { defineTool } from "../types";
import type { SessionContext } from "../session-context";

export const saveTranscription = defineTool({
  name: "save_transcription",
  description:
    "Save a voice transcription entry. Call this for each meaningful user statement during the interview.",
  schema: z.object({
    speaker: z.enum(["user", "agent"]).describe("Who said it"),
    text: z.string().describe("The transcribed text"),
  }),
  execute: async (
    { speaker, text },
    ctx: SessionContext,
  ) => {
    await ctx.appendTranscript(speaker, text);
    return "Transcription saved.";
  },
});

export const saveIntelligenceReport = defineTool({
  name: "save_intelligence_report",
  description:
    "Save a markdown intelligence report for a specific topic (e.g., 'departments', 'leadership', 'locations').",
  schema: z.object({
    topic: z
      .string()
      .describe("Report topic key (e.g., 'departments', 'leadership')"),
    content_markdown: z
      .string()
      .describe("The markdown report content"),
  }),
  execute: async (
    { topic, content_markdown },
    ctx: SessionContext,
  ) => {
    await ctx.saveAnalysis(topic, content_markdown);
    return `Report '${topic}' saved.`;
  },
});

export const updateIntelligence = defineTool({
  name: "update_intelligence",
  description:
    "Update the structured intelligence data (departments, teams, locations, positions) based on what the user has described so far.",
  schema: z.object({
    departments: z.array(z.string()).optional().describe("Department names"),
    teams: z.array(z.string()).optional().describe("Team names"),
    locations: z.array(z.string()).optional().describe("Physical location names"),
    positions: z.array(z.string()).optional().describe("Position/role names"),
  }),
  execute: async (data, ctx: SessionContext) => {
    await ctx.updateSuggestions(data);
    const saved = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    return `Updated: ${saved.join(", ")}.`;
  },
});

/** All onboarding tools. Pass to an adapter to use with a specific framework. */
export const ONBOARDING_TOOLS = [
  saveTranscription,
  saveIntelligenceReport,
  updateIntelligence,
] as const;
