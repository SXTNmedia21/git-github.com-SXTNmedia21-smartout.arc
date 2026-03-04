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
  tools,
  readOnlyTools: [],
};
