/**
 * publish-announcement.ts — Agent capability tool for publishing workspace announcements.
 *
 * WHY: Wave A shipped the human-author path (useSendAnnouncement + ComposeAnnouncement
 * modal). This tool adds the agent-author path so Botsson can compose announcements
 * on behalf of managers via a single conversational turn.
 *
 * Two-call draft-return pattern with InlineConfirmCard (ADR-0398, ADR-0099 §C4
 * broadcast-class harm prevention):
 *   1. confirm=false (default) → gate precheck + resolve audience + return
 *      InlineConfirmCardDescriptor via show_proposal_card (HITL, Architecture B).
 *   2. confirm=true (after human approval via card) → INSERT channel_message + emit.
 *      proposal_id from draft phase = p_client_message_id (RPC-level idempotency).
 *
 * Authority: callGateAction (capability=communication) → gates before INSERT and before
 *   draft descriptor is returned (precheck avoids dead-end UX per Blocking Condition #1).
 * Voice: rejected in-tool as FIRST statement per Council B3 (gate_action's
 *   channel_allowed only activates with p_engine_process_id; direct calls skip it).
 * PII: tool return NEVER exposes raw target_profile_ids — only count + label.
 *
 * ADR references:
 *   ADR-0099  — gate_action RPC + four-eyes invariant
 *   ADR-0078  — voice-channel guard (in-tool layer)
 *   ADR-0151  — server-derived workspace_id + profile_id (commit re-resolves audience)
 *   ADR-0163  — channel AI participation policy (isAiAllowedInChannel)
 *   ADR-0173  — capability boundary (communication owns channel_message)
 *   ADR-0189  — seed-parity + default-deny
 *   ADR-0287  — gate_action mandatory on all mutation capability tools
 *   ADR-0398  — InlineConfirmCard HITL primitive (Architecture B)
 *   L-0177    — silent-fallback ban (audience re-resolved server-side on commit)
 *   L-0330    — stateless default: proposal_id = same UUID as client_message_id
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { callGateAction } from "./gate.js";
import { isAiAllowedInChannel } from "./policy.js";
import { resolveAudience, type AudienceInput } from "./audience-resolver.js";
import { emitAnnouncementPublished } from "./emit-announcement-events.js";
import { emit, nonEmpty } from "@smartout/telemetry";
import { buildInlineConfirmCard } from "../../primitives/inline-confirm-card/index.js";

export const publishAnnouncement = defineTool({
  name: "publish_announcement",
  description:
    "Compose and publish a workspace announcement on behalf of the manager. " +
    "Phase 1: draft phase (confirm=false, default) returns an InlineConfirmCardDescriptor " +
    "for HITL confirmation via the show_proposal_card client-tool. The LLM must call " +
    "show_proposal_card with the descriptor immediately after; do NOT verbalize the draft. " +
    "Commit phase (confirm=true) requires proposal_id from the draft phase response; " +
    "idempotency is enforced via p_client_message_id (same UUID). Audience is re-resolved " +
    "server-side on commit per ADR-0151 + L-0177 (silent-fallback ban). " +
    "Voice channel is rejected. Raw profile IDs are never returned to the agent. " +
    "V2: accepts kind (7 agent-valid values: general|new_menu|new_hire|staff_event|" +
    "schedule_change|policy_update|external), " +
    "tier (social|work|external), optional tags, and optional entity-link pair (type+id). " +
    "NOTE: celebration and system_message are service-role-only — the RPC rejects JWT callers " +
    "for those kinds (ADR-0372 §Agent Impact). Agents must NOT use them. " +
    "Choose kind by intent: general as default (was workspace_news — use general). " +
    "Choose tier by urgency: external for urgent (emails sent), " +
    "work for standard, social for low-key community.",
  capability: "communication",
  schema: z
    .object({
      channel_id: z.string().uuid().describe("The news channel ID for this workspace"),
      title: z.string().min(1).max(120).describe("Announcement title (first line)"),
      body: z.string().min(1).max(1600).describe("Announcement body text"),
      audience_kind: z
        .enum(["all", "on_duty", "on_shift", "department", "role", "individuals"])
        .describe(
          "Audience targeting kind. " +
            "'all' = all active workspace members. " +
            "'on_duty' = members currently clocked in (punch_out IS NULL). " +
            "'on_shift' = members with a scheduled shift within ±2h of now — use for pre-shift announcements. " +
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
        .enum([
          "general",
          "new_menu",
          "new_hire",
          "staff_event",
          "schedule_change",
          "policy_update",
          "external",
        ])
        .optional()
        .describe(
          "Announcement classification — 7 agent-valid values from DB enum announcement_kind. " +
            "general: default news/updates (maps former workspace_news). " +
            "new_menu: menu updates. new_hire: new employee announcement. " +
            "staff_event: personaltreff/gathering. schedule_change: shift/schedule updates. " +
            "policy_update: policy or rule changes. external: URL/external resource link (maps former external_link). " +
            "EXCLUDED (service-role only, RPC rejects JWT): celebration (ADR-0372 cron-auto), system_message. " +
            "Defaults to 'general' when omitted.",
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
        .enum([
          "staff_event",
          "schedule_shift",
          "policy",
          "protocol",
          "profile",
          "menu_document",
          "external_url",
        ])
        .optional()
        .describe(
          "Polymorphic entity-link discriminator anchored to DB enum announcement_link_type " +
            "(CHECK constraint in 20260620140200_announcement_meta_table.sql:23-30). " +
            "Must pair with linked_entity_id. Valid values and their paired kind: " +
            "staff_event→staff_event kind, schedule_shift→staff_event/general, " +
            "policy→system_message, protocol→system_message, profile→celebration/staff_event, " +
            "menu_document→general, external_url→external kind.",
        ),
      linked_entity_id: z
        .string()
        .uuid()
        .optional()
        .describe("Polymorphic entity-link target id. Must pair with linked_entity_type."),
      confirm: z
        .boolean()
        .default(false)
        .describe(
          "False (default): resolve audience + return InlineConfirmCardDescriptor for HITL " +
            "confirmation via show_proposal_card. No RPC call. " +
            "True: publish after human approval. Two-call pattern protects against " +
            "agent auto-publishing workspace-wide content without explicit consent.",
        ),
      proposal_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "UUID from the draft phase response (proposal_id field). Pass this back on the " +
            "confirm=true call to ensure RPC idempotency via p_client_message_id (L-0330). " +
            "If omitted on commit, a fresh UUID is generated (idempotency lost but safe).",
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
    // BUG-SIM-17: on_shift queries schedule_shift (shifts in current window),
    // distinct from on_duty (currently clocked in).
    const audience: AudienceInput =
      params.audience_kind === "all"
        ? { kind: "all" }
        : params.audience_kind === "on_duty"
          ? { kind: "on_duty" }
          : params.audience_kind === "on_shift"
            ? { kind: "on_shift" }
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

    // Precheck gate (Blocking Condition #1 per ADR-0398): verify commit-phase will be
    // allowed BEFORE returning the draft descriptor. Avoids dead-end UX where the user
    // confirms a draft that the gate then denies. Uses actionType "publish_announcement"
    // (draft-phase action) — distinct from the commit-phase "publish_announcement_atomic".
    // Placed AFTER resolveAudience so audience non-empty is confirmed first.
    const precheckGate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "communication",
      actionType: "publish_announcement",
      channel: ctx.channel ?? "chat",
      entityId: undefined,
    });
    if (!precheckGate.allow) {
      return `Ikke tillatt: ${precheckGate.reason ?? "manglende autoritet"}`;
    }

    // Lift clientMessageId BEFORE the confirm branch so BOTH draft and commit phases share
    // the same UUID (L-0330 stateless-default). On commit, prefer params.proposal_id (from
    // the card result) to preserve RPC-level idempotency; fall back to fresh UUID if absent.
    const clientMessageId = !params.confirm
      ? crypto.randomUUID()
      : (params.proposal_id ?? crypto.randomUUID());

    // Phase: draft — return InlineConfirmCardDescriptor for HITL confirmation (ADR-0398 Architecture B)
    if (!params.confirm) {
      const descriptor = buildInlineConfirmCard({
        proposal_id: clientMessageId,
        surface: "announcement",
        draft: {
          title: params.title,
          body: params.body,
          audience_kind: params.audience_kind,
          channel_id: params.channel_id,
          kind: params.kind,
          tier: params.tier,
        },
        preview: {
          title: params.title,
          body_excerpt: params.body.slice(0, 200) + (params.body.length > 200 ? "…" : ""),
          recipient_count: resolved.count,
          metadata: [
            { label: "Mottakere", value: resolved.label },
            { label: "Kind", value: params.kind ?? "general" },
            { label: "Tier", value: params.tier ?? "work" },
          ],
        },
        actions: [
          { id: "confirm", label: "Publiser", variant: "primary" },
          { id: "edit", label: "Endre", variant: "ghost", editable_fields: ["title", "body"] },
          { id: "cancel", label: "Avbryt", variant: "destructive" },
        ],
        channel_constraint: ["chat"],
        platforms: ["web"],
      });

      // Telemetry: card shown (L-0233 — emit in tool body, server-side, NOT React)
      // nonEmpty() wraps match client-tool impl + ADR-0134 fail-fast (T9/F3).
      // Coordinate with T6 if inline_confirm_card.shown is not yet in the registry.
      await emit({
        event: "inline_confirm_card.shown",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          surface: "announcement",
          proposal_id: clientMessageId,
          recipient_count: resolved.count,
        },
      });

      return JSON.stringify({
        phase: "draft",
        proposal_id: clientMessageId,
        descriptor,
        next_step:
          "Call show_proposal_card with the inline_confirm_card descriptor. Do not verbalize the draft.",
      });
    }

    // Phase: published — RPC publish_announcement_atomic (atomic per ADR-0369)
    // TRUST BOUNDARY (ADR-0151 + L-0177): audience is re-resolved server-side from
    // ctx.workspaceId. Audience params from body (audience_kind, department_ids, roles,
    // profile_ids) are accepted but used ONLY within ctx.workspaceId's RLS scope.
    // Body-supplied workspace_id is NEVER trusted — ctx.workspaceId is authoritative.

    // DEFENSE 3 (ADR-0398 §Resume-Payload Trust Boundary) — Phase 1 narrowing:
    // When proposal_id is present (resume from InlineConfirmCard), this is a commit
    // on a previously shown draft. The descriptor only permits editable_fields:
    // ["title", "body"]. All audience-targeting fields (audience_kind, department_ids,
    // roles, profile_ids) are NOT in editable_fields — they must NOT be accepted from
    // the body on resume. Phase 1 enforcement: force audience_kind="all" (safe default)
    // and ignore body-supplied targeting params. The audience variable above was built
    // from body params in the draft phase (before confirm=true); we re-resolve below.
    // Phase 2 will replace this with stateful audience-fingerprint check via
    // engine_memory keyed by proposal_id (deferred to ADR-0400).
    //
    // Refs: ADR-0398 §Resume-Payload Trust Boundary, L-0177 (silent-fallback ban),
    //       T9 code-review finding F1 (CRITICAL).
    const effectiveAudience = params.proposal_id != null ? ({ kind: "all" } as const) : audience;

    let effectiveResolved = resolved;
    if (params.proposal_id != null && audience.kind !== "all") {
      // Re-resolve with forced "all" since body-supplied targeting is not trustworthy on resume.
      try {
        effectiveResolved = await resolveAudience(supabase, ctx.workspaceId, effectiveAudience);
      } catch (err) {
        return `Audience re-resolution failed on resume: ${err instanceof Error ? err.message : "unknown error"}`;
      }
    }

    const isTargeted = effectiveAudience.kind !== "all";
    const content = `${params.title}\n${params.body}`;

    const { data: messageId, error } = await supabase.rpc("publish_announcement_atomic", {
      p_workspace_id: ctx.workspaceId,
      p_actor_profile_id: ctx.profileId,
      p_channel_id: params.channel_id,
      p_content: content,
      p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
      p_target_profile_ids: isTargeted ? effectiveResolved.profileIds : [],
      p_system_data: {
        audience_kind: effectiveAudience.kind,
        audience_label: effectiveResolved.label,
      },
      p_kind: params.kind ?? "general",
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

    // Telemetry: channel.message.sent (V2 extended) via shared helper (spec §9.b, Track F).
    // emitAnnouncementPublished wires all announcement-specific properties including
    // V2 kind/tier/link/tag fields registered in Track F per ADR-0358.
    await emitAnnouncementPublished({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      message_id: data.id,
      channel_id: params.channel_id,
      origin_type: "agent",
      audience_kind: effectiveAudience.kind,
      visibility_scope: isTargeted ? "targeted_members" : "all_members",
      target_profile_count: effectiveResolved.count,
      kind: params.kind ?? "general",
      tier: params.tier ?? "work",
      tag_count: (params.tags ?? []).length,
      has_entity_link: !!(params.linked_entity_type && params.linked_entity_id),
      link_type: params.linked_entity_type,
    });

    // Telemetry: card confirmed (L-0233 — emit in tool body, server-side, NOT React)
    // nonEmpty() wraps match client-tool impl + ADR-0134 fail-fast (T9/F3).
    // Coordinate with T6 if inline_confirm_card.confirmed is not yet in the registry.
    await emit({
      event: "inline_confirm_card.confirmed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        surface: "announcement",
        proposal_id: clientMessageId,
        recipient_count: effectiveResolved.count,
      },
    });

    // PII boundary (Council B5): NEVER return raw target_profile_ids
    return JSON.stringify({
      phase: "published",
      message_id: data.id,
      target_profile_count: effectiveResolved.count,
      audience_label: effectiveResolved.label,
    });
  },
});
