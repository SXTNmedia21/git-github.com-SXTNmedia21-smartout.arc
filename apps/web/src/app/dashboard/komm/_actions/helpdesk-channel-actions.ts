"use server";

/**
 * helpdesk-channel-actions.ts — Progressive Channel Server Actions (ADR-0165)
 *
 * Wraps the 6 mutations that flip helpdesk posture on any channel (upgrade,
 * downgrade, reassign rep) and drive ticket lifecycle without going through
 * the capability-tool + agent-router path. Cuts over from the Phase 1
 * desks/_actions/desk-actions.ts model (which is deleted by the web sub-
 * sortie). This file is the new canonical entry point for admin helpdesk
 * operations plus the public-mode ticket flow introduced by ADR-0166.
 *
 * Architecture choices:
 *   - SERVICE-ROLE writes. channel_jwt_insert / channel_jwt_update RLS
 *     narrow JWT from flipping helpdesk_enabled=true unless the caller
 *     is workspace admin (ADR-0165 Rule 6). Service role bypasses those
 *     gates and remains the canonical upgrade path. We still authorize
 *     the caller via the JWT client + company_member lookup BEFORE
 *     touching the admin client.
 *   - Auth check uses the JWT-scoped createClient() + resolveAdminContext
 *     (same shape as desks/_actions/desk-actions.ts). Admin check is
 *     scoped to the TICKET workspace's company — never a cross-tenant
 *     "am I admin somewhere" query.
 *   - completed_at stamping (L-0079) on every terminal engine_state
 *     transition. resolveTicketFromMessage mirrors engine-dispatch/
 *     index.ts — any status='complete' write outside the dispatcher
 *     must stamp completed_at or SLA/reporting silently drops rows.
 *   - PII classifier gate (ADR-0166). openPublicTicketFromMessage runs
 *     classifyPii synchronously. On hit: original goes to a private
 *     sub-channel + audit trail, public timeline sees a redacted
 *     placeholder, engine_state entity_id points at the sub-channel
 *     (private flow). On miss: normal public-mode flow, engine_state
 *     entity_id = the helpdesk channel itself (ADR-0165 Rule 4).
 *   - Rep demotion (L-0080). Reassign + downgrade both demote the prior
 *     rep to role='member' rather than deleting — preserves message
 *     authorship + channel-membership history.
 *
 * Telemetry: every mutation emits. 5 new events registered in
 * packages/telemetry/src/registry.ts:
 *   - channel.helpdesk.enabled / .disabled
 *   - channel.responsible.reassigned
 *   - helpdesk.pii.detected
 *   - helpdesk.pii.classifier_timeout (unused here but exported for the
 *     Edge Function classifier-hook path, which has its own emit site)
 * Plus reuses existing helpdesk.query.opened / .resolved.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { classifyPii } from "@smartout/ai/classifiers";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type ActionOk = { ok: true };
type ActionErr = { ok: false; error: string };

// ── Shared helpers ─────────────────────────────────────────────────────

/**
 * Resolve (user → profile → workspace) and check workspace-admin role via
 * company_member. Mirrors desks/_actions/desk-actions.ts intentionally so
 * the cutover is a one-for-one replacement of the Phase 1 contract.
 *
 * Uses the JWT client for auth.getUser() + profile lookup because anon-key
 * + cookie session is the only way to identify the caller; service role
 * has no notion of "current user".
 */
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

/**
 * Resolve the caller's profile (NOT workspace-admin) for requester-driven
 * flows (open ticket from message). Any active member of the workspace is
 * allowed to open a ticket on a helpdesk-enabled channel they belong to.
 */
async function resolveRequesterContext(
  supabase: Client,
): Promise<
  | { ok: true; profileId: string; workspaceId: string; userId: string }
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

  return {
    ok: true,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    userId: user.id,
  };
}

/**
 * Preset → (privacy_mode, AI policy) matrix. ADR-0165 §Four presets.
 * 'tilpasset' is the escape hatch — caller must pass explicit values.
 */
