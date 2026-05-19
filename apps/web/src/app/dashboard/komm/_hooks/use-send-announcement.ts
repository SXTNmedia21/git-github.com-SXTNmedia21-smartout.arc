"use client";

/**
 * useSendAnnouncement — Posts an announcement-type message to a news channel.
 *
 * V2 RPC migration: delegates to publish_announcement_atomic RPC (Track C M4)
 * which handles channel_message insert + announcement_meta sidecar atomically.
 * Accepts 5 new V2 fields: kind, tier, tags, linkedEntityType, linkedEntityId.
 *
 * Wave A extension preserved: audience targeting payload (targetProfileIds,
 * visibilityScope, audienceKind, audienceLabel) passed through to RPC.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { nonEmpty } from "@smartout/telemetry";
import { emitAnnouncementPublished } from "@smartout/ai/capabilities/communication/emit-announcement-events";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

// DB-canonical 9-value enum (announcement_kind). Subsets of Enums["announcement_kind"].
// workspace_news → general (synonym), external_link → external (synonym).
// celebration + system_message added in migration 20260620140700.
type AnnouncementKind =
  | "general"
  | "new_menu"
  | "new_hire"
  | "staff_event"
  | "schedule_change"
  | "policy_update"
  | "external"
  | "celebration"
  | "system_message";

type AnnouncementTier = "social" | "work" | "external";

// DB-canonical — anchored to announcement_link_type CHECK constraint
// (supabase/migrations/20260620140200_announcement_meta_table.sql:23-30).
// Dropped: session_task, engine_process, channel (no DB target).
// Renamed: url → external_url. DB-WINS per ADR-0173 + ADR-0271.
type AnnouncementLinkedEntityType =
  | "staff_event"
  | "schedule_shift"
  | "policy"
  | "protocol"
  | "profile"
  | "menu_document"
  | "external_url";

type AnnouncementInput = {
  channelId: string;
  content: string;
  profileId: string;
  targetProfileIds?: string[];
  visibilityScope?: "all_members" | "targeted_members";
  audienceKind: "all" | "on_duty" | "department" | "role" | "individuals";
  audienceLabel: string;
  // V2 fields
  kind?: AnnouncementKind;
  tier?: AnnouncementTier;
  tags?: string[];
  linkedEntityType?: AnnouncementLinkedEntityType;
  linkedEntityId?: string;
};

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      profileId,
      targetProfileIds,
      visibilityScope,
      audienceKind,
      audienceLabel,
      kind,
      tier,
      tags,
      linkedEntityType,
      linkedEntityId,
    }: AnnouncementInput) => {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();
      const isTargeted =
        (visibilityScope ?? "all_members") === "targeted_members" &&
        Array.isArray(targetProfileIds) &&
        targetProfileIds.length > 0;

      // V2: delegate to publish_announcement_atomic RPC (Track C M4).
      // Atomically inserts channel_message + announcement_meta sidecar in one
      // transaction — avoids partial writes if either insert fails.
      const { data, error } = await supabase.rpc("publish_announcement_atomic", {
        p_workspace_id: workspaceId,
        p_actor_profile_id: profileId,
        p_channel_id: channelId,
        p_content: content,
        p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
        p_target_profile_ids: isTargeted ? (targetProfileIds ?? []) : [],
        p_system_data: { audience_kind: audienceKind, audience_label: audienceLabel },
        p_kind: kind ?? "general",
        p_tier: tier ?? "work",
        p_tags: tags ?? [],
        p_linked_entity_type: linkedEntityType ?? undefined,
        p_linked_entity_id: linkedEntityId ?? undefined,
        p_client_message_id: clientMessageId,
      });

      if (error) throw error;
      return { id: data as string };
    },

    onSuccess: (data, variables) => {
      toast.success(t("nyheter.publish_success"));
      // Emit channel.message.sent with V2 announcement properties via shared helper
      // (spec §9.b, Track F). Replaces previous direct emit — helper includes all
      // Wave A props plus V2 announcement_tag_count / announcement_has_link / etc.
      void emitAnnouncementPublished({
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        message_id: data.id,
        channel_id: variables.channelId,
        origin_type: "human",
        audience_kind: variables.audienceKind,
        visibility_scope:
          (variables.visibilityScope ?? "all_members") === "targeted_members" &&
          (variables.targetProfileIds?.length ?? 0) > 0
            ? "targeted_members"
            : "all_members",
        target_profile_count: variables.targetProfileIds?.length ?? 0,
        kind: variables.kind ?? "general",
        tier: variables.tier ?? "work",
        tag_count: (variables.tags ?? []).length,
        has_entity_link: !!(variables.linkedEntityType && variables.linkedEntityId),
        link_type: variables.linkedEntityType,
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, variables.channelId),
      });
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },

    onError: () => {
      toast.error(t("nyheter.publish_error"));
    },
  });
}
