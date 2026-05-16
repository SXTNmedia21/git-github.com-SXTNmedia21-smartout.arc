/**
 * channel_admin capability — channel administrative tooling (ADR-0336).
 *
 * Six tools across two authority tiers:
 *   Autonomous (employee+):
 *     - channel_admin.mute_channel   — mute a channel for self (optional duration)
 *     - channel_admin.leave_channel  — leave a channel
 *
 *   Confirm (manager+ / admin+):
 *     - channel_admin.invite_to_channel  (confirm/manager) — invite workspace member
 *     - channel_admin.rename_channel     (confirm/admin)   — rename channel
 *     - channel_admin.archive_channel    (confirm/admin)   — archive channel
 *     - channel_admin.change_member_role (confirm/admin)   — change member role
 *
 * Chat-only (ADR-0078): PII ceiling applies capability-wide (invite_to_channel
 * resolves profile_id; all structural tools affect workspace membership state).
 * Voice is not appropriate for any of these operations.
 *
 * Sortie 1 scope: all tools are skeletons (not_implemented). Bodies land in
 * per-tool body sorties (feat/channel-admin-<tool>-body).
 *
 * Binding ADRs: 0078 (chat-only), 0099 (gate mandatory), 0196 (no phantom emit),
 *               0336 (channel admin authority matrix).
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { muteChannelTool } from "./tools/mute_channel.js";
import { leaveChannelTool } from "./tools/leave_channel.js";
import { inviteToChannelTool } from "./tools/invite_to_channel.js";
import { renameChannelTool } from "./tools/rename_channel.js";
import { archiveChannelTool } from "./tools/archive_channel.js";
import { changeMemberRoleTool } from "./tools/change_member_role.js";

// All 6 tools — surfaced when authority ≥ autonomous.
const allTools = [
  muteChannelTool,
  leaveChannelTool,
  inviteToChannelTool,
  renameChannelTool,
  archiveChannelTool,
  changeMemberRoleTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// No read-only tools — all 6 tools mutate state.
// (ADR-0336: mute + leave are autonomous, not read-only; they change membership state.)
const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [];

export const channelAdminCapability: CapabilityDefinition = {
  name: "channel_admin",
  description:
    "Channel administrative tooling: mute/leave (self-act), invite (PII), rename/archive/role-change (structural). Chat-only (ADR-0078).",
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "channel_admin",
  defaultAuthority: "confirm",
  tools: allTools,
  readOnlyTools,
};

// Re-export tools for testing + registry introspection.
export {
  muteChannelTool,
  leaveChannelTool,
  inviteToChannelTool,
  renameChannelTool,
  archiveChannelTool,
  changeMemberRoleTool,
};
