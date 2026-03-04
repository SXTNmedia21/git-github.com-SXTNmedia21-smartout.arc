// packages/ai/src/tools/season/get-readiness.ts
// Tool: getReadiness — Stage: ready
// Returns workforce readiness report for the season
import { z } from "zod";
import { defineTool } from "../../types";
import type { SessionContext } from "../../session-context";

export const getReadiness = defineTool({
  name: "get_readiness",
  description:
    "Get the workforce readiness report for the current season. Shows how many employees have completed required protocols and policies.",
  schema: z.object({}),
  execute: async (_params, _ctx: SessionContext) => {
    // MVP stub: will query profiles + protocol_assignments to calculate
    // actual readiness scores when season tables are integrated

    return [
      "Readiness Report (stub — real data pending integration):",
      "- Total employees: —",
      "- Protocols completed: —/—",
      "- Policies acknowledged: —/—",
      "- Overall readiness: —%",
      "",
      "Note: Full readiness data will be available once season-profile assignments are wired.",
    ].join("\n");
  },
});
