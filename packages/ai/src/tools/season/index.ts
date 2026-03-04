// packages/ai/src/tools/season/index.ts
// Barrel export for all season lifecycle tools
export { createSeason } from "./create-season";
export { setRevenue } from "./set-revenue";
export { getReadiness } from "./get-readiness";
export { learnFactors } from "./learn-factors";
export { savePlaybook } from "./save-playbook";

import { createSeason } from "./create-season";
import { setRevenue } from "./set-revenue";
import { getReadiness } from "./get-readiness";
import { learnFactors } from "./learn-factors";
import { savePlaybook } from "./save-playbook";

/** All season lifecycle tools. Pass to an adapter to use with a specific framework. */
export const SEASON_TOOLS = [
  createSeason,
  setRevenue,
  getReadiness,
  learnFactors,
  savePlaybook,
] as const;
