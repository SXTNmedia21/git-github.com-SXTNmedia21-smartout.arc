"use server";

/**
 * general-channel-actions.ts — Server Actions for GenereltTab
 *
 * Covers: rename, set description, archive, delete.
 * All writes require workspace-admin (company_member.role IN ('owner','admin')).
 * Delete requires owner role only (stronger gate).
 *
 * Architecture notes:
 *   - Auth via JWT client (createClient) + resolveAdminContext from the same
 *     pattern as helpdesk-channel-actions.ts.
 *   - Writes via admin client (createAdminClient) to bypass channel_jwt_update
 *     RLS narrowing (same rationale as helpdesk-channel-actions.ts §Architecture).
 *   - ADR-0151: workspace_id is resolved from the JWT-scoped profile row, never
 *     from the request body.
 *   - Telemetry: emit() on every mutation (channel.renamed, channel.archived,
 *     channel.deleted).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type ActionOk = { ok: true };
type ActionErr = { ok: false; error: string };

// ── Shared auth helpers ─────────────────────────────────────────────────────

async function resolveAdminContext(
  supabase: Client,
): Promise<
  | { ok: true; profileId: string; workspaceId: string; companyId: string; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return { ok: false, error: "No active profile." };

  const { data: workspaceRow } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", profile.workspace_id)
    .single();

  if (!workspaceRow?.company_id) {
    return { ok: false, error: "Workspace has no company." };
  }

  const { data: member } = await supabase
    .from("company_member")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", workspaceRow.company_id)
    .maybeSingle();

  const isAdmin = member?.role === "owner" || member?.role === "admin";
  if (!isAdmin) return { ok: false, error: "Admin privileges required." };

  return {
    ok: true,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    companyId: workspaceRow.company_id,
    userId: user.id,
  };
}

async function resolveOwnerContext(
  supabase: Client,
): Promise<
  | { ok: true; profileId: string; workspaceId: string; companyId: string; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return { ok: false, error: "No active profile." };

  const { data: workspaceRow } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", profile.workspace_id)
    .single();

  if (!workspaceRow?.company_id) {
    return { ok: false, error: "Workspace has no company." };
  }

  const { data: member } = await supabase
    .from("company_member")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", workspaceRow.company_id)
    .maybeSingle();

  if (member?.role !== "owner") {
    return { ok: false, error: "Owner privileges required to delete a channel." };
  }

  return {
    ok: true,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    companyId: workspaceRow.company_id,
    userId: user.id,
  };
}

// ── 1. renameChannel ────────────────────────────────────────────────────────

const renameSchema = z.object({
  channel_id: z.string().uuid(),
  new_name: z.string().min(1).max(80).trim(),
});

export async function renameChannel(
  input: z.infer<typeof renameSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  const oldName = channel.name ?? "";
  if (oldName === parsed.data.new_name) return { ok: true }; // no-op

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel")
    .update({ name: parsed.data.new_name })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke endre navn: ${updateErr.message}` };

  await emit({
    event: "channel.renamed",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: parsed.data.new_name,
    },
    properties: {
      channel_id: parsed.data.channel_id,
      old_name: oldName,
      new_name: parsed.data.new_name,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 2. setChannelDescription ────────────────────────────────────────────────

const descriptionSchema = z.object({
  channel_id: z.string().uuid(),
  description: z.string().max(280).trim(),
});

export async function setChannelDescription(
  input: z.infer<typeof descriptionSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = descriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel")
    .update({ description: parsed.data.description || null })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke lagre beskrivelse: ${updateErr.message}` };

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 3. archiveChannel ───────────────────────────────────────────────────────

const archiveSchema = z.object({
  channel_id: z.string().uuid(),
});

export async function archiveChannel(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name, channel_type, is_archived")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }
  if (channel.is_archived) {
    return { ok: false, error: "Channel is already archived." };
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel")
    .update({ is_archived: true, is_read_only: true })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke arkivere kanal: ${updateErr.message}` };

  await emit({
    event: "channel.archived",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_type: channel.channel_type,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 4. deleteChannel ────────────────────────────────────────────────────────
// Owner-only. Double-confirm is enforced in the UI; this action trusts
// that the caller has passed a confirmation phrase. Server-side gate:
// owner role only (company_member.role = 'owner').

const deleteSchema = z.object({
  channel_id: z.string().uuid(),
  confirm_name: z.string().min(1), // must match channel.name
});

export async function deleteChannel(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  // Owner-only gate (stricter than admin)
  const ctx = await resolveOwnerContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name, channel_type")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  // Confirm-name must match channel name (case-insensitive trim) — additional
  // defense-in-depth on top of the UI double-confirm dialog.
  const nameLower = (channel.name ?? "").toLowerCase().trim();
  const confirmLower = parsed.data.confirm_name.toLowerCase().trim();
  if (nameLower !== confirmLower) {
    return { ok: false, error: "Bekreftelsesnavn stemmer ikke. Skriv kanalnavnet nøyaktig." };
  }

  const admin = createAdminClient();

  // Soft delete by setting is_archived=true, is_read_only=true, and clearing
  // the name with a deleted marker. Hard deletes are deferred to GDPR export
  // / retention pipeline — cascade deletes on messages would be irreversible
  // and can't be undone by an admin mistake.
  // TODO(retention): Replace with hard-delete + cascade once retention
  // pipeline is implemented (OppbevaringTab → export flow).
  const { error: updateErr } = await admin
    .from("channel")
    .update({
      is_archived: true,
      is_read_only: true,
      name: `[slettet] ${channel.name ?? channel.id}`,
    })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke slette kanal: ${updateErr.message}` };

  await emit({
    event: "channel.deleted",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      channel_type: channel.channel_type,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}
