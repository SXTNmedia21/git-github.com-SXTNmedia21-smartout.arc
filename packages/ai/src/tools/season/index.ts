// packages/ai/src/tools/season/index.ts
// Barrel export for all season lifecycle tools
export { createSeason } from "./create-season";
export { setRevenue } from "./set-revenue";
export { getReadiness } from "./get-readiness";
export { learnFactors } from "./learn-factors";
export { savePlaybook } from "./save-playbook";
export type { SeasonToolContext } from "./types";

import { createSeason } from "./create-season";
import { setRevenue } from "./set-revenue";
import { getReadiness } from "./get-readiness";
import { learnFactors } from "./learn-factors";
import { savePlaybook } from "./save-playbook";
import type { SeasonToolContext } from "./types";
import type { SmartoutTool } from "../../types";

/**
 * All season lifecycle tools. Pass to an adapter to use with a specific framework.
 * Cast is safe — toVercelTools only reads .schema and .execute from each tool.
 */
export const SEASON_TOOLS = [
  createSeason,
  setRevenue,
  getReadiness,
  learnFactors,
  savePlaybook,
] as unknown as ReadonlyArray<SmartoutTool<SeasonToolContext>>;
