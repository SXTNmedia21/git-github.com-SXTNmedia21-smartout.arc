"use server";

/**
 * desk-actions.ts — Server Actions for the Helpdesk desks admin page.
 *
 * Contract shape mirrors the existing `_actions/` pattern in people/billing:
 *   { ok: true, deskId? } | { ok: false, error }
 *
 * Auth: workspace owner/admin only. Enforced by joining the caller's
 * company_member row (ticket resolve uses the same gate in the capability
 * tool per ADR-0161 Phase 1). Employees/managers cannot create, reassign,
 * or archive desks.
 *
 * RLS-safe writes: channel inserts use the server (JWT) client so workspace
 * scoping and the NOT NULL channel_desk_requires_responsible CHECK remain
 * the authoritative gates. No service-role bypass.
 *
 * Telemetry: every successful mutation emits — matches the module-wide
 * "no mutation without emit" rule. Category `helpdesk` is registered in
 * packages/telemetry/src/registry.ts; routing drops to posthog + logger +
 * activity_trail + engine_event (channel_event fans automatically via the
 * ADR-0160 projection when the event name matches helpdesk.%).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import type { Database } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type ActionOk = { ok: true };
type ActionErr = { ok: false; error: string };

/** Resolve (user → profile → workspace) and admin check via company_member. */
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

/** Shared check: the proposed responsible profile must be manager/admin/owner in this workspace. */
async function assertResponsibleEligible(
  supabase: Client,
  workspaceId: string,
  profileId: string,
): Promise<{ ok: true; displayName: string } | { ok: false; error: string }> {
  const { data: target } = await supabase
    .from("profile")
    .select("profile_id, display_name, role, is_active, workspace_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!target || !target.is_active) {
    return { ok: false, error: "Selected responsible is not an active member." };
  }
  if (target.workspace_id !== workspaceId) {
    return { ok: false, error: "Selected responsible belongs to a different workspace." };
  }
  const eligible = target.role === "manager" || target.role === "admin" || target.role === "owner";
  if (!eligible) {
    return { ok: false, error: "Only managers, admins, or owners can be responsible for a desk." };
  }
  return { ok: true, displayName: target.display_name ?? "ukjent" };
}

// ── createDesk ──────────────────────────────────────────────────────────

const createDeskSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[^<>]+$/, "Name cannot contain < or >."),
  description: z.string().max(140).optional(),
  responsible_profile_id: z.string().uuid(),
});

export async function createDesk(
  input: z.infer<typeof createDeskSchema>,
): Promise<{ ok: true; deskId: string } | ActionErr> {
  const parsed = createDeskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const eligibility = await assertResponsibleEligible(
    supabase,
    ctx.workspaceId,
    parsed.data.responsible_profile_id,
  );
  if (!eligibility.ok) return eligibility;

  // Uniqueness per workspace — desks are helpdesk_enabled channels per ADR-0165
  // (Phase 1A.1). Legacy channel_type='desk' rows (pre-flag) also counted.
  const { data: existing } = await supabase
    .from("channel")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .or("helpdesk_enabled.eq.true,channel_type.eq.desk")
    .ilike("name", parsed.data.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Skranken finnes allerede." };
  }

  // ADR-0165 Phase 1A.1: desks are channel_type='custom' + helpdesk_enabled=true.
  // RLS policy channel_jwt_insert allows custom/direct only; legacy 'desk' enum
  // is blocked from JWT users (deprecated-not-dropped). Setting helpdesk_enabled
  // requires admin-in-workspace — gated upstream via resolveAdminContext.
  const { data: insert, error: insertErr } = await supabase
    .from("channel")
    .insert({
      workspace_id: ctx.workspaceId,
      channel_type: "custom",
      helpdesk_enabled: true,
      privacy_mode: "public",
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      responsible_profile_id: parsed.data.responsible_profile_id,
      created_by: ctx.profileId,
    })
    .select("id")
    .single();

  if (insertErr || !insert) {
    return { ok: false, error: insertErr?.message ?? "Kunne ikke opprette skranke." };
  }

  // Add the responsible rep as a channel_member with role='representative'
  // so RLS-scoped selects (desk lists, realtime) pick them up without
  // depending on the responsible_profile_id fallback policy.
  await supabase.from("channel_member").insert({
    channel_id: insert.id,
    workspace_id: ctx.workspaceId,
    profile_id: parsed.data.responsible_profile_id,
    role: "representative",
  });

  await emit({
    event: "helpdesk.desk.created",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: { entity_type: "channel", entity_id: insert.id, entity_label: parsed.data.name },
    properties: {
      desk_channel_id: insert.id,
      responsible_profile_id: parsed.data.responsible_profile_id,
      has_description: Boolean(parsed.data.description),
    },
  });

  revalidatePath("/dashboard/komm/desks");
  return { ok: true, deskId: insert.id };
}

