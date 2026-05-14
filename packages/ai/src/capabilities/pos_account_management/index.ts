/**
 * packages/ai/src/capabilities/pos_account_management/index.ts
 *
 * POS account management capability (ADR-0305, C1 sortie).
 *
 * Three tools:
 *   - connect_lightspeed  (admin+, chat-only, mutateWithGate — suggestTool)
 *   - disconnect_pos_account (admin+, chat-only, mutateWithGate — suggestTool)
 *   - list_pos_accounts   (admin+, both channels, read-only — readOnlyTool)
 *
 * allowedChannels: ["chat", "voice"]
 *   connect + disconnect are blocked at tool level (chat-only voice guard).
 *   list_accounts is voice-safe. Union pattern per ADR-0078 defence-in-depth.
 *
 * emitPrefix: "pos"
 *   Owns events: pos.account.connected, pos.account.disconnected,
 *   pos.sale_event.ingested (the last fired by Edge Function, not by tools).
 *   Prefix must be unique — verified at runtime by getAllCapabilities().
 *
 * Authority authority seed:
 *   Seeded in foundation migration 20260611120100_wfm_capability_authority_seed.sql.
 *   Default: read_only. Active workspaces opt-in at suggest (admin+ min_role).
 *
 * References:
 *   ADR-0305 — POS adapter pattern + admin capability.
 *   ADR-0287 — mutateWithGate mandatory.
 *   ADR-0078 — channel guard.
 *   ADR-0191 — toolAuthPattern "bff".
 *   ADR-0194 — emitPrefix unique, non-null.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { connectLightspeed, disconnect, listPosAccounts } from "./tools.js";

const allTools = [connectLightspeed, disconnect, listPosAccounts] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// list_pos_accounts is the only read-only tool (no mutation, no gate).
const readOnlyTools = [listPosAccounts] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// connect + disconnect are suggest-tier mutations.
// Workspaces seeded at suggest will surface the UI-confirm flow.
const suggestTools = [connectLightspeed, disconnect] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const posAccountManagementCapability: CapabilityDefinition = {
  name: "pos_account_management",
  description:
    "POS integration management — connect/disconnect Lightspeed K-Series account, list active POS integrations. Admin only. Write tools are chat-only (ADR-0288).",
  // UNION of per-tool channels. connect + disconnect guard to chat at tool level.
  // list_accounts is voice-safe. Defence-in-depth per ADR-0078.
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "bff",
  emitPrefix: "pos",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};

export { connectLightspeed, disconnect, listPosAccounts };
