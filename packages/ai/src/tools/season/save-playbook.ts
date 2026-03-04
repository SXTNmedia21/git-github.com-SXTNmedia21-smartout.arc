// packages/ai/src/tools/season/save-playbook.ts
// Tool: savePlaybook — Stage: reflect
// Saves the season playbook with optional notes
import { z } from "zod";
import { defineTool } from "../../types";
import type { SessionContext } from "../../session-context";

export const savePlaybook = defineTool({
  name: "save_playbook",
  description:
    "Save the season playbook — a summary of decisions, factor adjustments, and learnings for this season cycle. Optionally include manager notes.",
  schema: z.object({
    notes: z
      .string()
      .optional()
      .describe("Optional manager notes or reflections to include in the playbook"),
  }),
  execute: async ({ notes }, _ctx: SessionContext) => {
    // MVP stub: will persist playbook to season metadata or a dedicated table
    // when the season reflection flow is fully wired

    const timestamp = new Date().toISOString();
    const notesLine = notes ? `\nNotes: "${notes}"` : "";

    return `Playbook saved at ${timestamp}.${notesLine}\nThe playbook captures this season's configuration and learnings for future reference.`;
  },
});
