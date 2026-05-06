export { ProtocolDefinitionSchema, GateSchema, ActionSchema, StepSchema } from "./schema";
export type { ProtocolDefinition, Gate, Action } from "./schema";
export type { GateResult, StepResult, ProtocolTestOutput, ProtocolRunResult } from "./types";

import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
