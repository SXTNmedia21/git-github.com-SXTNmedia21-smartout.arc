// packages/ai/src/capabilities/communication/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getConversations, getUnreadCount, sendMessage } from "./tools.js";

const allTools = [getConversations, getUnreadCount, sendMessage] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const readOnlyTools = [getConversations, getUnreadCount] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [sendMessage] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const communicationCapability: CapabilityDefinition = {
  name: "communication",
  description: "Chat messaging: conversations, unread counts, and message sending",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
