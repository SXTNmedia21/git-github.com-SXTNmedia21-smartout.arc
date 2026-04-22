// packages/ai/src/capabilities/helpdesk_query/index.ts
// ADR-0162: isolated capability, NOT an extension of communication.
// ADR-0163: chat-only for PII (personnummer, lønn, bank, contract content).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { openTicket, listMyQueue, getTicket, resolveTicket } from "./tools.js";

// Read-only tools: always available at read_only+
const readOnlyTools = [listMyQueue, getTicket] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// Suggest tools: available at suggest+ (open is a user-facing mutation
// but low-risk — creates a thread. Not destructive.)
const suggestTools = [openTicket] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All tools: available at confirm+ (resolve is terminal, requires explicit
// human action at the authority_config='confirm' level).
const allTools = [openTicket, listMyQueue, getTicket, resolveTicket] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const helpdeskQueryCapability: CapabilityDefinition = {
  name: "helpdesk_query",
  description:
    "Helpdesk ticket lifecycle — open, list, view, and resolve employee queries routed to desks. Chat-only (PII).",
  // ADR-0163 — queries routinely carry PII (personnummer, lønn, bank details, contract content).
  allowedChannels: ["chat"],
  tools: allTools,
  readOnlyTools,
  suggestTools,
};

export { openTicket, listMyQueue, getTicket, resolveTicket };
