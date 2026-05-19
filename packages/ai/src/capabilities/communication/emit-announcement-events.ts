/**
 * emit-announcement-events.ts — Shared post-RPC emit helper for announcement publish paths.
 *
 * WHY: Four paths (agent tool, use-send-announcement, use-send-broadcast,
 * send-broadcast-action) all call publish_announcement_atomic and must emit
 * identical telemetry shapes after success. Centralising here prevents drift
 * between call-sites and satisfies ADR-0358 (every registry event has a wired
 * emit() call-site). See spec §9.b (2026-05-18-announcement-kind-tier-link-design-v2.md).
 *
 * Routing per registry:
 *   channel.message.sent       → posthog + logger + activity_trail  (extended V2 props)
 *   announcement.link_followed → posthog + activity_trail           (emitted by UI onClick, not here)
 *   announcement.kind_changed  → posthog                            (emitted by composer onChange, not here)
 *   announcement.tier_overridden → posthog + activity_trail         (emitted by composer onChange, not here)
 *
 * This helper emits ONLY the post-publish event (channel.message.sent extended).
 * Composer UX events (kind_changed, tier_overridden, link_followed) are emitted
 * at their respective UI interaction points — not here.
 */

import { emit, nonEmpty } from "@smartout/telemetry";

export interface AnnouncementPublishedPayload {
  /** Workspace the announcement was published in. */
  workspace_id: string;
  /** Profile ID of the actor who published. */
  actor_id: string;
  /** The channel_message.id returned by publish_announcement_atomic. */
  message_id: string;
  /** The channel the announcement was posted to. */
  channel_id: string;
  /** Origin of the publish action (agent, human, system). */
  origin_type: "agent" | "human" | "system";
  /** Resolved audience kind used in publish. */
  audience_kind?: string;
  /** Visibility scope — 'targeted_members' | 'all_members'. */
  visibility_scope?: string;
  /** Number of target profiles (0 = all). */
  target_profile_count?: number;
  /** Announcement kind (workspace_news, system_message, celebration, etc.). */
  kind?: string;
  /** Notification tier (social | work | external). */
  tier?: string;
  /** Number of tags attached to the announcement. */
  tag_count?: number;
  /** Whether an entity link was attached. */
  has_entity_link?: boolean;
  /** Entity link discriminator type (if any). */
  link_type?: string;
  /** Whether the tier was overridden from the kind-default. */
  tier_overridden?: boolean;
}

/**
 * Emit `channel.message.sent` with V2 announcement-specific properties.
 *
 * Called from all 4 announcement write-paths after successful RPC return per spec §9.b.
 * Fail-fast via `nonEmpty()` on workspace_id + actor_id (L-0177 pattern — empty strings
 * silently corrupt activity_trail routing).
 *
 * Returns a Promise; caller should `await` in server contexts or `void` in React onSuccess.
 */
export async function emitAnnouncementPublished(
  payload: AnnouncementPublishedPayload,
): Promise<void> {
  await emit({
    event: "channel.message.sent",
    workspace_id: nonEmpty(payload.workspace_id, "workspace_id"),
    actor_id: nonEmpty(payload.actor_id, "actor_id"),
    entity: {
      entity_type: "channel_message",
      entity_id: payload.message_id,
    },
    properties: {
      channel_id: payload.channel_id,
      origin_type: payload.origin_type,
      message_type: "announcement",
      audience_kind: payload.audience_kind,
      visibility_scope: payload.visibility_scope ?? "all_members",
      target_profile_count: payload.target_profile_count ?? 0,
      notification_priority: payload.tier === "external" ? 2 : payload.tier === "work" ? 1 : 0,
      notification_mode: payload.tier === "social" ? "community" : "work",
      // V2 announcement-specific properties (Track F extension of channel.message.sent)
      announcement_kind: payload.kind,
      announcement_tier: payload.tier,
      announcement_tag_count: payload.tag_count,
      announcement_has_link: payload.has_entity_link,
      announcement_link_type: payload.link_type,
      announcement_tier_overridden: payload.tier_overridden,
    },
  });
}
