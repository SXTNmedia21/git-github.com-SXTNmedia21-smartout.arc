// Fixture — enum has a value nobody registered and it is not in the
// documented tool-less allow-list.
import type { CapabilityDefinition } from "./types.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: {} as CapabilityDefinition,
};
