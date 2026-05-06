// packages/ai/src/capabilities/mission/index.ts
//
// Mission capability — surfaces active engine_state missions and the
// workspace roadmap to Mr. Botsson so he can answer "what should I do
// next?" and "what is coming up?".
//
// All tools are read-only and voice-safe (no PII, no mutations).
// ADR-0078 (channel guard): voice + chat permitted.
// ADR-0099 (gate_action): read-only tools are exempt.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getActiveMissions, getWorkspaceRoadmap } from "./tools.js";

const tools = [getActiveMissions, getWorkspaceRoadmap] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const missionCapability: CapabilityDefinition = {
  name: "mission",
  description:
    "Active mission progress (engine_state) and workspace roadmap (planning_events, planning_cycle, open deviations). Use when the user asks what to do next, where they are in a process, or what is coming up.",
  tools,
  readOnlyTools: tools,
  // Voice-safe: no PII, no mutations.
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "direct_admin",
  emitPrefix: null, // no domain events emitted by this capability
  defaultAuthority: "read_only",
};

export { getActiveMissions, getWorkspaceRoadmap };