type Preset = "ingen" | "fag" | "hr_privat" | "tilpasset";
type PrivacyMode = Database["public"]["Enums"]["channel_privacy_mode"];
type TextMode = Database["public"]["Enums"]["channel_ai_text_mode"];
type VoiceMode = Database["public"]["Enums"]["channel_ai_voice_mode"];

type PresetConfig = {
  privacy_mode: PrivacyMode;
  text_participation: TextMode;
  voice_participation: VoiceMode;
};

function resolvePresetConfig(
  preset: Preset,
  custom?: {
    privacy_mode?: PrivacyMode;
    text_participation?: TextMode;
    voice_participation?: VoiceMode;
  },
): PresetConfig | { error: string } {
  switch (preset) {
    case "fag":
      return {
        privacy_mode: "public",
        text_participation: "mention_only",
        voice_participation: "disabled",
      };
    case "hr_privat":
      return {
        privacy_mode: "private_per_requester",
        text_participation: "disabled",
        voice_participation: "disabled",
      };
    case "ingen":
      // 'ingen' turns helpdesk OFF — callers must use downgradeChannelFromHelpdesk
      // for that path. Surface the usage mistake as an error rather than
      // silently implying helpdesk_enabled=false on an upgrade call.
      return { error: "Bruk downgradeChannelFromHelpdesk for preset='ingen'." };
    case "tilpasset":
      if (!custom?.privacy_mode) {
        return { error: "Preset 'tilpasset' krever eksplisitt privacy_mode." };
      }
      return {
        privacy_mode: custom.privacy_mode,
        text_participation: custom.text_participation ?? "disabled",
        voice_participation: custom.voice_participation ?? "disabled",
      };
  }
}

// ── 1. upgradeChannelToHelpdesk ─────────────────────────────────────────

const upgradeSchema = z.object({
  channel_id: z.string().uuid(),
  preset: z.enum(["ingen", "fag", "hr_privat", "tilpasset"]),
  responsible_profile_id: z.string().uuid(),
  custom_privacy_mode: z.enum(["public", "private_per_requester"]).optional(),
  custom_text_participation: z.enum(["disabled", "mention_only", "proactive"]).optional(),
  custom_voice_participation: z.enum(["disabled", "listen_only", "interactive"]).optional(),
});

