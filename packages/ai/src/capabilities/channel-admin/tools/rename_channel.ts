/**
 * channel_admin.rename_channel — confirm/admin (ADR-0336).
 *
 * Admins can rename a channel. Structural change — requires admin role
 * and confirmation to prevent accidental renames.
 *
 * Body lands in feat/channel-admin-rename_channel-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_RENAME_CHANNEL = "channel_admin.rename_channel" as const;

export const renameChannelTool = defineTool({
  name: "channel_admin.rename_channel",
  description:
    "Rename a chat channel. Structural change — requires admin role and confirmation. Chat-only (ADR-0078).",
  capability: CAPABILITY_RENAME_CHANNEL,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel to rename."),
    new_name: z.string().min(1).max(80).describe("New display name for the channel (1-80 chars)."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-rename_channel-body sortie",
    });
  },
});
