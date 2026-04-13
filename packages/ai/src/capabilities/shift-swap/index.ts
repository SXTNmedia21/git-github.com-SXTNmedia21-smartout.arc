/**
 * Shift swap capability — chat-only per ADR-0078.
 *
 * Swap involves specific shift/colleague selection, not suitable for voice.
 * Authority split: readOnly (getSwapRequests, getSwapEligibility) vs
 * suggest (requestSwap, respondToSwap — requires confirm authority to execute).
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getSwapRequests, getSwapEligibility, requestSwap, respondToSwap } from "./tools.js";

const allTools = [
  getSwapRequests,
  getSwapEligibility,
  requestSwap,
  respondToSwap,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [getSwapRequests, getSwapEligibility] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [requestSwap, respondToSwap] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const shiftSwapCapability: CapabilityDefinition = {
  name: "shift_swap",
  description: "Request, view, and respond to shift swap requests between employees. Chat-only.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
};
