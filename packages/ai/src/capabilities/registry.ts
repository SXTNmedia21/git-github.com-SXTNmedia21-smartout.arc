// packages/ai/src/capabilities/registry.ts
import type { CapabilityDefinition, CapabilityName } from "./types.js";
import { profileCapability } from "./profile/index.js";
import { uiCapability } from "./ui/index.js";
import { guardianCapability } from "./guardian/index.js";
import { scheduleCapability } from "./schedule/index.js";
import { operationsCapability } from "./operations/index.js";
import { communicationCapability } from "./communication/index.js";
import { contractCapability } from "./contract/index.js";
import { contractIntakeCapability } from "./contract-intake/index.js";
import { shiftSwapCapability } from "./shift-swap/index.js";
import { operationsIntelligenceCapability } from "./operations-intelligence/index.js";
import { trainingCapability } from "./training/index.js";
import { shiftLifecycleCapability } from "./shift-lifecycle/index.js";
import { governanceCapability } from "./governance/index.js";
import { billingQueryCapability } from "./billing-query/index.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  ui: uiCapability,
  guardian: guardianCapability,
  schedule: scheduleCapability,
  operations: operationsCapability,
  communication: communicationCapability,
  contract: contractCapability,
  contract_intake: contractIntakeCapability,
  shift_swap: shiftSwapCapability,
  operations_intelligence: operationsIntelligenceCapability,
  training: trainingCapability,
  shift_lifecycle: shiftLifecycleCapability,
  governance: governanceCapability,
  billing_query: billingQueryCapability,
};

export function getCapability(name: CapabilityName): CapabilityDefinition | undefined {
  return capabilities[name];
}

export function getAllCapabilities(): CapabilityDefinition[] {
  return Object.values(capabilities);
}

export function getRegisteredCapabilities(): CapabilityName[] {
  return Object.keys(capabilities) as CapabilityName[];
}
