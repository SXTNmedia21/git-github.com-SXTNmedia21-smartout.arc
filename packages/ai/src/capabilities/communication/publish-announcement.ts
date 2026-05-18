/**
 * publish-announcement.ts — Agent capability tool for publishing workspace announcements.
 *
 * WHY: Wave A shipped the human-author path (useSendAnnouncement + ComposeAnnouncement
 * modal). This tool adds the agent-author path so Botsson can compose announcements
 * on behalf of managers via a single conversational turn.
 *
 * Two-call draft-return pattern (ADR-0099 §C4 broadcast-class harm prevention):
 *   1. confirm=false (default) → resolve audience + return draft preview. No INSERT.
 *   2. confirm=true (after human approval) → INSERT channel_message + emit.
 *
 * Authority: callGateAction (capability=communication) → gates before INSERT.
 * Voice: rejected in-tool as FIRST statement per Council B3 (gate_action's
 *   channel_allowed only activates with p_engine_process_id; direct calls skip it).
 * PII: tool return NEVER exposes raw target_profile_ids — only count + label.
 *
 * ADR references:
 *   ADR-0099  — gate_action RPC + four-eyes invariant
 *   ADR-0078  — voice-channel guard (in-tool layer)
 *   ADR-0163  — channel AI participation policy (isAiAllowedInChannel)
 *   ADR-0173  — capability boundary (communication owns channel_message)
 *   ADR-0189  — seed-parity + default-deny
 *   ADR-0287  — gate_action mandatory on all mutation capability tools
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { callGateAction } from "./gate.js";
import { isAiAllowedInChannel } from "./policy.js";
import { resolveAudience, type AudienceInput } from "./audience-resolver.js";

export const publishAnnouncement = defineTool({
  name: "publish_announcement",
  description:
    "Compose and publish a workspace announcement on behalf of the manager. " +
    "Two-call pattern: first call with confirm=false (default) returns a draft + " +
    "audience preview for human confirmation; second call with confirm=true publishes " +
    "the announcement via RPC (publish_announcement_atomic). Voice channel is rejected. " +
    "Audience resolution is server-side; raw profile IDs are never returned to the agent. " +
    "V2: accepts kind (staff_event|system_message|celebration|workspace_news|external_link), " +
    "tier (social|work|external), optional tags, and optional entity-link pair (type+id). " +
    "Choose kind by intent: celebration for birthdays, system_message for mandatory ops, " +
    "workspace_news as default. Choose tier by urgency: external for urgent (emails sent), " +
    "work for standard, social for low-key community.",
  capability: "communication",
  schema: z
    .object({
      channel_id: z.string().uuid().describe("The news channel ID for this workspace"),
      title: z.string().min(1).max(120).describe("Announcement title (first line)"),
      body: z.string().min(1).max(1600).describe("Announcement body text"),
      audience_kind: z
        .enum(["all", "on_duty", "department", "role", "individuals"])
        .describe(
          "Audience targeting kind. " +
            "'all' = all active workspace members. " +
            "'on_duty' = members currently clocked in. " +
            "'department' = supply department_ids. " +
            "'role' = supply roles. " +
            "'individuals' = supply profile_ids.",
        ),
      department_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Required when audience_kind='department'"),
      roles: z
        .array(z.enum(["admin", "manager", "employee", "owner"]))
        .optional()
        .describe("Required when audience_kind='role'"),
      profile_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Required when audience_kind='individuals'"),
      kind: z
        .enum(["staff_event", "system_message", "celebration", "workspace_news", "external_link"])
        .optional()
        .describe(
          "Announcement classification per V2 spec §4. Defaults server-side to 'workspace_news' when omitted. " +
            "staff_event: personaltreff/gathering. system_message: ops mandatory. " +
            "celebration: birthday/anniversary. workspace_news: general (default). " +
            "external_link: pointing to URL or external resource.",
        ),
      tier: z
        .enum(["social", "work", "external"])
        .optional()
        .describe(
          "Notification routing tier per V2 spec §11. Defaults server-side to 'work' when omitted. " +
            "social: low priority, community mode + push/in_app. " +
            "work: standard priority, work mode + push/in_app (default). " +
            "external: elevated priority + email channel.",
        ),
      tags: z
        .array(z.string().min(1).max(30))
        .max(8)
        .optional()
        .describe("Free-form tags for grouping/filtering. Max 8 tags, 30 chars each."),
      linked_entity_type: z
        .enum(["staff_event", "session_task", "engine_process", "channel", "url"])
        .optional()
        .describe("Polymorphic entity-link discriminator. Must pair with linked_entity_id."),
      linked_entity_id: z
        .string()
        .uuid()
        .optional()
        .describe("Polymorphic entity-link target id. Must pair with linked_entity_type."),
      confirm: z
        .boolean()
        .default(false)
        .describe(
          "False (default): resolve audience + return draft for human confirmation. No RPC call. " +
            "True: publish after human approval. Two-call pattern protects against " +
            "agent auto-publishing workspace-wide content without explicit consent.",
        ),
    })
    .refine(
      (data) =>
        (data.linked_entity_type === undefined && data.linked_entity_id === undefined) ||
        (data.linked_entity_type !== undefined && data.linked_entity_id !== undefined),
      {
        message: "linked_entity_type and linked_entity_id must both be provided or both omitted",
      },
    ),
  execute: async (params, ctx: AgentToolContext) => {
    // Council B3: voice reject as FIRST statement — MUST precede gate call.
    // gate_action's channel_allowed only activates with p_engine_process_id;
    // direct agent calls do NOT pass it (ADR-0078 Layer 3 in-tool guard).
    if (ctx.channel === "voice") {
      return "Announcement publishing is not available over voice. Switch to chat.";
    }

    const supabase = ctx.supabaseAdmin;

    // ADR-0287: gate_action mandatory before any mutation. Evaluates
    // engine_authority_config + four-eyes + channel restriction. Fail-closed
    // on missing seed (ADR-0189 + L-0066 default-deny).
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "communication",
      actionType: "publish_announcement_atomic",
      channel: ctx.channel ?? "chat",
      entityId: undefined,
    });

    if (!gate.allow) {
      const reason = gate.reason ?? "unknown";
      return `Cannot publish announcement: authority gate denied — ${reason}.`;
    }

    // Verify the requesting profile is a member of the target channel
    const { data: member, error: memberError } = await supabase
      .from("channel_member")
      .select("id")
      .eq("channel_id", params.channel_id)
      .eq("profile_id", ctx.profileId)
      .single();

    if (memberError || !member) {
      return "You are not a member of this channel.";
    }

    // ADR-0163 Layer 2: channel AI participation policy.
    // Announcements are always agent-initiated (non-proactive in the mention sense),
    // but we use isDirectlyMentioned=false here as the manager explicitly invoked
    // the tool — it is not auto-proactive in the spam sense.
    const allowed = await isAiAllowedInChannel(supabase, params.channel_id, "text", false);
    if (!allowed) {
      return "AI participation is disabled in this channel per channel_ai_policy.";
    }

    // Build AudienceInput from params
    const audience: AudienceInput =
      params.audience_kind === "all"
        ? { kind: "all" }
        : params.audience_kind === "on_duty"
          ? { kind: "on_duty" }
          : params.audience_kind === "department"
            ? { kind: "department", departmentIds: params.department_ids ?? [] }
            : params.audience_kind === "role"
              ? { kind: "role", roles: params.roles ?? [] }
              : { kind: "individuals", profileIds: params.profile_ids ?? [] };

    // Server-side audience resolution — no profile IDs leak to the agent
    let resolved: { profileIds: string[]; count: number; label: string };
    try {
      resolved = await resolveAudience(supabase, ctx.workspaceId, audience);
    } catch (err) {
      return `Audience resolution failed: ${err instanceof Error ? err.message : "unknown error"}`;
    }

    if (resolved.count === 0) {
      return "Audience resolves to 0 recipients. Adjust audience targeting or use 'all'.";
    }

    // Phase: draft — return preview, no INSERT (confirm=false default)
    if (!params.confirm) {
      return JSON.stringify({
        phase: "draft",
        target_profile_count: resolved.count,
        audience_label: resolved.label,
        draft: { title: params.title, body: params.body },
        next_step:
          "Show this draft to the user. On confirmation, call publish_announcement again with confirm=true.",
      });
    }

    // Phase: published — RPC publish_announcement_atomic (atomic per ADR-0369)
    const isTargeted = audience.kind !== "all";
    const content = `${params.title}\n${params.body}`;
    const clientMessageId = crypto.randomUUID();

    const { data: messageId, error } = await supabase.rpc("publish_announcement_atomic", {
      p_workspace_id: ctx.workspaceId,
      p_actor_profile_id: ctx.profileId,
      p_channel_id: params.channel_id,
      p_content: content,
      p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
      p_target_profile_ids: isTargeted ? resolved.profileIds : [],
      p_system_data: { audience_kind: audience.kind, audience_label: resolved.label },
      p_kind: params.kind ?? "workspace_news",
      p_tier: params.tier ?? "work",
      p_tags: params.tags ?? [],
      p_linked_entity_type: params.linked_entity_type ?? null,
      p_linked_entity_id: params.linked_entity_id ?? null,
      p_client_message_id: clientMessageId,
    });

    if (error) {
      return `Error publishing announcement: ${error.message}`;
    }
    const data = { id: messageId as string };

    // Telemetry via existing channel.message.sent event (extended by Wave A b95742cef)
    await emit({
      event: "channel.message.sent",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      entity: {
        entity_type: "channel_message",
        entity_id: data.id,
      },
      properties: {
        channel_id: params.channel_id,
        origin_type: "agent",
        message_type: "announcement",
        visibility_scope: isTargeted ? "targeted_members" : "all_members",
        target_profile_count: resolved.count,
        audience_kind: audience.kind,
        notification_priority: params.tier === "external" ? 2 : params.tier === "work" ? 1 : 0,
        notification_mode: params.tier === "social" ? "community" : "work",
        // V2 announcement properties (announcement_kind, announcement_tier, has_entity_link,
        // tag_count) live on the NEW announcement.published event (Track F). Adding them
        // to channel.message.sent here would require extending its registry entry — out
        // of scope for Track D. They re-appear once Track F registers announcement.published.
      },
    });

    // TODO Track F: emit "announcement.published" once registry extended
    // (emitAnnouncementPublished helper ships in Track F per spec §9.b)

    // PII boundary (Council B5): NEVER return raw target_profile_ids
    return JSON.stringify({
      phase: "published",
      message_id: data.id,
      target_profile_count: resolved.count,
      audience_label: resolved.label,
    });
  },
});
