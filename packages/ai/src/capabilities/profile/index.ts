// packages/ai/src/capabilities/profile/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getProfile, getTeam, getContractStatus } from "./tools.js";

// SmartoutTool is invariant on TSchema (schema property + z.infer in execute),
// so defineTool's inferred ZodObject<{}> doesn't widen to ZodType automatically.
// Cast through unknown to erase the specific schema type for the registry.
const tools = [getProfile, getTeam, getContractStatus] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const profileCapability: CapabilityDefinition = {
  name: "profile",
  description: "Employee profile data, team membership, and contract status",
  tools,
  readOnlyTools: tools,
};
