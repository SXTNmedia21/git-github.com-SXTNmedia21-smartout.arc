"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { channelKeys } from "./channel-keys";

type CallStartedPayload = {
  channel_id: string;
  call_session_id: string;
  channel_name: string | null;
  started_by_name: string | null;
};

/**
 * Workspace-wide watcher — fires a toast + Browser Notification whenever a
 * new channel_call_session is inserted in a channel the signed-in user is a
 * member of. Keeps the user aware of incoming calls even when they're on a
 * different channel in the komm view.
 *
 * Wants an RPC `notify_call_members(channel_id)` that returns the enriched
 * payload above. Falls back to a client-side join if the RPC isn't there.
 */
export function useWorkspaceCallAlerts(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");
  const queryClient = useQueryClient();
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profileId || !workspaceId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`workspace-calls:${workspaceId}:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_call_session",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            channel_id: string;
            started_by: string | null;
          };

          // Don't alert the caller about their own call
          if (row.started_by === profileId) return;
          if (shownRef.current.has(row.id)) return;

          // Verify the current user is a member of that channel before alerting
          const { data: membership } = await supabase
            .from("channel_member")
            .select("channel_id")
            .eq("channel_id", row.channel_id)
            .eq("profile_id", profileId)
            .is("left_at", null)
            .maybeSingle();

          if (!membership) return;

          shownRef.current.add(row.id);

          // Enrich with channel name + caller name for the toast body
          const [{ data: ch }, { data: caller }] = await Promise.all([
            supabase.from("channel").select("name, channel_type").eq("id", row.channel_id).single(),
            row.started_by
              ? supabase
                  .from("profile")
                  .select("display_name")
                  .eq("profile_id", row.started_by)
                  .single()
              : Promise.resolve({ data: null }),
          ]);

          const channelLabel =
            ch?.name ?? (ch?.channel_type === "direct" ? t("channel.direct_message") : "");
          const callerName = caller?.display_name ?? t("chat_list.unknown");

          const message = t("call.alert_body", { caller: callerName, channel: channelLabel });

          // In-app toast with join button
          toast.info(t("call.alert_title"), {
            description: message,
            duration: 15_000,
            action: {
              label: t("call.join"),
              onClick: () => {
                const url = new URL(window.location.href);
                url.searchParams.set("channel", row.channel_id);
                window.location.href = url.toString();
              },
            },
          });

          // Browser notification (best-effort, needs user permission)
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(t("call.alert_title"), { body: message, tag: row.id });
            } else if (Notification.permission === "default") {
              Notification.requestPermission().then((perm) => {
                if (perm === "granted") {
                  new Notification(t("call.alert_title"), { body: message, tag: row.id });
                }
              });
            }
          }

          // Invalidate active-calls query so channel list updates
          queryClient.invalidateQueries({
            queryKey: channelKeys.workspaceActiveCalls(workspaceId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channel_call_session",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.workspaceActiveCalls(workspaceId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, profileId, t, queryClient]);
}
