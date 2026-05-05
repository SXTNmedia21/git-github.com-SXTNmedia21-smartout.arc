// ============================================
// index.ts — Journey Agent Tool Exports
// Barrel export for all journey agent tools and context type.
// ============================================

export { lookupJourneys } from "./lookup-journeys";
export { checkDuplicates } from "./check-duplicates";
export { saveDraft } from "./save-draft";
export type { JourneyToolContext } from "./types";

import { lookupJourneys } from "./lookup-journeys";
import { checkDuplicates } from "./check-duplicates";
import { saveDraft } from "./save-draft";
import type { JourneyToolContext } from "./types";
import type { SmartoutTool } from "../../types";

/**
 * All tools available to the Journey Agent.
 * The double cast is safe — toVercelTools only reads .schema and .execute
 * from each tool, and the specific ZodObject schemas are compatible with base ZodType.
 */
export const JOURNEY_TOOLS = [
  lookupJourneys,
  checkDuplicates,
  saveDraft,
] as unknown as ReadonlyArray<SmartoutTool<JourneyToolContext>>;
