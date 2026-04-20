// packages/ai/src/capabilities/shift-lifecycle/index.ts
//
// shift_lifecycle capability (Phase 5 per ADR-0095).
//
// Write-capable. All mutations pass through gate_action (ADR-0099) and
// respect ADR-0078 channel restrictions (voice never allowed for
// publish/approve; interpret/settle are system-only).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { publishShift, approveShift, interpretShift, settleShift } from "./tools.js";

const allTools = [
  publishShift,
  approveShift,
  interpretShift,
  settleShift,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Read-only subset is empty: this capability only contains mutations.
// Lookups are covered by the schedule capability.
const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [publishShift, approveShift] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const shiftLifecycleCapability: CapabilityDefinition = {
  name: "shift_lifecycle",
  description:
    "Shift lifecycle mutations: publish, approve, interpret, settle. Per ADR-0095 five-layer architecture. All tools are gated via gate_action.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // Voice is never allowed (ADR-0078). interpret/settle additionally
  // enforce 'system' channel inline in their handlers.
  allowedChannels: ["chat", "system"],
};

export { publishShift, approveShift, interpretShift, settleShift };
