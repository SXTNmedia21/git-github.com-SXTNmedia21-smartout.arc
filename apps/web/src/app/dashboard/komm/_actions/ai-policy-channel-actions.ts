"use server";

/**
 * ai-policy-channel-actions.ts — Server Action for AiPolicyTab
 *
 * Upserts the channel_ai_policy row for a channel (one-to-one FK, UNIQUE
 * constraint on channel_id). Maps the 4-level access model (av / nevnt-kun /
 * les-foreslå / full-agent) to the DB text_participation + voice_participation
 * enums.
 *
 * Architecture notes:
 *   - Admin-gated via resolveAdminContext (same pattern as helpdesk-channel-actions.ts).
 *   - Write via admin client (service role) to bypass channel_jwt_update RLS.
 *   - ADR-0151: workspace_id from JWT profile, not body.
 *   - ADR-0078: voice_participation can only be set to non-'disabled' if the
 *     channel type is not a sensitive channel (HR skranke). We surface a warning
 *     in the UI but still allow the admin override — the gate here records the
 *     decision via emit().
 *   - Telemetry: channel.ai_policy_updated on every mutation.
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

// ── Access level → DB enum mapping ─────────────────────────────────────────
// The 4-level UI model maps to the existing channel_ai_text_mode /
// channel_ai_voice_mode enums (no new columns needed).

type AiAccessLevel = "off" | "mention_only" | "read_suggest" | "full_agent";

function accessLevelToParticipation(level: AiAccessLevel): {
  text_participation: Database["public"]["Enums"]["channel_ai_text_mode"];
  voice_participation: Database["public"]["Enums"]["channel_ai_voice_mode"];
} {
  switch (level) {
    case "off":
      return { text_participation: "disabled", voice_participation: "disabled" };
    case "mention_only":
      return { text_participation: "mention_only", voice_participation: "disabled" };
    case "read_suggest":
      return { text_participation: "proactive", voice_participation: "listen_only" };
    case "full_agent":
      return { text_participation: "proactive", voice_participation: "interactive" };
  }
}

// ── upsertChannelAiPolicy ───────────────────────────────────────────────────

const upsertSchema = z.object({
  channel_id: z.string().uuid(),
  access_level: z.enum(["off", "mention_only", "read_suggest", "full_agent"]),
  auto_reminders: z.boolean().default(false),
  auto_summarize: z.boolean().default(false),
  auto_shift_prep: z.boolean().default(false),
  // voice_override lets the admin explicitly permit voice even when access_level
  // would suppress it. Used when the channel is sensitive (HR skranke) and the
  // admin deliberately overrides the ADR-0078 warning. The UI shows the warning;
  // this flag records the conscious decision.
  voice_override: z.boolean().default(false),
});

export async function upsertChannelAiPolicy(
  input: z.infer<typeof upsertSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name, helpdesk_enabled, privacy_mode")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  // ADR-0078: voice on a private-mode HR skranke channel is forbidden unless
  // explicitly overridden by the admin. We block without override.
  const isPrivateHrChannel =
    channel.helpdesk_enabled && channel.privacy_mode === "private_per_requester";
  const { text_participation, voice_participation: rawVoice } = accessLevelToParticipation(
    parsed.data.access_level,
  );

  let voice_participation: Database["public"]["Enums"]["channel_ai_voice_mode"] = rawVoice;

  if (isPrivateHrChannel && rawVoice !== "disabled" && !parsed.data.voice_override) {
    return {
      ok: false,
      error:
        "ADR-0078: Stemme er ikke tillatt på private HR-skranker uten eksplisitt overstyring. Bekreft ved å slå på stemme-override.",
    };
  }
  if (isPrivateHrChannel && rawVoice !== "disabled" && parsed.data.voice_override) {
    // Allow — admin has consciously accepted the ADR-0078 risk; emit records it.
    voice_participation = rawVoice;
  }

  const admin = createAdminClient();
  const { error: upsertErr } = await admin.from("channel_ai_policy").upsert(
    {
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      text_participation,
      voice_participation,
      auto_reminders: parsed.data.auto_reminders,
      auto_summarize: parsed.data.auto_summarize,
      auto_shift_prep: parsed.data.auto_shift_prep,
    },
    { onConflict: "channel_id" },
  );

  if (upsertErr) return { ok: false, error: `Kunne ikke lagre AI-policy: ${upsertErr.message}` };

  await emit({
    event: "channel.ai_policy_updated",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      text_participation,
      voice_participation,
      auto_reminders: parsed.data.auto_reminders,
      auto_summarize: parsed.data.auto_summarize,
      auto_shift_prep: parsed.data.auto_shift_prep,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}
