/**
 * channel_admin.mute_channel — autonomous/employee (ADR-0336).
 *
 * Self-service tool: any employee can mute a channel for themselves.
 * Duration is optional; omitting it applies workspace default mute.
 *
 * Body lands in feat/channel-admin-mute_channel-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_MUTE_CHANNEL = "channel_admin.mute_channel" as const;

export const muteChannelTool = defineTool({
  name: "channel_admin.mute_channel",
  description:
    "Mute a chat channel for yourself. Optionally specify duration in hours; omit to use workspace default. Chat-only (ADR-0078). Autonomous — no confirmation required.",
  capability: CAPABILITY_MUTE_CHANNEL,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel to mute."),
    duration_hours: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("How long to mute in hours. Omit to use workspace default."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-mute_channel-body sortie",
    });
  },
});