export async function upgradeChannelToHelpdesk(
  input: z.infer<typeof upgradeSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = upgradeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const presetResult = resolvePresetConfig(parsed.data.preset, {
    privacy_mode: parsed.data.custom_privacy_mode,
    text_participation: parsed.data.custom_text_participation,
    voice_participation: parsed.data.custom_voice_participation,
  });
  if ("error" in presetResult) return { ok: false, error: presetResult.error };

  // Load the channel to confirm workspace + rep eligibility. Reads through
  // the JWT client so the workspace-scope lookup obeys RLS; writes below
  // use the admin client to bypass the narrowed channel_jwt_update policy.
  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, helpdesk_enabled, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  const { data: repProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role, is_active")
    .eq("profile_id", parsed.data.responsible_profile_id)
    .maybeSingle();

  if (!repProfile || !repProfile.is_active) {
    return { ok: false, error: "Selected responsible is not an active member." };
  }
  if (repProfile.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Selected responsible belongs to a different workspace." };
  }
  const eligibleRole =
    repProfile.role === "manager" || repProfile.role === "admin" || repProfile.role === "owner";
  if (!eligibleRole) {
    return {
      ok: false,
      error: "Only managers, admins, or owners can be responsible for a helpdesk.",
    };
  }

  // Switch to service role for the coordinated writes (channel flags +
  // channel_ai_policy upsert + channel_member upsert). RLS narrowing
  // forbids JWT from flipping helpdesk_enabled=true.
  const admin = createAdminClient();

  const { error: updateErr } = await admin
    .from("channel")
    .update({
      helpdesk_enabled: true,
      privacy_mode: presetResult.privacy_mode,
      responsible_profile_id: parsed.data.responsible_profile_id,
    })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke oppgradere kanal: ${updateErr.message}` };

  // Upsert AI policy. Reuses existing channel_ai_policy table per ADR-0165
  // Rule 5 — no parallel 'botsson_policy' column on channel. Conflict key
  // is channel_id (UNIQUE constraint at 20260422300000:399).
  const { error: policyErr } = await admin.from("channel_ai_policy").upsert(
    {
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      text_participation: presetResult.text_participation,
      voice_participation: presetResult.voice_participation,
    },
    { onConflict: "channel_id" },
  );

  if (policyErr) return { ok: false, error: `Kunne ikke lagre AI-policy: ${policyErr.message}` };

  // Upsert rep as channel_member with role='representative'. Won't collide
  // if they were already a member — updates role in place.
  const { error: memberErr } = await admin.from("channel_member").upsert(
    {
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      profile_id: parsed.data.responsible_profile_id,
      role: "representative",
    },
    { onConflict: "channel_id,profile_id" },
  );

  if (memberErr) return { ok: false, error: `Kunne ikke legge til rep: ${memberErr.message}` };

  await emit({
    event: "channel.helpdesk.enabled",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      preset: parsed.data.preset,
      privacy_mode: presetResult.privacy_mode,
      responsible_profile_id: parsed.data.responsible_profile_id,
      text_participation: presetResult.text_participation,
      voice_participation: presetResult.voice_participation,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 2. downgradeChannelFromHelpdesk ─────────────────────────────────────

const downgradeSchema = z.object({
  channel_id: z.string().uuid(),
});

export async function downgradeChannelFromHelpdesk(
  input: z.infer<typeof downgradeSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = downgradeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, helpdesk_enabled, responsible_profile_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }
  if (!channel.helpdesk_enabled) {
    return { ok: false, error: "Channel is not a helpdesk." };
  }

  // Refuse if any open ticket references this channel or a sub-channel
  // whose parent is this channel (context.desk_channel_id per ADR-0165).
  // Direct reference: engine_state.entity_id = channel_id (public-mode
  // tickets). Indirect: engine_state.context->>'desk_channel_id' =
  // channel_id (private-mode sub-channel tickets). Both are queried
  // because both represent "work-in-flight on this helpdesk".
  const admin = createAdminClient();
  const { data: directOpen, error: directErr } = await admin
    .from("engine_state")
    .select("id")
    .eq("process_id", "helpdesk_query_lifecycle")
    .in("status", ["waiting", "active"])
    .eq("entity_id", parsed.data.channel_id)
    .limit(1);

  if (directErr) return { ok: false, error: `Could not check open tickets: ${directErr.message}` };

  // context.desk_channel_id lookup via JSONB path filter. Using the admin
  // client so RLS narrowing on engine_state doesn't hide rows spawned by
  // other users in the same workspace.
  const { data: indirectOpen, error: indirectErr } = await admin
    .from("engine_state")
    .select("id")
    .eq("process_id", "helpdesk_query_lifecycle")
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["waiting", "active"])
    .eq("context->>desk_channel_id", parsed.data.channel_id)
    .limit(1);

  if (indirectErr)
    return { ok: false, error: `Could not check sub-channel tickets: ${indirectErr.message}` };

  if ((directOpen && directOpen.length > 0) || (indirectOpen && indirectOpen.length > 0)) {
    return {
      ok: false,
      error:
        "Kan ikke nedgradere: det er åpne saker på denne skranken. Løs eller reassign sakene først.",
    };
  }

  const previousResponsibleId = channel.responsible_profile_id;

  // Flip flags off. responsible_profile_id clears too so the CHECK
  // channel_helpdesk_requires_responsible stays satisfied (NOT
  // helpdesk_enabled → NULL allowed). privacy_mode also clears so
  // channel_private_requires_helpdesk stays satisfied.
  const { error: updateErr } = await admin
    .from("channel")
    .update({
      helpdesk_enabled: false,
      privacy_mode: null,
      responsible_profile_id: null,
    })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: `Kunne ikke nedgradere kanal: ${updateErr.message}` };

  // Demote prior rep to role='member' (L-0080 — never delete membership).
  if (previousResponsibleId) {
    await admin
      .from("channel_member")
      .update({ role: "member" })
      .eq("channel_id", parsed.data.channel_id)
      .eq("profile_id", previousResponsibleId);
  }

  await emit({
    event: "channel.helpdesk.disabled",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      previous_responsible_profile_id: previousResponsibleId,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 3. setResponsibleRep ────────────────────────────────────────────────

const setRepSchema = z.object({
  channel_id: z.string().uuid(),
  new_responsible_profile_id: z.string().uuid(),
});

export async function setResponsibleRep(
  input: z.infer<typeof setRepSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = setRepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, helpdesk_enabled, responsible_profile_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }
  if (!channel.helpdesk_enabled) {
    return { ok: false, error: "Channel is not a helpdesk — upgrade first." };
  }

  const { data: repProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role, is_active")
    .eq("profile_id", parsed.data.new_responsible_profile_id)
    .maybeSingle();

  if (!repProfile || !repProfile.is_active) {
    return { ok: false, error: "Selected responsible is not an active member." };
  }
  if (repProfile.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Selected responsible belongs to a different workspace." };
  }
  const eligibleRole =
    repProfile.role === "manager" || repProfile.role === "admin" || repProfile.role === "owner";
  if (!eligibleRole) {
    return {
      ok: false,
      error: "Only managers, admins, or owners can be responsible for a helpdesk.",
    };
  }

  const previousResponsibleId = channel.responsible_profile_id;
  if (previousResponsibleId === parsed.data.new_responsible_profile_id) {
    return { ok: true }; // no-op
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel")
    .update({ responsible_profile_id: parsed.data.new_responsible_profile_id })
    .eq("id", parsed.data.channel_id);

  if (updateErr) return { ok: false, error: updateErr.message };

  // L-0080 — demote the prior rep so channels don't accrete ghost reps.
  if (previousResponsibleId) {
    await admin
      .from("channel_member")
      .update({ role: "member" })
      .eq("channel_id", parsed.data.channel_id)
      .eq("profile_id", previousResponsibleId);
  }

  await admin.from("channel_member").upsert(
    {
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      profile_id: parsed.data.new_responsible_profile_id,
      role: "representative",
    },
    { onConflict: "channel_id,profile_id" },
  );

  await emit({
    event: "channel.responsible.reassigned",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      new_responsible_profile_id: parsed.data.new_responsible_profile_id,
      previous_responsible_profile_id: previousResponsibleId,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 4. openPublicTicketFromMessage ──────────────────────────────────────

const publicTicketSchema = z.object({
  channel_id: z.string().uuid(),
  message_content: z.string().min(1).max(10_000),
  requester_profile_id: z.string().uuid(),
});

/**
 * Runs the PII classifier against the message body, then either:
 *   - PII MISS: inserts the message in the same channel, creates an
 *     engine_state with entity_id=channel_id (ADR-0165 Rule 4 unified
 *     ontology, public-mode path), assignee=responsible rep.
 *   - PII HIT: spawns a query_thread sub-channel with requester + rep,
 *     redacts the public-timeline message to a placeholder, writes the
 *     original into the sub-channel, creates the engine_state with
 *     entity_id=sub_channel.id, emits helpdesk.pii.detected.
 *
 * Called by the public-mode Komm chat compose path. The mobile + web
 * UIs both route new messages through this action when the target
 * channel has helpdesk_enabled=true AND privacy_mode='public'.
 */
export async function openPublicTicketFromMessage(
  input: z.infer<typeof publicTicketSchema>,
): Promise<{ ok: true; ticket_id: string; channel_id: string } | ActionErr> {
  const parsed = publicTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveRequesterContext(supabase);
  if (!ctx.ok) return ctx;

  // Requester profile must match the caller — prevents a logged-in user
  // from opening a ticket "as" someone else. Server Actions run in the
  // caller's auth context; the requester_profile_id param is accepted
  // for mobile offline-queue alignment but MUST equal ctx.profileId.
  if (parsed.data.requester_profile_id !== ctx.profileId) {
    return { ok: false, error: "requester_profile_id must match the authenticated profile." };
  }

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, helpdesk_enabled, privacy_mode, responsible_profile_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }
  if (!channel.helpdesk_enabled) {
    return { ok: false, error: "Channel is not a helpdesk." };
  }
  if (channel.privacy_mode !== "public") {
    return { ok: false, error: "Channel is not in public mode — use openPrivateTicket." };
  }
  if (!channel.responsible_profile_id) {
    return { ok: false, error: "Channel has no responsible rep." };
  }

  // Run the classifier synchronously. Budget is ~microseconds for chat-
  // sized input per packages/ai/src/classifiers/pii-classifier.ts docs
  // — the 800ms timeout from ADR-0166 Rule 1 is for the hook round-trip,
  // not the function itself. No async wrapper needed here.
  const piiResult = classifyPii(parsed.data.message_content);

  const admin = createAdminClient();

  if (piiResult.detected) {
    // PII HIT path — spawn a private sub-channel, write the original there,
    // insert the redacted placeholder in the public timeline, create the
    // engine_state anchored on the sub-channel.
    const placeholderText = `[PII redigert — ${ctx.profileId.slice(0, 8)} har fått privat sak]`;

    const { data: subChannel, error: subErr } = await admin
      .from("channel")
      .insert({
        workspace_id: ctx.workspaceId,
        channel_type: "query_thread",
        name: `Privat sak (skjermet): ${parsed.data.message_content.slice(0, 40)}`,
        description: `PII-skjermet henvendelse fra #${channel.name ?? "offentlig"}`,
        created_by: ctx.profileId,
      })
      .select("id")
      .single();

    if (subErr || !subChannel) {
      return {
        ok: false,
        error: `Kunne ikke opprette privat kanal: ${subErr?.message ?? "unknown"}`,
      };
    }

    // Add requester + rep to the sub-channel. Rep as 'representative' so
    // the channel_jwt_select_responsible policy already grants access.
    const { error: memberErr } = await admin.from("channel_member").insert([
      {
        channel_id: subChannel.id,
        workspace_id: ctx.workspaceId,
        profile_id: ctx.profileId,
        role: "member",
      },
      {
        channel_id: subChannel.id,
        workspace_id: ctx.workspaceId,
        profile_id: channel.responsible_profile_id,
        role: "representative",
      },
    ]);
    if (memberErr)
      return { ok: false, error: `Kunne ikke legge til medlemmer: ${memberErr.message}` };

    // Insert REDACTED message on the public timeline. content carries the
    // placeholder, redacted_at marks the swap, classification_metadata
    // captures the classifier outcome (NO raw match text), and the hash
    // anchors audit dedup per ADR-0166 Rule 3.
    const nowIso = new Date().toISOString();
    const { error: publicMsgErr } = await admin.from("channel_message").insert({
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      sender_id: ctx.profileId,
      content: placeholderText,
      redacted_at: nowIso,
      original_content_hash: piiResult.originalContentHash,
      classification_metadata: {
        detected: true,
        categories: piiResult.matches.map((m) => m.category),
        classifier_version: piiResult.classifierVersion,
        classifier_duration_ms: piiResult.durationMs,
        soft_hold_outcome: "redacted",
      },
    });
    if (publicMsgErr)
      return { ok: false, error: `Kunne ikke skrive redigert melding: ${publicMsgErr.message}` };

    // Original (non-redacted) content goes in the sub-channel where only
    // requester + rep can see it. No classification_metadata on this
    // row — the sub-channel is the private destination, not a classifier
    // subject.
    const { error: subMsgErr } = await admin.from("channel_message").insert({
      channel_id: subChannel.id,
      workspace_id: ctx.workspaceId,
      sender_id: ctx.profileId,
      content: parsed.data.message_content,
    });
    if (subMsgErr)
      return { ok: false, error: `Kunne ikke skrive i privat kanal: ${subMsgErr.message}` };

    // engine_state anchored on the SUB-channel (private-mode ontology per
    // ADR-0165 Rule 4). context.desk_channel_id points back at the
    // original public helpdesk for Min kø grouping + downgrade safety.
    const { data: state, error: stateErr } = await admin
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: ctx.workspaceId,
        entity_type: "channel",
        entity_id: subChannel.id,
        status: "waiting",
        current_step: 1,
        assignee_id: channel.responsible_profile_id,
        context: {
          desk_channel_id: parsed.data.channel_id,
          requester_profile_id: ctx.profileId,
          summary: `[PII-skjermet henvendelse]`,
          pii_redacted: true,
        },
      })
      .select("id")
      .single();

    if (stateErr || !state)
      return { ok: false, error: `Kunne ikke opprette sak: ${stateErr?.message ?? "unknown"}` };

    await emit({
      event: "helpdesk.pii.detected",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "channel",
        entity_id: parsed.data.channel_id,
        entity_label: channel.name ?? "channel",
      },
      properties: {
        channel_id: parsed.data.channel_id,
        message_id: null, // public-timeline message ID not returned by insert above
        pii_categories: piiResult.matches.map((m) => m.category),
        classifier_version: piiResult.classifierVersion,
        duration_ms: piiResult.durationMs,
        redaction_outcome: "redacted",
      },
    });

    await emit({
      event: "helpdesk.query.opened",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "engine_state",
        entity_id: state.id,
        entity_label: "PII-skjermet henvendelse",
      },
      properties: {
        channel_id: subChannel.id,
        desk_channel_id: parsed.data.channel_id,
        assignee_profile_id: channel.responsible_profile_id,
        origin_type: "chat",
      },
    });

    revalidatePath(`/dashboard/komm/thread/${subChannel.id}`);
    return { ok: true, ticket_id: state.id, channel_id: subChannel.id };
  }

  // PII MISS path — public-mode normal flow. Single insert on the same
  // channel, engine_state.entity_id = channel.id (ADR-0165 Rule 4
  // unified ontology — presentation computes "first message" via a
  // MIN(created_at) query, never persists an FK).
  const { error: msgErr } = await admin.from("channel_message").insert({
    channel_id: parsed.data.channel_id,
    workspace_id: ctx.workspaceId,
    sender_id: ctx.profileId,
    content: parsed.data.message_content,
    original_content_hash: piiResult.originalContentHash,
    classification_metadata: {
      detected: false,
      categories: [],
      classifier_version: piiResult.classifierVersion,
      classifier_duration_ms: piiResult.durationMs,
      soft_hold_outcome: "allowed",
    },
  });
  if (msgErr) return { ok: false, error: `Kunne ikke skrive melding: ${msgErr.message}` };

  const { data: state, error: stateErr } = await admin
    .from("engine_state")
    .insert({
      process_id: "helpdesk_query_lifecycle",
      workspace_id: ctx.workspaceId,
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      status: "waiting",
      current_step: 1,
      assignee_id: channel.responsible_profile_id,
      context: {
        desk_channel_id: parsed.data.channel_id,
        requester_profile_id: ctx.profileId,
        summary: parsed.data.message_content.slice(0, 200),
      },
    })
    .select("id")
    .single();

  if (stateErr || !state)
    return { ok: false, error: `Kunne ikke opprette sak: ${stateErr?.message ?? "unknown"}` };

  await emit({
    event: "helpdesk.query.opened",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "engine_state",
      entity_id: state.id,
      entity_label: parsed.data.message_content.slice(0, 80),
    },
    properties: {
      channel_id: parsed.data.channel_id,
      desk_channel_id: parsed.data.channel_id,
      assignee_profile_id: channel.responsible_profile_id,
      origin_type: "chat",
    },
  });

  revalidatePath(`/dashboard/komm/thread/${parsed.data.channel_id}`);
  return { ok: true, ticket_id: state.id, channel_id: parsed.data.channel_id };
}

