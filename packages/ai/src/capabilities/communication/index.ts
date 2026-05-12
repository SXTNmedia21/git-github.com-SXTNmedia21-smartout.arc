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
import { compileDayBrief } from "./compile-day-brief.js";
import { compilePreclose } from "./compile-preclose.js";
import { publishAnnouncement } from "./publish-announcement.js";

const allTools = [
  getConversations,
  getUnreadCount,
  sendMessage,
  getChannelContext,
  searchKnowledge,
  composeShiftBriefing,
  compileDayBrief,
  compilePreclose,
  publishAnnouncement,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [
  getConversations,
  getUnreadCount,
  getChannelContext,
  searchKnowledge,
  composeShiftBriefing,
  compileDayBrief,
  compilePreclose,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [sendMessage, publishAnnouncement] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const communicationCapability: CapabilityDefinition = {
  name: "communication",
  description:
    "Channel messaging: conversations, unread counts, message sending, channel context, and knowledge search",
  // ADR-0163 — general-purpose messaging. Message bodies may contain PII but are
  // user-authored, not structured PII fields. Declared all channels explicitly
  // (reviewed 2026-04-20) rather than null-with-comment to keep the type check tight.
  allowedChannels: ["chat", "voice", "sms", "email"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "channel",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
