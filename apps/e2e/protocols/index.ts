export { ProtocolDefinitionSchema, GateSchema, ActionSchema, StepSchema } from "./schema";
export type { ProtocolDefinition, Gate, Action } from "./schema";
export type { GateResult, StepResult, ProtocolTestOutput, ProtocolRunResult } from "./types";

import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";
import { P_POS_CONNECT_AND_SYNC } from "./p-pos-connect-and-sync";
import { P_MARKETPLACE_FULL_FLOW } from "./p-marketplace-full-flow";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
  S8: P_POS_CONNECT_AND_SYNC,
  S9: P_MARKETPLACE_FULL_FLOW,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