// ── 5. openPrivateTicket ────────────────────────────────────────────────

const privateTicketSchema = z.object({
  parent_channel_id: z.string().uuid(),
  summary: z.string().min(3).max(200),
  requester_profile_id: z.string().uuid(),
});

/**
 * HR-style private helpdesk path. Used when the parent channel has
 * privacy_mode='private_per_requester'. Each ticket spawns a
 * channel_type='query_thread' sub-channel with requester + rep only
 * members. engine_state.entity_id = sub_channel.id.
 *
 * Unlike openPublicTicketFromMessage, this path carries no message
 * content — the requester types into the sub-channel after it's
 * created. Therefore no PII classifier call here.
 */
export async function openPrivateTicket(
  input: z.infer<typeof privateTicketSchema>,
): Promise<{ ok: true; ticket_id: string; channel_id: string } | ActionErr> {
  const parsed = privateTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveRequesterContext(supabase);
  if (!ctx.ok) return ctx;

  if (parsed.data.requester_profile_id !== ctx.profileId) {
    return { ok: false, error: "requester_profile_id must match the authenticated profile." };
  }

  const { data: parentChannel } = await supabase
    .from("channel")
    .select("id, workspace_id, helpdesk_enabled, privacy_mode, responsible_profile_id, name")
    .eq("id", parsed.data.parent_channel_id)
    .maybeSingle();

  if (!parentChannel) return { ok: false, error: "Parent channel not found." };
  if (parentChannel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Parent channel belongs to a different workspace." };
  }
  if (!parentChannel.helpdesk_enabled) {
    return { ok: false, error: "Parent channel is not a helpdesk." };
  }
  if (parentChannel.privacy_mode !== "private_per_requester") {
    return {
      ok: false,
      error: "Parent channel is not in private mode — use openPublicTicketFromMessage.",
    };
  }
  if (!parentChannel.responsible_profile_id) {
    return { ok: false, error: "Parent channel has no responsible rep." };
  }

  const admin = createAdminClient();

  const { data: subChannel, error: subErr } = await admin
    .from("channel")
    .insert({
      workspace_id: ctx.workspaceId,
      channel_type: "query_thread",
      name: `Sak: ${parsed.data.summary.slice(0, 60)}`,
      description: `Privat sak på ${parentChannel.name ?? "skranke"}`,
      created_by: ctx.profileId,
    })
    .select("id")
    .single();

  if (subErr || !subChannel) {
    return { ok: false, error: `Kunne ikke opprette sak: ${subErr?.message ?? "unknown"}` };
  }

  const { error: memberErr } = await admin.from("channel_member").insert([
    {
      channel_id: subChannel.id,
      workspace_id: ctx.workspaceId,
      profile_id: ctx.profileId,
      role: "member",
    },
    {
      channel_id: subChannel.id,
      workspace_id: ctx.workspaceId,
      profile_id: parentChannel.responsible_profile_id,
      role: "representative",
    },
  ]);
  if (memberErr)
    return { ok: false, error: `Kunne ikke legge til medlemmer: ${memberErr.message}` };

  const { data: state, error: stateErr } = await admin
    .from("engine_state")
    .insert({
      process_id: "helpdesk_query_lifecycle",
      workspace_id: ctx.workspaceId,
      entity_type: "channel",
      entity_id: subChannel.id,
      status: "waiting",
      current_step: 1,
      assignee_id: parentChannel.responsible_profile_id,
      context: {
        desk_channel_id: parsed.data.parent_channel_id,
        requester_profile_id: ctx.profileId,
        summary: parsed.data.summary,
      },
    })
    .select("id")
    .single();

  if (stateErr || !state)
    return { ok: false, error: `Kunne ikke opprette sak: ${stateErr?.message ?? "unknown"}` };

  await emit({
    event: "helpdesk.query.opened",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: { entity_type: "engine_state", entity_id: state.id, entity_label: parsed.data.summary },
    properties: {
      channel_id: subChannel.id,
      desk_channel_id: parsed.data.parent_channel_id,
      assignee_profile_id: parentChannel.responsible_profile_id,
      origin_type: "chat",
    },
  });

  revalidatePath(`/dashboard/komm/thread/${subChannel.id}`);
  return { ok: true, ticket_id: state.id, channel_id: subChannel.id };
}

