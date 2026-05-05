/**
 * tips capability — payroll-adjacent tip distribution (ADR-0201).
 *
 * Four tools:
 *   - tips.set_pot              (suggest/manager — record pool + calculate distribution)
 *   - tips.adjust_share         (confirm/manager — adjust single employee share)
 *   - tips.approve_distribution (confirm/manager — lock pool + distributions)
 *   - tips.query_own_share      (read_only/employee — read own tip shares)
 *
 * Chat-only (ADR-0078): tips are PII-adjacent (payroll amounts, identifiable
 * per employee) — voice is not appropriate. No voice-OK exception.
 *
 * Authority rows seeded in migration 20260428100007_tips_authority_seed.sql
 * (CROSS JOIN VALUES form, verified by scripts/authority-seed-parity.ts).
 *
 * Sortie 1 scope: all tools are skeletons (not_implemented). Bodies land
 * in Sortie 2 (tips-leader-flows) and Sortie 3 (tips-employee-mobile).
 *
 * Binding ADRs: 0078 (chat-only), 0099 (gate mandatory), 0176 (authority
 *               seed via migration), 0196 (no phantom emit), 0201 (gate_action
 *               before every mutation).
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  tipsSetPotTool,
  tipsAdjustShareTool,
  tipsApproveDistributionTool,
  tipsQueryOwnShareTool,
} from "./tools.js";

// All four tools — surfaced when authority ≥ read_only.
const allTools = [
  tipsSetPotTool,
  tipsAdjustShareTool,
  tipsApproveDistributionTool,
  tipsQueryOwnShareTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Employee read-only tool: only query_own_share surfaces at read_only tier.
const readOnlyTools = [tipsQueryOwnShareTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// Suggest-tier tools: set_pot at suggest so managers can record with
// an agent-confirm UI step.
const suggestTools = [tipsSetPotTool] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const tipsCapability: CapabilityDefinition = {
  name: "tips",
  description:
    "Tip pool recording, distribution calculation, adjustment, and approval for department sessions. Chat-only (ADR-0078).",
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "tip",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};

// Re-export pure calculate function for server-action usage (Sortie 2).
export { calculate } from "./calculate.js";
export type { Distribution, Policy, Shift } from "./calculate.js";

// Re-export tools for testing + registry introspection.
export { tipsSetPotTool, tipsAdjustShareTool, tipsApproveDistributionTool, tipsQueryOwnShareTool };
