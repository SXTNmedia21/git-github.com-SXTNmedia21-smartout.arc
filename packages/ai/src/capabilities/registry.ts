// packages/ai/src/capabilities/registry.ts
import type { CapabilityDefinition, CapabilityName } from "./types.js";
import { profileCapability } from "./profile/index.js";
import { guardianCapability } from "./guardian/index.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  guardian: guardianCapability,
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
