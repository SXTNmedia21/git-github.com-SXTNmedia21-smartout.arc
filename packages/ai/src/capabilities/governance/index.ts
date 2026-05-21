// packages/ai/src/capabilities/governance/index.ts
//
// Governance capability — read-only probes on the governance/readiness
// layer. Created Phase 5 per ADR-0095 as a dependency of shift_lifecycle.
//
// No write tools yet. Read-only tools do not call gate_action (ADR-0099).
//
// ADR-0379a (A3): `list_mandatory_protocols_for_role` added as a read-only
// tool surfacing the `profession_training` spine. Zero behavior change to
// existing tools or the ADR-0163 chat-only ceiling.
//
// Channel decision (ADR-0078):
//   `check_readiness` contains employee-PII (profile_id → missing protocols)
//   and is chat-only per ADR-0163.
//   `list_mandatory_protocols_for_role` accepts only a role slug (no PII), so
//   it is voice-safe in principle — but the capability-level `allowedChannels`
//   applies to ALL tools in this group. Keeping the ceiling at ["chat"] is the
//   conservative ADR-0163-preserving choice; upgrading to ["chat","voice"]
//   should be a separate ADR once check_readiness is given its own channel guard.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { checkReadiness, listMandatoryProtocolsForRole } from "./tools.js";

const tools = [checkReadiness, listMandatoryProtocolsForRole] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const governanceCapability: CapabilityDefinition = {
  name: "governance",
  description:
    "Governance readiness probes: check whether an employee has completed all assigned policies/protocols before Decision-layer mutations. Also surfaces mandatory protocols for a role slug via list_mandatory_protocols_for_role (ADR-0379a).",
  // ADR-0163 — employee-identifying readiness (profile_id → missing policies): chat-only.
  // list_mandatory_protocols_for_role is PII-free but the capability-level ceiling must
  // remain chat-only to preserve ADR-0163 for check_readiness. Upgrade to chat+voice
  // in a separate ADR when check_readiness adds its own per-tool channel guard.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "governance",
  defaultAuthority: "read_only",
  tools,
  readOnlyTools: tools,
};

export { checkReadiness, listMandatoryProtocolsForRole };