// ── updateDeskResponsible ───────────────────────────────────────────────

const updateResponsibleSchema = z.object({
  desk_channel_id: z.string().uuid(),
  responsible_profile_id: z.string().uuid(),
});

export async function updateDeskResponsible(
  input: z.infer<typeof updateResponsibleSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = updateResponsibleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: desk } = await supabase
    .from("channel")
    .select("id, workspace_id, channel_type, responsible_profile_id, name")
    .eq("id", parsed.data.desk_channel_id)
    .maybeSingle();

  if (!desk || desk.channel_type !== "desk") {
    return { ok: false, error: "Desk not found." };
  }
  if (desk.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Desk belongs to a different workspace." };
  }

  const eligibility = await assertResponsibleEligible(
    supabase,
    ctx.workspaceId,
    parsed.data.responsible_profile_id,
  );
  if (!eligibility.ok) return eligibility;

  const previousResponsibleId = desk.responsible_profile_id;

  const { error: updateErr } = await supabase
    .from("channel")
    .update({ responsible_profile_id: parsed.data.responsible_profile_id })
    .eq("id", parsed.data.desk_channel_id);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Demote the previous rep so desks don't accrete ghost representatives
  // across reassignments. Only touch the prior holder when they differ from
  // the new one — upserting the same profile_id twice would race on the
  // PK. Leave them as role='member' instead of deleting so historical
  // channel-membership (message authorship, reactions, etc.) stays intact.
  if (previousResponsibleId && previousResponsibleId !== parsed.data.responsible_profile_id) {
    await supabase
      .from("channel_member")
      .update({ role: "member" })
      .eq("channel_id", desk.id)
      .eq("profile_id", previousResponsibleId);
  }

  // Upsert the new rep as a channel_member with 'representative' role.
  await supabase.from("channel_member").upsert(
    {
      channel_id: desk.id,
      workspace_id: ctx.workspaceId,
      profile_id: parsed.data.responsible_profile_id,
      role: "representative",
    },
    { onConflict: "channel_id,profile_id" },
  );

  await emit({
    event: "helpdesk.desk.responsible_assigned",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: { entity_type: "channel", entity_id: desk.id, entity_label: desk.name ?? "desk" },
    properties: {
      desk_channel_id: desk.id,
      new_responsible_profile_id: parsed.data.responsible_profile_id,
      previous_responsible_profile_id: previousResponsibleId,
      was_orphan: !previousResponsibleId,
    },
  });

  revalidatePath("/dashboard/komm/desks");
  return { ok: true };
}

// ── archiveDesk ─────────────────────────────────────────────────────────

const archiveDeskSchema = z.object({
  desk_channel_id: z.string().uuid(),
});

export async function archiveDesk(
  input: z.infer<typeof archiveDeskSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = archiveDeskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: desk } = await supabase
    .from("channel")
    .select("id, workspace_id, channel_type, name")
    .eq("id", parsed.data.desk_channel_id)
    .maybeSingle();

  if (!desk || desk.channel_type !== "desk") {
    return { ok: false, error: "Desk not found." };
  }
  if (desk.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Desk belongs to a different workspace." };
  }

  const { error: updateErr } = await supabase
    .from("channel")
    .update({ is_archived: true })
    .eq("id", desk.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  await emit({
    event: "helpdesk.desk.archived",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: { entity_type: "channel", entity_id: desk.id, entity_label: desk.name ?? "desk" },
    properties: { desk_channel_id: desk.id },
  });

  revalidatePath("/dashboard/komm/desks");
  return { ok: true };
}
