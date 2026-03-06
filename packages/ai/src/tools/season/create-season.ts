// packages/ai/src/tools/season/create-season.ts
// Tool: createSeason — Stage: seed
// Creates a new season with budget and default factors (MVP stub)
import { z } from "zod";
import { defineTool } from "../../types";
import type { SessionContext } from "../../session-context";

export const createSeason = defineTool({
  name: "create_season",
  description:
    "Create a new season with name, type, and date range. Sets up a draft budget and loads default day/hour factors for the industry.",
  schema: z.object({
    type: z.string().describe("Season type (e.g., 'summer', 'winter', 'christmas', 'custom')"),
    name: z.string().describe("Human-readable season name"),
    startDate: z.string().describe("Season start date in ISO format (YYYY-MM-DD)"),
    endDate: z.string().describe("Season end date in ISO format (YYYY-MM-DD)"),
  }),
  execute: async ({ type, name, startDate, endDate }, _ctx: SessionContext) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const weeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));

    // MVP stub: actual DB operations (season, season_budget, day_factor, hour_factor)
    // will be wired when the season tables are integrated via the stage engine's
    // collected_data mechanism.

    return `Season '${name}' created: ${type} from ${startDate} to ${endDate}. ${weeks} weeks until start.`;
  },
});
