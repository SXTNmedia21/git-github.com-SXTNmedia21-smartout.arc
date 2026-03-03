// packages/ai/src/capabilities/registry.ts
import type { CapabilityDefinition, CapabilityName } from "./types.js";
import { profileCapability } from "./profile/index.js";
import { uiCapability } from "./ui/index.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  ui: uiCapability,
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
