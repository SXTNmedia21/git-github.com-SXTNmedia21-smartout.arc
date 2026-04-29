// Fixture — a registry with a clean set of capabilities. No drift expected.
import type { CapabilityDefinition } from "./types.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: {} as CapabilityDefinition,
  schedule: {} as CapabilityDefinition,
  ui: {} as CapabilityDefinition,
};
