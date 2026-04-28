// packages/ai/src/tools/season/index.ts
// Barrel export for all season lifecycle tools.
//
// Migration 2026-04-23 (M3.2, ADR-0201):
//   - All 5 tools migrated from SeasonToolContext to AgentToolContext.
//   - Canonical surface is now `seasonCapability` in
//     `packages/ai/src/capabilities/season/index.ts`.
//   - SEASON_TOOLS array retained for backward compatibility with any
//     non-agent consumer (none found at migration time, but kept to avoid
//     breaking a hypothetical external caller). Prefer capability imports.
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
import type { AgentToolContext } from "../../capabilities/types";
import type { SmartoutTool } from "../../types";

/**
 * All season lifecycle tools. Pass to an adapter to use with a specific framework.
 * Cast is safe — toVercelTools only reads .schema and .execute from each tool.
 *
 * Context shape is AgentToolContext (ADR-0191). Was SeasonToolContext pre-M3.2.
 */
export const SEASON_TOOLS = [
  createSeason,
  setRevenue,
  getReadiness,
  learnFactors,
  savePlaybook,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
