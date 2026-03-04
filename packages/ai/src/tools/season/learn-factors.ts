// packages/ai/src/tools/season/learn-factors.ts
// Tool: learnFactors — Stage: reflect
// Compares planned vs actual day/hour factors from previous seasons
import { z } from "zod";
import { defineTool } from "../../types";
import type { SessionContext } from "../../session-context";

export const learnFactors = defineTool({
  name: "learn_factors",
  description:
    "Compare planned day/hour factors against actual performance from previous seasons. Highlights where estimates were off and suggests adjustments.",
  schema: z.object({}),
  execute: async (_params, _ctx: SessionContext) => {
    // MVP stub: will compare season_budget + day_factor/hour_factor
    // against actual revenue/labor data from previous seasons

    return [
      "Factor Comparison (stub — real data pending integration):",
      "",
      "Day Factors:",
      "- No historical data available yet.",
      "- Default industry factors are being used.",
      "",
      "Hour Factors:",
      "- No historical data available yet.",
      "- Default industry factors are being used.",
      "",
      "Recommendation: Complete at least one full season to enable factor learning.",
    ].join("\n");
  },
});
