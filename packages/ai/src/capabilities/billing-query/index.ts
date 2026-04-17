// packages/ai/src/capabilities/billing-query/index.ts
//
// billing_query capability — read-only billing surface for the
// Smartout agent. ADR-0118 C3 Commercial consumer; ADR-0078 channel
// restriction (billing never over voice because invoice numbers +
// amounts must be spelled exactly).
//
// All five tools sit in readOnlyTools; there is no mutating tool
// surface here — the agent never marks paid, voids, or issues a
// credit note. Those live as platform-admin Server Actions (Phase 7)
// and require explicit UI confirmation.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  explainInvoiceBasis,
  getMyInvoice,
  getUsageSnapshot,
  listMyInvoices,
  listOverdue,
} from "./tools.js";

const tools = [
  listMyInvoices,
  getMyInvoice,
  explainInvoiceBasis,
  listOverdue,
  getUsageSnapshot,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const billingQueryCapability: CapabilityDefinition = {
  name: "billing_query",
  description:
    "Query and explain the viewer's own company billing: list invoices, explain amounts, flag overdue, look up usage snapshots. Read-only. Chat channel only.",
  tools: [],
  readOnlyTools: tools,
  allowedChannels: ["chat"],
};
