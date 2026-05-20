/**
 * channel_admin.change_member_role — confirm/admin (ADR-0336).
 *
 * Admins can change a channel member's role (member → moderator → admin).
 * Structural change with privilege implications — requires admin role
 * and confirmation.
 *
 * Body lands in feat/channel-admin-change_member_role-body sortie.
 */

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

const CAPABILITY_CHANGE_MEMBER_ROLE = "channel_admin.change_member_role" as const;

export const changeMemberRoleTool = defineTool({
  name: "channel_admin.change_member_role",
  description:
    "Change a member's role in a chat channel (member / moderator / admin). Requires admin role and confirmation. Chat-only (ADR-0078).",
  capability: CAPABILITY_CHANGE_MEMBER_ROLE,
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel containing the member."),
    profile_id: z.string().uuid().describe("The workspace profile whose role to change."),
    new_role: z
      .enum(["member", "moderator", "admin"])
      .describe("New channel-level role to assign."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Skeleton — ADR-0196 Invariant 11: no emit without producing artefact.
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in feat/channel-admin-change_member_role-body sortie",
    });
  },
});
