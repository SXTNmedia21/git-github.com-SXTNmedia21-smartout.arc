"use client";

/**
 * GenereltTab — General channel settings (name, description, danger zone).
 *
 * Admin view: editable name + description, archive + delete actions.
 * Non-admin view: read-only.
 *
 * Visual shape follows SkrankeTab exactly:
 *   - Scrolling body owns its own content
 *   - Sticky footer: Clock hint + Cancel / Save buttons
 *   - Danger zone: dashed-top-border card (archive = muted, delete = destructive)
 *
 * Nordic Split tokens only. Lucide icons only. No hardcoded colors.
 */

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, Clock, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useWorkspace } from "@/lib/workspace-context";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import {
  renameChannel,
  setChannelDescription,
  archiveChannel,
  deleteChannel,
} from "../_actions/general-channel-actions";

type GenereltTabProps = {
  channelId: string;
  channelName: string;
  onSettled?: () => void;
  onCancel?: () => void;
};

function useChannelGeneralData(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-general", workspace.workspace_id, channelId],
    staleTime: 15_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("channel")
        .select(
          "id, name, description, channel_type, created_at, created_by, is_archived, is_read_only",
        )
        .eq("id", channelId)
        .maybeSingle();
      return data;
    },
  });
}

function useChannelMemberCount(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-member-count", workspace.workspace_id, channelId],
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("channel_member")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .is("left_at", null);
      return count ?? 0;
    },
  });
}

export function GenereltTab({ channelId, channelName, onSettled, onCancel }: GenereltTabProps) {
  const { t } = useTranslation("helpdesk");
  const { data: isAdmin } = useWorkspaceAdmin();
  const { data: channelData } = useChannelGeneralData(channelId);
  const { data: memberCount } = useChannelMemberCount(channelId);

  const [name, setName] = React.useState(channelName);
  const [description, setDescription] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");

  // Sync channel data when it loads
  React.useEffect(() => {
    if (channelData) {
      setName(channelData.name ?? channelName);
      setDescription(channelData.description ?? "");
    }
  }, [channelData, channelName]);

  const descriptionLength = description.length;
  const descriptionOverLimit = descriptionLength > 280;

  const isDirty =
    name.trim() !== (channelData?.name ?? channelName) ||
    description !== (channelData?.description ?? "");

  const handleSave = () => {
    if (!isDirty) return;
    startTransition(async () => {
      const nameChanged = name.trim() !== (channelData?.name ?? channelName);
      const descChanged = description !== (channelData?.description ?? "");

      const tasks: Array<Promise<{ ok: boolean; error?: string }>> = [];
      if (nameChanged && name.trim()) {
        tasks.push(renameChannel({ channel_id: channelId, new_name: name.trim() }));
      }
      if (descChanged) {
        tasks.push(setChannelDescription({ channel_id: channelId, description }));
      }

      const results = await Promise.all(tasks);
      const failure = results.find((r) => !r.ok);
      if (failure && !failure.ok) {
        toast.error((failure as { ok: false; error: string }).error);
        return;
      }
      toast.success(t("channel_settings.general_saved"));
      onSettled?.();
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveChannel({ channel_id: channelId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.general_archived"));
      onSettled?.();
      onCancel?.();
    });
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteChannel({
        channel_id: channelId,
        confirm_name: deleteConfirmName,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.general_deleted"));
      onCancel?.();
    });
  };

  const createdDate = channelData?.created_at
    ? new Date(channelData.created_at).toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[22px] tracking-tight">
            {t("channel_settings.general_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.general_lede")}
          </p>
        </div>

        {/* Name + Description fields */}
        <div className="bg-card border-border mb-6 space-y-5 rounded-2xl border p-5">
          {/* Channel name */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">
              {t("channel_settings.general_name_label")}
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-semibold"
              >
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={!isAdmin || isPending}
                className={cn(
                  "border-border bg-background focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-7 text-sm transition-colors focus:ring-2 focus:outline-none",
                  !isAdmin && "cursor-not-allowed opacity-60",
                )}
                placeholder={t("channel_settings.general_name_placeholder")}
              />
            </div>
          </div>

          {/* Channel type chip (read-only) */}
          <div>
            <div className="mb-1.5 text-sm font-semibold">
              {t("channel_settings.general_type_label")}
            </div>
            <div className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-semibold"
              >
                #
              </span>
              <span className="text-muted-foreground font-mono text-sm">
                {channelData?.channel_type ?? "channel"}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="mb-1.5 flex items-end justify-between">
              <label className="block text-sm font-semibold">
                {t("channel_settings.general_description_label")}
              </label>
              <span
                className={cn(
                  "font-mono text-[11px] transition-colors",
                  descriptionOverLimit ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {descriptionLength}/280
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              disabled={!isAdmin || isPending}
              className={cn(
                "border-border bg-background focus:ring-ring w-full resize-none rounded-xl border px-3 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none",
                !isAdmin && "cursor-not-allowed opacity-60",
                descriptionOverLimit && "border-destructive",
              )}
              placeholder={t("channel_settings.general_description_placeholder")}
            />
          </div>

          {/* Meta row: created date + member count */}
          {(createdDate || memberCount !== undefined) && (
            <div className="text-muted-foreground flex gap-4 font-mono text-xs">
              {createdDate && (
                <span>
                  {t("channel_settings.general_created")}: {createdDate}
                </span>
              )}
              {memberCount !== undefined && (
                <span>
                  {memberCount} {t("channel_settings.general_members")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Danger zone — dashed top border, only for admins */}
        {isAdmin && (
          <div className="border-border rounded-2xl border border-dashed">
            <div className="border-border border-b border-dashed px-5 py-3">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-[0.06em]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("channel_settings.general_danger_zone")}
              </div>
            </div>

            {/* Archive */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-semibold">
                  {t("channel_settings.general_archive_label")}
                </div>
                <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                  → {t("channel_settings.general_archive_consequence")}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isPending || channelData?.is_archived}
                className="gap-2"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                {t("channel_settings.general_archive_action")}
              </Button>
            </div>

            {/* Delete */}
            <div className="border-border flex flex-col gap-3 border-t border-dashed px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-destructive text-sm font-semibold">
                    {t("channel_settings.general_delete_label")}
                  </div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                    → {t("channel_settings.general_delete_consequence")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {showDeleteConfirm
                    ? t("channel_settings.general_delete_confirm_action")
                    : t("channel_settings.general_delete_action")}
                </Button>
              </div>

              {/* Double-confirm input (shown after first click) */}
              {showDeleteConfirm && (
                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs">
                    {t("channel_settings.general_delete_confirm_label", {
                      name: channelData?.name ?? channelName,
                    })}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    disabled={isPending}
                    className="border-destructive bg-background focus:ring-destructive/30 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    placeholder={channelData?.name ?? channelName}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="border-border bg-background/60 flex items-center justify-between border-t px-8 py-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {t("skranke_tab.autosave_hint")}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t("skranke_tab.cancel")}
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={isPending || !isDirty || descriptionOverLimit}
              className="min-w-32"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t("skranke_tab.save_pending")}
                </>
              ) : (
                t("skranke_tab.save_full")
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
