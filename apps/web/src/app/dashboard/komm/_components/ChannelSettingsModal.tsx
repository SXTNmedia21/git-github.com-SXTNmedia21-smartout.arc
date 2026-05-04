"use client";

/**
 * ChannelSettingsModal — in-channel settings shell (ADR-0165).
 *
 * Phase 3 visual redesign (docs/design/smartout-design-helpdesk/project/
 * prototype/web-settings.jsx). Wide 920×760 floating card with:
 *  - `#` channel chip + Instrument Serif 28px channel name
 *  - Horizontal tab strip (active = bottom-border brand-orange)
 *  - Tab body owns its own footer (SkrankeTab renders save/cancel)
 *  - bg-background/88 + backdrop-blur-xl + noise-overlay
 *
 * Data wiring is unchanged from Phase 2: lazy-loaded posture + reps, gated
 * behind workspace admin check, server actions handle authz.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { cn } from "@/lib/utils";
import { SkrankeTab } from "./SkrankeTab";
import { GenereltTab } from "./GenereltTab";
import { MedlemmerTab } from "./MedlemmerTab";
import { AiPolicyTab } from "./AiPolicyTab";
import { OppbevaringTab } from "./OppbevaringTab";
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

type TabId = "general" | "members" | "ai" | "skranke" | "retention";

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

  // All 5 tabs are now wired. Each tab owns its own body + footer.
  const [activeTab, setActiveTab] = React.useState<TabId>("skranke");

  const tabs: Array<{ id: TabId; label: string; disabled?: boolean }> = [
    { id: "general", label: t("channel_settings.general_heading") },
    { id: "members", label: t("channel_settings.members_heading") },
    { id: "ai", label: t("channel_settings.ai_heading") },
    { id: "skranke", label: t("skranke_tab.title") },
    { id: "retention", label: t("channel_settings.retention_heading") },
  ];

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
      <DialogPortal>
        <DialogOverlay className="bg-black/30" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[760px] w-[min(920px,calc(100vw-48px))]",
            "-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "border-border bg-background/88 rounded-2xl border",
            "backdrop-blur-xl",
            "shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_40px_80px_-30px_rgba(0,0,0,0.45)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "noise-overlay",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("channel_settings.title")}
          </DialogPrimitive.Title>

          {/* Top edge highlight gradient (prototype line 82) */}
          <div
            aria-hidden="true"
            className="via-border h-px bg-gradient-to-r from-transparent to-transparent"
          />

          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-6">
            <div>
              <div className="mb-1.5 flex items-center gap-2.5">
                <div
                  aria-hidden="true"
                  className="bg-muted flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[13px] font-semibold"
                >
                  #
                </div>
                <div className="font-heading text-[28px] leading-[1.1] tracking-tight">
                  {channelName}
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                {t("skranke_tab.header_subtitle")}
              </div>
            </div>
            <DialogPrimitive.Close
              aria-label={t("channel_settings.close")}
              className="text-muted-foreground hover:bg-muted focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Tab strip */}
          <div className="border-border mt-5 flex gap-1.5 border-b px-8">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={tab.id === "skranke" ? "channel-settings-tab-skranke" : undefined}
                  onClick={() => {
                    if (!tab.disabled) setActiveTab(tab.id);
                  }}
                  disabled={tab.disabled}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-brand-orange text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                    tab.disabled && "hover:text-muted-foreground cursor-default opacity-60",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Body + footer are owned by the active tab so the tab controls
              its own scroll + sticky footer layout. Tabs are lazy-mounted
              (only rendered when active) to avoid unnecessary fetches. */}

          {/* Generelt tab */}
          {activeTab === "general" && (
            <GenereltTab
              channelId={channelId}
              channelName={channelName}
              onSettled={handleSettled}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {/* Medlemmer tab */}
          {activeTab === "members" && (
            <MedlemmerTab
              channelId={channelId}
              channelName={channelName}
              onSettled={handleSettled}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {/* AI-policy tab */}
          {activeTab === "ai" && (
            <AiPolicyTab
              channelId={channelId}
              channelName={channelName}
              isSensitiveChannel={
                posture?.helpdesk_enabled === true &&
                posture?.privacy_mode === "private_per_requester"
              }
              onSettled={handleSettled}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {/* Skranke tab */}
          {activeTab === "skranke" &&
            (isAdmin ? (
              posture ? (
                <SkrankeTab
                  channelId={channelId}
                  channelName={channelName}
                  helpdeskEnabled={posture.helpdesk_enabled}
                  privacyMode={posture.privacy_mode}
                  responsibleProfileId={posture.responsible_profile_id}
                  eligibleReps={reps ?? []}
                  onSettled={handleSettled}
                  onCancel={() => onOpenChange(false)}
                />
              ) : (
                <div className="text-muted-foreground flex-1 px-8 py-8 text-sm">…</div>
              )
            ) : (
              <div className="flex flex-1 flex-col gap-2 px-8 py-8">
                <h3 className="font-heading text-foreground text-lg">{t("skranke_tab.title")}</h3>
                <p className="text-muted-foreground text-sm">{t("toast.desks_forbidden")}</p>
              </div>
            ))}

          {/* Oppbevaring tab */}
          {activeTab === "retention" && (
            <OppbevaringTab
              channelId={channelId}
              channelName={channelName}
              onSettled={handleSettled}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
