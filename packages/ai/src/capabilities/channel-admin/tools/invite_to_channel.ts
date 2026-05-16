/**
 * channel_admin.invite_to_channel — confirm/manager (ADR-0336).
 *
 * Managers can invite an existing workspace profile to a channel.
 * PII-adjacent (resolves profile by profile_id) — chat-only per ADR-0078.
 * Requires manager confirmation before executing.
 *
 * Body lands in feat/channel-admin-invite_to_channel-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_INVITE_TO_CHANNEL = "channel_admin.invite_to_channel" as const;

export const inviteToChannelTool = defineTool({
  name: "channel_admin.invite_to_channel",
  description:
    "Invite an existing workspace member to a chat channel. PII-adjacent — chat-only (ADR-0078). Requires manager role and confirmation.",
  capability: CAPABILITY_INVITE_TO_CHANNEL,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel to invite the member into."),
    profile_id: z
      .string()
      .uuid()
      .describe("Existing workspace profile to invite — PII lookup required."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-invite_to_channel-body sortie",
    });
  },
});
