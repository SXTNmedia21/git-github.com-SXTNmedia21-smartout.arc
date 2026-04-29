"use client";

/**
 * OppbevaringTab — Channel message retention and GDPR settings.
 *
 * Retention period radio cards: 30d / 90d / 1yr / Permanent
 * Auto-archive toggle + days input (default 90)
 * Per-period consequence strip (dashed-top, mono)
 * GDPR section: export channel history (json/md), legal hold flag
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import { Archive, Clock, Download, Lock, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useWorkspace } from "@/lib/workspace-context";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import {
  setChannelRetention,
  setLegalHold,
  requestChannelExport,
} from "../_actions/retention-channel-actions";

type RetentionPreset = 30 | 90 | 365 | null; // null = permanent

type OppbevaringTabProps = {
  channelId: string;
  channelName: string;
  onSettled?: () => void;
  onCancel?: () => void;
};

function useChannelRetentionData(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-retention", workspace.workspace_id, channelId],
    staleTime: 15_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("channel")
        .select("retention_days, auto_archive_days, legal_hold_until, name")
        .eq("id", channelId)
        .maybeSingle();
      return data;
    },
  });
}

function retentionPresetFromDays(days: number | null): RetentionPreset {
  if (days === 30) return 30;
  if (days === 90) return 90;
  if (days === 365) return 365;
  return null; // permanent
}

export function OppbevaringTab({
  channelId,
  channelName,
  onSettled,
  onCancel,
}: OppbevaringTabProps) {
  const { t } = useTranslation("helpdesk");
  const { data: isAdmin } = useWorkspaceAdmin();
  const { data: retentionData } = useChannelRetentionData(channelId);

  const [retentionPreset, setRetentionPreset] = React.useState<RetentionPreset>(null);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = React.useState(false);
  const [autoArchiveDays, setAutoArchiveDays] = React.useState(90);
  const [isPending, startTransition] = React.useTransition();
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<"json" | "md">("json");

  // Legal hold
  const [legalHoldUntil, setLegalHoldUntil] = React.useState<string | null>(null);
  const [showLegalHoldPicker, setShowLegalHoldPicker] = React.useState(false);
  const [legalHoldDate, setLegalHoldDate] = React.useState("");

  // Sync from DB
  React.useEffect(() => {
    if (retentionData) {
      setRetentionPreset(retentionPresetFromDays(retentionData.retention_days ?? null));
      setAutoArchiveEnabled(retentionData.auto_archive_days !== null);
      setAutoArchiveDays(retentionData.auto_archive_days ?? 90);
      setLegalHoldUntil(retentionData.legal_hold_until ?? null);
    }
  }, [retentionData]);

  const hasLegalHold = legalHoldUntil !== null && new Date(legalHoldUntil) > new Date();

  const handleSave = () => {
    if (hasLegalHold) {
      toast.error(t("channel_settings.retention_hold_locked"));
      return;
    }
    startTransition(async () => {
      const result = await setChannelRetention({
        channel_id: channelId,
        retention_days: retentionPreset,
        auto_archive_days: autoArchiveEnabled ? autoArchiveDays : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.retention_saved"));
      onSettled?.();
    });
  };

  const handleSetLegalHold = () => {
    if (!legalHoldDate) return;
    startTransition(async () => {
      const result = await setLegalHold({
        channel_id: channelId,
        legal_hold_until: new Date(legalHoldDate).toISOString(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.retention_hold_set"));
      setShowLegalHoldPicker(false);
      onSettled?.();
    });
  };

  const handleClearLegalHold = () => {
    startTransition(async () => {
      const result = await setLegalHold({
        channel_id: channelId,
        legal_hold_until: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.retention_hold_cleared"));
      onSettled?.();
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await requestChannelExport({
        channel_id: channelId,
        format: exportFormat,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    } finally {
      setIsExporting(false);
    }
  };

  const presets: Array<{
    value: RetentionPreset;
    label: string;
    consequence: string;
  }> = [
    {
      value: 30,
      label: t("channel_settings.retention_preset_30d"),
      consequence: t("channel_settings.retention_preset_30d_consequence"),
    },
    {
      value: 90,
      label: t("channel_settings.retention_preset_90d"),
      consequence: t("channel_settings.retention_preset_90d_consequence"),
    },
    {
      value: 365,
      label: t("channel_settings.retention_preset_1yr"),
      consequence: t("channel_settings.retention_preset_1yr_consequence"),
    },
    {
      value: null,
      label: t("channel_settings.retention_preset_permanent"),
      consequence: t("channel_settings.retention_preset_permanent_consequence"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[22px] tracking-tight">
            {t("channel_settings.retention_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.retention_lede")}
          </p>
        </div>

        {/* Legal hold banner — shown when hold is active */}
        {hasLegalHold && (
          <div className="border-destructive bg-destructive/5 mb-5 flex items-start gap-3 rounded-2xl border p-4">
            <Lock className="text-destructive mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-destructive mb-1 text-[13px] font-semibold">
                {t("channel_settings.retention_hold_active_title")}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed">
                {t("channel_settings.retention_hold_active_body", {
                  date: new Date(legalHoldUntil!).toLocaleDateString("nb-NO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }),
                })}
              </div>
            </div>
          </div>
        )}

        {/* Retention period — radio cards (2-col) */}
        <fieldset
          aria-label={t("channel_settings.retention_group_label")}
          className="mb-6 grid grid-cols-2 gap-3"
          disabled={hasLegalHold || !isAdmin}
        >
          <legend className="sr-only">{t("channel_settings.retention_group_label")}</legend>
          {presets.map((preset) => {
            const selected = retentionPreset === preset.value;
            return (
              <button
                key={String(preset.value)}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => isAdmin && !hasLegalHold && setRetentionPreset(preset.value)}
                disabled={!isAdmin || hasLegalHold}
                className={cn(
                  "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
                    : "border-border hover:border-foreground/20",
                  (!isAdmin || hasLegalHold) && "cursor-not-allowed opacity-60",
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-brand-orange" : "border-muted-foreground/50",
                    )}
                  >
                    {selected && <span className="bg-brand-orange h-2 w-2 rounded-full" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold tracking-[-0.005em]">
                      {preset.label}
                    </div>
                    {/* Consequence strip (active only) */}
                    {selected && (
                      <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] tracking-[0.01em]">
                        → {preset.consequence}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </fieldset>

        {/* Auto-archive toggle */}
        <div className="bg-card border-border mb-6 rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Archive className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                <div className="text-sm font-semibold">
                  {t("channel_settings.retention_auto_archive_label")}
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                {t("channel_settings.retention_auto_archive_sub")}
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoArchiveEnabled}
              onChange={(e) => isAdmin && setAutoArchiveEnabled(e.target.checked)}
              disabled={!isAdmin || hasLegalHold}
              className="accent-brand-orange mt-1 h-4 w-4 flex-shrink-0"
            />
          </div>
          {autoArchiveEnabled && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {t("channel_settings.retention_auto_archive_after")}
              </span>
              <input
                type="number"
                min={1}
                max={3650}
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={!isAdmin || hasLegalHold}
                className="border-border bg-background focus:ring-ring w-20 rounded-xl border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
              />
              <span className="text-muted-foreground text-sm">
                {t("channel_settings.retention_auto_archive_days_suffix")}
              </span>
            </div>
          )}
        </div>

        {/* GDPR section */}
        <div className="border-border rounded-2xl border p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <div className="text-sm font-semibold">
              {t("channel_settings.retention_gdpr_heading")}
            </div>
          </div>

          {/* Export */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {t("channel_settings.retention_export_label")}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("channel_settings.retention_export_sub")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "json" | "md")}
                className="border-border bg-background text-muted-foreground rounded-lg border px-2 py-1 text-xs focus:outline-none"
              >
                <option value="json">JSON</option>
                <option value="md">Markdown</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || !isAdmin}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t("channel_settings.retention_export_action")}
              </Button>
            </div>
          </div>

          {/* Legal hold */}
          {isAdmin && (
            <div className="border-border border-t border-dashed pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-0.5 flex items-center gap-1.5 text-sm font-medium">
                    <Lock className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                    {t("channel_settings.retention_legal_hold_label")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("channel_settings.retention_legal_hold_sub")}
                  </div>
                </div>
                <div className="flex gap-2">
                  {hasLegalHold ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearLegalHold}
                      disabled={isPending}
                    >
                      {t("channel_settings.retention_legal_hold_clear")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLegalHoldPicker((p) => !p)}
                      disabled={isPending}
                    >
                      {t("channel_settings.retention_legal_hold_set_action")}
                    </Button>
                  )}
                </div>
              </div>
              {showLegalHoldPicker && !hasLegalHold && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="date"
                    value={legalHoldDate}
                    onChange={(e) => setLegalHoldDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border-border bg-background focus:ring-ring rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleSetLegalHold}
                    disabled={!legalHoldDate || isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      t("channel_settings.retention_legal_hold_confirm")
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
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
              disabled={isPending || hasLegalHold}
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
