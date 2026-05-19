/**
 * Org capability definition — ADR-0367 BT2.
 *
 * One tool: update_dept_areas — links/unlinks department_location records.
 *
 * Authority: confirm, admin+ (seeded in BT0 Phase A authority migration).
 *
 * Channels: chat-only V1 (ADR-0078 — admin org-structure changes require text review).
 *   Per-tool channel guard at tool body level (channel === "voice" → reject).
 *
 * emitPrefix: "org" — all events under "org.*" namespace.
 *   org.dept_areas_updated (3 destinations: posthog + logger + activity_trail).
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 *
 * emitPrefix collision check (ADR-0194 + INVARIANTS.md I3):
 *   "org" prefix is new — no existing capability owns this prefix.
 *   getAllCapabilities() in registry.ts asserts uniqueness at runtime.
 *
 * Own namespace writes — no delegation needed. department_location is within
 * org namespace scope. Not owned by schedule, cascade, or any ADR-0173 frozen-4 sibling.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { updateDeptAreas } from "./tools.js";

// update_dept_areas is a mutation — no read-only tools in this capability V1.
const allTools = [updateDeptAreas] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const suggestTools = [updateDeptAreas] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const orgCapability: CapabilityDefinition = {
  name: "org",
  description:
    "Org-structure area-management surface — links and unlinks department_location records. " +
    "update_dept_areas is idempotent on 'add' (duplicate ignored at DB layer). " +
    "Admin+, confirm authority. Chat-only V1.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // Chat-only V1. Voice rejected at tool body level.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "org",
  defaultAuthority: "confirm",
};
