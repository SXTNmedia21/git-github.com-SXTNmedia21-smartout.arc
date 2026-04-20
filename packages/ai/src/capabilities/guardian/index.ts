// packages/ai/src/capabilities/guardian/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition, CapabilityName } from "../types.js";
import { getSignals, acknowledgeSignal, getWorkspaceHealth } from "./tools.js";

const allTools = [getSignals, acknowledgeSignal, getWorkspaceHealth] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const readOnlyTools = [getSignals, getWorkspaceHealth] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [acknowledgeSignal] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const guardianCapability: CapabilityDefinition = {
  name: "guardian",
  description:
    "Workspace health monitoring: readiness alerts, maturity signals, and agent behavior tracking",
  // ADR-0163 — system-level telemetry (signal categories + counts), no employee PII.
  // All channels reviewed 2026-04-20.
  allowedChannels: ["chat", "voice", "sms", "email"],
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
