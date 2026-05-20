export { ProtocolDefinitionSchema, GateSchema, ActionSchema, StepSchema } from "./schema";
export type { ProtocolDefinition, Gate, Action } from "./schema";
export type { GateResult, StepResult, ProtocolTestOutput, ProtocolRunResult } from "./types";

import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";
import { P_POS_CONNECT_AND_SYNC } from "./p-pos-connect-and-sync";
import { P_MARKETPLACE_FULL_FLOW } from "./p-marketplace-full-flow";
import { P_SCHEDULER_PROPOSE_ACCEPT } from "./p-scheduler-propose-accept";
import { P_SCHEDULER_MOBILE_BUNDLE } from "./p-scheduler-mobile-bundle";
import { P_SIDEBAR_ORPHAN_COVERAGE } from "./p-sidebar-orphan-coverage";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
  S8: P_POS_CONNECT_AND_SYNC,
  S9: P_MARKETPLACE_FULL_FLOW,
  S10: P_SCHEDULER_PROPOSE_ACCEPT,
  S11: P_SCHEDULER_MOBILE_BUNDLE,
  S12: P_SIDEBAR_ORPHAN_COVERAGE,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
