export { ProtocolDefinitionSchema, GateSchema, ActionSchema, StepSchema } from "./schema";
export type { ProtocolDefinition, Gate, Action } from "./schema";
export type { GateResult, StepResult, ProtocolTestOutput, ProtocolRunResult } from "./types";

import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";
import { P_POS_CONNECT_AND_SYNC } from "./p-pos-connect-and-sync";
import { P_SCHEDULER_PROPOSE_ACCEPT } from "./p-scheduler-propose-accept";
import { P_SCHEDULER_MOBILE_BUNDLE } from "./p-scheduler-mobile-bundle";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
  S8: P_POS_CONNECT_AND_SYNC,
  S10: P_SCHEDULER_PROPOSE_ACCEPT,
  S11: P_SCHEDULER_MOBILE_BUNDLE,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
