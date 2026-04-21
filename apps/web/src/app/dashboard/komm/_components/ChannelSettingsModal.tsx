"use client";

/**
 * ChannelSettingsModal — in-channel settings shell (ADR-0165).
 *
 * Hosts the Skranke tab in Phase 2. Designed to be extended: additional
 * tabs (e.g. Members, Notifications) can join the Tabs stack without
 * touching the Dialog shell.
 *
 * The Skranke tab is only rendered for workspace admins. Non-admins see
 * a single informational panel explaining what the tab would do but
 * lacking the controls. The server actions reject non-admins regardless
 * — this gating is purely UX polish so we don't advertise an edit path
 * that would fail on submit.
 *
 * This component is mounted by ChannelHeader when the settings button is
 * clicked. Data is lazy-loaded: eligible reps + flags + admin check only
 * run once the modal is open.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LifeBuoy } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { SkrankeTab } from "./SkrankeTab";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useEligibleReps } from "../_hooks/use-eligible-reps";
import { useChannelHelpdeskFlags } from "../_hooks/use-channel-helpdesk-flags";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useQuery } from "@tanstack/react-query";

type ChannelSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelName: string;
};

/**
 * Resolve the channel's current helpdesk flags. Prefers the shared flag
 * map from useChannelHelpdeskFlags, falls back to a dedicated fetch for
 * the case where the channel is NOT helpdesk-enabled yet (the shared map
 * only returns helpdesk_enabled=true rows to keep it cheap for the
 * sidebar).
 */
function useChannelPosture(channelId: string, open: boolean) {
  const { data: flags } = useChannelHelpdeskFlags();
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ["channel-posture", workspace.workspace_id, channelId],
    enabled: open,
    staleTime: 10_000,
    queryFn: async () => {
      const cached = flags?.get(channelId);
      if (cached) return cached;
      const supabase = createClient();
      const { data } = await supabase
        .from("channel")
        .select("helpdesk_enabled, privacy_mode, responsible_profile_id")
        .eq("id", channelId)
        .maybeSingle();
      return {
        helpdesk_enabled: data?.helpdesk_enabled ?? false,
        privacy_mode: (data?.privacy_mode ?? null) as "public" | "private_per_requester" | null,
        responsible_profile_id: data?.responsible_profile_id ?? null,
      };
    },
  });
}

export function ChannelSettingsModal({
  open,
  onOpenChange,
  channelId,
  channelName,
}: ChannelSettingsModalProps) {
  const { t } = useTranslation("helpdesk");
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useWorkspaceAdmin();
  const { data: reps } = useEligibleReps(open && isAdmin === true);
  const { data: posture } = useChannelPosture(channelId, open);

  // Invalidate the posture + sidebar queries after a mutation settles so
  // the sidebar badges + tab state re-hydrate without a full reload.
  const handleSettled = React.useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["channel-posture", workspace.workspace_id, channelId],
    });
    queryClient.invalidateQueries({
      queryKey: ["channel-helpdesk-flags", workspace.workspace_id],
    });
    queryClient.invalidateQueries({ queryKey: ["min-ko", workspace.workspace_id] });
    queryClient.invalidateQueries({
      queryKey: ["desk-open-counts", workspace.workspace_id],
    });
  }, [queryClient, workspace.workspace_id, channelId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-border/40 border-b px-5 py-4">
          <DialogTitle className="font-heading text-base">
            {t("channel_settings.title")}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="skranke" className="w-full">
          {isAdmin && (
            <TabsList className="mx-5 mt-3">
              <TabsTrigger
                value="skranke"
                className="gap-1.5"
                data-testid="channel-settings-tab-skranke"
              >
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                {t("skranke_tab.title")}
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="skranke" className="mt-0">
            {isAdmin ? (
              posture ? (
                <SkrankeTab
                  channelId={channelId}
                  channelName={channelName}
                  helpdeskEnabled={posture.helpdesk_enabled}
                  privacyMode={posture.privacy_mode}
                  responsibleProfileId={posture.responsible_profile_id}
                  eligibleReps={reps ?? []}
                  onSettled={handleSettled}
                />
              ) : (
                <div className="text-muted-foreground p-5 text-sm">…</div>
              )
            ) : (
              <div className="flex flex-col gap-2 p-5">
                <h3 className="font-heading text-foreground text-lg">{t("skranke_tab.title")}</h3>
                <p className="text-muted-foreground text-sm">{t("toast.desks_forbidden")}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
