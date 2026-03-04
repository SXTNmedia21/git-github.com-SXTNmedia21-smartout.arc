// packages/ai/src/tools/season/set-revenue.ts
// Tool: setRevenue — Stage: revenue
// Sets revenue target and labor percentage for the season budget
import { z } from "zod";
import { defineTool } from "../../types";
import type { SessionContext } from "../../session-context";

export const setRevenue = defineTool({
  name: "set_revenue",
  description:
    "Set the total revenue target and labor cost percentage for the season. Calculates daily averages and weekday distribution hints.",
  schema: z.object({
    totalRevenue: z.number().describe("Total revenue target for the season in NOK"),
    laborPercentage: z
      .number()
      .optional()
      .default(30)
      .describe("Labor cost as percentage of revenue (default: 30)"),
  }),
  execute: async ({ totalRevenue, laborPercentage }, _ctx: SessionContext) => {
    // MVP stub: actual budget updates will be wired via collected_data mechanism

    const laborBudget = totalRevenue * (laborPercentage / 100);
    // Assume a rough 90-day season for daily avg calculation
    const estimatedDays = 90;
    const dailyAvgRevenue = Math.round(totalRevenue / estimatedDays);
    const dailyAvgLabor = Math.round(laborBudget / estimatedDays);

    return [
      `Revenue target set: ${totalRevenue.toLocaleString("nb-NO")} NOK total.`,
      `Labor budget: ${laborPercentage}% = ${laborBudget.toLocaleString("nb-NO")} NOK.`,
      `Daily averages (est. ${estimatedDays} days): ${dailyAvgRevenue.toLocaleString("nb-NO")} NOK revenue, ${dailyAvgLabor.toLocaleString("nb-NO")} NOK labor.`,
      `Tip: Weekday factors (Fri/Sat typically 1.3-1.5x) will refine daily targets.`,
    ].join("\n");
  },
});