// ── 6. resolveTicketFromMessage ─────────────────────────────────────────

const resolveTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  resolution_note: z.string().max(500).optional(),
});

/**
 * Progressive-Channel resolve path. Mirrors the thread/[channelId]/
 * _actions/resolve-ticket.ts Server Action — completed_at stamping
 * (L-0079) is non-negotiable.
 *
 * Keeping this here alongside the rest of the Progressive Channel
 * actions so the Komm UI (Min kø, public-channel "Løs sak" affordance)
 * has a single import surface. The older per-thread action continues
 * to work for the deep-linked ticket view.
 */
export async function resolveTicketFromMessage(
  input: z.infer<typeof resolveTicketSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = resolveTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveRequesterContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: ticket } = await supabase
    .from("engine_state")
    .select("id, workspace_id, entity_id, assignee_id, status, context")
    .eq("id", parsed.data.ticket_id)
    .eq("process_id", "helpdesk_query_lifecycle")
    .maybeSingle();

  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Ticket belongs to a different workspace." };
  }
  if (ticket.status === "complete") {
    return { ok: false, error: "Ticket is already resolved." };
  }

  // Authorization: assignee OR admin in the ticket's workspace's company.
  // Same gate as resolve-ticket.ts Server Action, re-implemented here so
  // the two entry points share no implicit coupling — either can evolve
  // independently.
  if (ticket.assignee_id !== ctx.profileId) {
    const { data: workspace } = await supabase
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", ticket.workspace_id)
      .single();
    if (!workspace?.company_id) {
      return { ok: false, error: "Kunne ikke løse saken — workspace mangler company." };
    }
    const { data: member } = await supabase
      .from("company_member")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("company_id", workspace.company_id)
      .maybeSingle();
    const isAdmin = member?.role === "owner" || member?.role === "admin";
    if (!isAdmin) {
      return { ok: false, error: "Bare den ansvarlige eller en administrator kan løse saken." };
    }
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const nextContext = {
    ...(ticket.context as Record<string, unknown>),
    resolution_note: parsed.data.resolution_note ?? null,
    resolved_at: nowIso,
    resolved_by: ctx.profileId,
  };

  // L-0079 — completed_at MUST stamp on every terminal transition outside
  // engine-dispatch. SLA + reporting queries order on completed_at;
  // missing it silently drops UI-resolved rows off the timeline.
  const { error: updateErr } = await admin
    .from("engine_state")
    .update({
      status: "complete",
      context: nextContext,
      updated_at: nowIso,
      completed_at: nowIso,
    })
    .eq("id", parsed.data.ticket_id);

  if (updateErr) return { ok: false, error: updateErr.message };

  await emit({
    event: "helpdesk.query.resolved",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "engine_state",
      entity_id: parsed.data.ticket_id,
      entity_label: "helpdesk ticket",
    },
    properties: {
      channel_id: ticket.entity_id ?? "",
      has_resolution_note: Boolean(parsed.data.resolution_note),
    },
  });

  if (ticket.entity_id) {
    revalidatePath(`/dashboard/komm/thread/${ticket.entity_id}`);
  }
  revalidatePath("/dashboard/komm");

  return { ok: true };
}
