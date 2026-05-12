"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";

const PinInputSchema = z.object({
  messageId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  pin: z.boolean(),
});

type PinResult = { ok: true; messageId: string; pinned: boolean } | { ok: false; reason: string };

/**
 * pinMessageAction — manager+ pin/unpin of channel_message rows.
 *
 * RLS UPDATE policy on channel_message only permits sender to update own row
 * (see 20260422300100_channel_rls_policies.sql:122-124). Pin is a moderation
 * action that must work across senders, so it bypasses RLS via service role
 * with an explicit role-and-workspace guard.
 *
 * Follows the established pattern from `_actions/helpdesk-channel-actions.ts:51`
 * — JWT role check FIRST via resolveCurrentProfile, then service-role write.
 *
 * TODO: when a Botsson `komm.pin_message` capability tool is introduced
 * (held — see Open recommendations after close), route the agent path
 * through gateAction per ADR-0287; UI Server Action stays as-is.
 */
export async function pinMessageAction(input: unknown): Promise<PinResult> {
  const parsed = PinInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid input" };
  }
  const { messageId, workspaceId, pin } = parsed.data;

  // Server-derive profile from JWT (ADR-0151)
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, reason: "Not authenticated" };
  }
  if (profile.workspaceId !== workspaceId) {
    return { ok: false, reason: "Workspace mismatch" };
  }
  if (!["manager", "admin", "owner"].includes(profile.role ?? "")) {
    return { ok: false, reason: "Insufficient role — manager+ required" };
  }

  // Service-role write — RLS bypassed; only pin columns touched.
  // Defense-in-depth: explicit workspace_id filter even though service role
  // could span workspaces.
  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel_message")
    .update({
      is_pinned: pin,
      pinned_by: pin ? profile.profileId : null,
      pinned_at: pin ? new Date().toISOString() : null,
    })
    .eq("id", messageId)
    .eq("workspace_id", workspaceId);

  if (updateErr) {
    return { ok: false, reason: updateErr.message };
  }

  return { ok: true, messageId, pinned: pin };
}
