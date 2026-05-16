/**
 * channel_admin.archive_channel — confirm/admin (ADR-0336).
 *
 * Admins can archive a channel, making it read-only and removing it
 * from active channel listings. Structural change — requires admin role
 * and confirmation. Optional reason is shown in the archive audit trail.
 *
 * Body lands in feat/channel-admin-archive_channel-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_ARCHIVE_CHANNEL = "channel_admin.archive_channel" as const;

export const archiveChannelTool = defineTool({
  name: "channel_admin.archive_channel",
  description:
    "Archive a chat channel — makes it read-only and removes it from active listings. Requires admin role and confirmation. Optional reason recorded in audit trail. Chat-only (ADR-0078).",
  capability: CAPABILITY_ARCHIVE_CHANNEL,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel to archive."),
    reason: z
      .string()
      .min(1)
      .max(500)
      .optional()
      .describe("Optional reason for archiving (recorded in audit trail, 1-500 chars)."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-archive_channel-body sortie",
    });
  },
});
