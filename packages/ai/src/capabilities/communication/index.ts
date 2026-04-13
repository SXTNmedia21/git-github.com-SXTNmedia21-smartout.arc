// packages/ai/src/capabilities/communication/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  getConversations,
  getUnreadCount,
  sendMessage,
  getChannelContext,
  searchKnowledge,
} from "./tools.js";
import { composeShiftBriefing } from "./briefing.js";

const allTools = [
  getConversations,
  getUnreadCount,
  sendMessage,
  getChannelContext,
  searchKnowledge,
  composeShiftBriefing,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [
  getConversations,
  getUnreadCount,
  getChannelContext,
  searchKnowledge,
  composeShiftBriefing,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [sendMessage] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const communicationCapability: CapabilityDefinition = {
  name: "communication",
  description:
    "Channel messaging: conversations, unread counts, message sending, channel context, and knowledge search",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
