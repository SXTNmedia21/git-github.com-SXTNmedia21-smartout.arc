/**
 * packages/ai/src/capabilities/scheduler/index.ts
 *
 * Scheduler capability — greedy constraint-solver schedule proposal workflow.
 *
 * 3 tools: propose_plan (web Compose), accept_proposal (mobile Approve),
 * reject_proposal (mobile Approve). All chat-only per ADR-0288.
 * Single mutateWithGate per tool per ADR-0287 / ADR-0309.
 *
 * ADR-0307 (greedy V1) + ADR-0309 (bundle proposal pattern).
 * Authority seeded per ADR-0192 in PLAN Phase 1 foundation migration.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { proposePlan, acceptProposal, rejectProposal } from "./tools.js";

// All three tools are mutations — no read-only tools in this capability.
// readOnlyTools = empty (lookups are handled by the `schedule` capability).
// suggestTools = all three (manager must confirm via C4 gate; authority config
//   decides whether to use 'confirm' or 'autonomous' per workspace).
const allTools = [proposePlan, acceptProposal, rejectProposal] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// propose_plan: Compose verb, web-only (ADR-0133). suggest authority (manager confirms).
// accept_proposal + reject_proposal: Approve verb, mobile-allowed. confirm authority.
const suggestTools = [proposePlan, acceptProposal, rejectProposal] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// Re-export tools so BFF routes can import them without going through dist/
// (pattern: @smartout/ai/capabilities/scheduler → { proposePlan, acceptProposal, rejectProposal })
export { proposePlan, acceptProposal, rejectProposal } from "./tools.js";

export const schedulerCapability: CapabilityDefinition = {
  name: "scheduler",
  description:
    "Greedy constraint-solver scheduler — propose, accept, or reject a full-cycle schedule bundle. All actions require manager role. propose_plan is web-only (Compose); accept/reject are mobile-allowed (Approve). All chat-only per ADR-0288.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // ADR-0078: all tools chat-only (voice forbidden — irreversible C4 acts).
  allowedChannels: ["chat"],
  // ADR-0191: BFF-proxied auth (web + mobile surfaces call BFF → stage-engine → capability).
  toolAuthPattern: "bff",
  // ADR-0194: emit namespace = "scheduler".
  emitPrefix: "scheduler",
  // ADR-0192: default when engine_authority_config row is missing.
  // Real production workspaces get seeded row from PLAN Phase 1 migration.
  defaultAuthority: "suggest",
};
