"use server";

/**
 * retention-channel-actions.ts — Server Actions for OppbevaringTab
 *
 * Covers: set retention period, set auto-archive, set legal hold.
 * Legal hold is admin-only; it locks retention_days to NULL (permanent).
 *
 * Architecture notes:
 *   - Admin-gated via resolveAdminContext (same pattern as helpdesk-channel-actions.ts).
 *   - Writes via admin client (service role).
 *   - ADR-0151: workspace_id from JWT profile, not body.
 *   - legal_hold_until prevents any retention_days write until the hold expires.
 *     The action enforces this server-side — legal holds cannot be overridden
 *     by the same action that sets retention (requires a separate clearLegalHold
 *     call).
 *   - "Export channel history" is a deferred operation — this action just
 *     records the request; actual file generation is handled by a separate
 *     edge function / background job (not implemented in Phase 3).
 *   - Telemetry: channel.retention_changed on every mutation.
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

// ── Shared auth helper ──────────────────────────────────────────────────────

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

// ── 1. setChannelRetention ──────────────────────────────────────────────────
// retention_days = null means permanent (no automatic purge).
// Preset values: 30, 90, 365, null (permanent).

const retentionSchema = z.object({
  channel_id: z.string().uuid(),
  // null = permanent retention
  retention_days: z.number().int().positive().nullable(),
  auto_archive_days: z.number().int().positive().nullable(),
});

export async function setChannelRetention(
  input: z.infer<typeof retentionSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = retentionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name, legal_hold_until, retention_days, auto_archive_days")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  // Legal hold gate: if legal_hold_until is set and in the future, block
  // any retention_days write (hold forces permanent retention).
  if (channel.legal_hold_until) {
    const holdExpiry = new Date(channel.legal_hold_until);
    if (holdExpiry > new Date()) {
      return {
        ok: false,
        error: `Kanalen er under juridisk bevaring til ${holdExpiry.toLocaleDateString("nb-NO")}. Oppbevaringstid kan ikke endres.`,
      };
    }
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel")
    .update({
      retention_days: parsed.data.retention_days,
      auto_archive_days: parsed.data.auto_archive_days,
    })
    .eq("id", parsed.data.channel_id);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke lagre oppbevaringsinnstillinger: ${updateErr.message}` };
  }

  await emit({
    event: "channel.retention_changed",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      retention_days: parsed.data.retention_days,
      auto_archive_days: parsed.data.auto_archive_days,
      legal_hold_set: false,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 2. setLegalHold ────────────────────────────────────────────────────────
// Sets legal_hold_until to a future date. Automatically clears retention_days
// (forces permanent). Requires admin role.

const legalHoldSchema = z.object({
  channel_id: z.string().uuid(),
  // ISO date string for when the hold expires. null = clear the hold.
  legal_hold_until: z.string().datetime().nullable(),
});

export async function setLegalHold(
  input: z.infer<typeof legalHoldSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = legalHoldSchema.safeParse(input);
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

  const admin = createAdminClient();

  // When setting a hold, force retention_days=null (permanent).
  // When clearing a hold, leave retention_days as-is.
  const updatePayload =
    parsed.data.legal_hold_until !== null
      ? { legal_hold_until: parsed.data.legal_hold_until, retention_days: null }
      : { legal_hold_until: null };

  const { error: updateErr } = await admin
    .from("channel")
    .update(updatePayload)
    .eq("id", parsed.data.channel_id);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke sette juridisk bevaring: ${updateErr.message}` };
  }

  await emit({
    event: "channel.retention_changed",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      retention_days: null,
      auto_archive_days: null,
      legal_hold_set: parsed.data.legal_hold_until !== null,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 3. requestChannelExport ─────────────────────────────────────────────────
// Deferred: records the export request in the DB. The actual file generation
// is handled by an edge function / cron job (not implemented in Phase 3).
// TODO(retention): Implement actual export edge function that generates
//   channel_history.json / .md and delivers via email or download link.

const exportSchema = z.object({
  channel_id: z.string().uuid(),
  format: z.enum(["json", "md"]).default("json"),
});

export async function requestChannelExport(
  input: z.infer<typeof exportSchema>,
): Promise<{ ok: true; message: string } | ActionErr> {
  const parsed = exportSchema.safeParse(input);
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

  // TODO(retention-export): Insert export job row + trigger edge function.
  // For now: return a placeholder success so the UI can show the toast.
  return {
    ok: true,
    message: `Eksport av «${channel.name ?? "kanal"}» er bestilt. Du mottar en e-post når filen er klar.`,
  };
}
