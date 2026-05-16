/**
 * channel_admin.leave_channel — autonomous/employee (ADR-0336).
 *
 * Self-service tool: any employee can leave a channel they are a member of.
 *
 * Body lands in feat/channel-admin-leave_channel-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_LEAVE_CHANNEL = "channel_admin.leave_channel" as const;

export const leaveChannelTool = defineTool({
  name: "channel_admin.leave_channel",
  description:
    "Leave a chat channel you are a member of. Chat-only (ADR-0078). Autonomous — no confirmation required.",
  capability: CAPABILITY_LEAVE_CHANNEL,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel to leave."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-leave_channel-body sortie",
    });
  },
});
