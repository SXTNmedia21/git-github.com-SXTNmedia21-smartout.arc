// packages/ai/src/capabilities/ui/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { navigateTool, fillFieldTool, highlightTool, showPanelTool, toastTool } from "./tools.js";

const tools = [
  navigateTool,
  fillFieldTool,
  highlightTool,
  showPanelTool,
  toastTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const uiCapability: CapabilityDefinition = {
  name: "ui",
  description:
    "Interact with the user's screen: navigate, fill forms, highlight elements, show panels, send notifications",
  // ADR-0163 — presentation-only (navigate, highlight, toast). No data exfiltration.
  // All channels reviewed 2026-04-20.
  allowedChannels: ["chat", "voice", "sms", "email"],
  toolAuthPattern: "direct_admin",
  emitPrefix: null,
  tools,
  readOnlyTools: [],
};
