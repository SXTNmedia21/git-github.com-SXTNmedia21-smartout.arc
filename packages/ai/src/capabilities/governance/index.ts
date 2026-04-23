// packages/ai/src/capabilities/governance/index.ts
//
// Governance capability — read-only probes on the governance/readiness
// layer. Created Phase 5 per ADR-0095 as a dependency of shift_lifecycle.
//
// No write tools yet. Read-only tools do not call gate_action (ADR-0099).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { checkReadiness } from "./tools.js";

const tools = [checkReadiness] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const governanceCapability: CapabilityDefinition = {
  name: "governance",
  description:
    "Governance readiness probes: check whether an employee has completed all assigned policies/protocols before Decision-layer mutations.",
  // ADR-0163 — employee-identifying readiness (profile_id → missing policies): chat-only.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "governance",
  defaultAuthority: "read_only",
  tools,
  readOnlyTools: tools,
};

export { checkReadiness };
