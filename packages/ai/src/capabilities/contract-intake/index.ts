// packages/ai/src/capabilities/contract-intake/index.ts
//
// Registers the contract_intake capability: chat-only PII collection for
// employee contract data intake (ADR-0078). Read-only tool shows progress;
// mutation tools submit or decline field groups.
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getIntakeProgress, submitFieldGroup, declineIntake } from "./tools.js";

const readOnlyTools = [getIntakeProgress] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [getIntakeProgress, submitFieldGroup, declineIntake] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const contractIntakeCapability: CapabilityDefinition = {
  name: "contract_intake",
  description:
    "Collect employee PII (personal number, bank account, address) for contract data intake. Chat-only.",
  tools: allTools,
  readOnlyTools,
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "contract_intake",
  defaultAuthority: "read_only",
};
