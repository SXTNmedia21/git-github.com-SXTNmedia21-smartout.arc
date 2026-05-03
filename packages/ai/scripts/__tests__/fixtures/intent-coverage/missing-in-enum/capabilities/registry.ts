// Fixture — a NEW capability 'shift_lifecycle' was registered but the enum
// was not updated. Classic ADR-0112 failure mode (PR #197 reproduction).
import type { CapabilityDefinition } from "./types.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: {} as CapabilityDefinition,
  schedule: {} as CapabilityDefinition,
  shift_lifecycle: {} as CapabilityDefinition,
};
