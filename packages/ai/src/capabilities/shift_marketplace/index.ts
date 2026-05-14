/**
 * packages/ai/src/capabilities/shift_marketplace/index.ts
 *
 * Open-shift marketplace capability — ADR-0306.
 *
 * ADR-0133 verb classification:
 *   - post_open: Compose verb → web manager only
 *   - claim: Approve verb → mobile employee (and web chat)
 *   - approve_claim: Approve verb → mobile manager (and web chat)
 *   - cancel_offer: both channels (no C4 assignment; poster/manager only)
 *
 * ADR-0288: claim + approve_claim are chat-only V1 (enforced in tool bodies).
 *
 * Channel policy: allowedChannels=["chat"] at capability level.
 *   cancel_offer body does NOT enforce voice restriction (cancel is non-C4-escalating).
 *   The capability-level ["chat"] restriction is an advisory — enforcement happens
 *   at the tool body for claim/approve_claim per ADR-0288.
 *
 * Authority default: read_only (list_open_offers ungated; mutations require suggest+).
 * Authority seeded in 20260611120100_wfm_capability_authority_seed.sql.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { listOpenOffers, postOpen, claim, approveClaim, cancelOffer } from "./tools.js";

const allTools = [
  listOpenOffers,
  postOpen,
  claim,
  approveClaim,
  cancelOffer,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [listOpenOffers] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [postOpen, claim, approveClaim, cancelOffer] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const shiftMarketplaceCapability: CapabilityDefinition = {
  name: "shift_marketplace",
  description:
    "Open-shift marketplace — post open shifts, claim shifts, approve claims, cancel offers. Manager posts; employee claims from mobile; manager approves 1-tap.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
  toolAuthPattern: "bff",
  emitPrefix: "shift_offer",
  defaultAuthority: "read_only",
};
