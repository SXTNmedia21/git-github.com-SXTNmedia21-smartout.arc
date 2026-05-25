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
// Stub tools intentionally NOT imported here — see allTools comment below.
// Re-exported at bottom of file for test/registry introspection.
import {
  tipsSetPotTool,
  tipsAdjustShareTool,
  tipsApproveDistributionTool,
  tipsQueryOwnShareTool,
} from "./tools.js";

// ADR-0422 enforcement: tools returning `not_implemented` MUST NOT be
// surfaced to the LLM router — that is the phantom-tool antipattern
// (LLM can pick, always fails, telemetry pollutes, council-class drift).
// The tool definitions stay in tools.ts so Sortie 2 (tips-leader-flows)
// and Sortie 3 (tips-employee-mobile) can fill in bodies without re-
// scaffolding. Until bodies land, capability registers ZERO tools.
//
// ADR-0196 Invariant 11 (no phantom emit) is preserved — skeletons
// don't fire events. ADR-0422 is satisfied — router never sees them.
//
// To unhide a tool: implement its body (gate_action → write → emit),
// then move it from the unused imports back into allTools below.
const allTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];
const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];

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
