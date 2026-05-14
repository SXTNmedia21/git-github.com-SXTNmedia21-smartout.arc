export { ProtocolDefinitionSchema, GateSchema, ActionSchema, StepSchema } from "./schema";
export type { ProtocolDefinition, Gate, Action } from "./schema";
export type { GateResult, StepResult, ProtocolTestOutput, ProtocolRunResult } from "./types";

import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";
import { P_POS_CONNECT_AND_SYNC } from "./p-pos-connect-and-sync";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
  S8: P_POS_CONNECT_AND_SYNC,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
