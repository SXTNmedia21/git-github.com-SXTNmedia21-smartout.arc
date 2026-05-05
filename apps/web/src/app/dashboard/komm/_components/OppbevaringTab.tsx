"use client";

/**
 * OppbevaringTab — Channel message retention and GDPR settings.
 *
 * Visual pattern: preset-card grid + Section cards, matching SkrankeTab / web-settings.jsx.
 *
 * Cards:
 *   1. Lagringstid — 2x2 preset grid (30d / 90d / 1yr / Permanent)
 *      90d card gets mono "anbefalt" pill
 *      Active: brand-orange border + ring-[3px] + dashed consequence strip with message count
 *   2. Auto-arkivering — Section card, ToggleRow "Arkiver ved inaktivitet"
 *      When on: inline number input (default 90) + mono hint
 *   3. Legal hold — (admin only, dashed top border) ToggleRow "Frys kanalen under juridisk hold"
 *      When on: date picker + ring-destructive/12 ring-2 ambient halo + consequence strip
 *   4. GDPR & eksport — Section card (Row pattern with dividers)
 *      Row "Slett alle meldinger fra ansatt" (Trash2) → expand combobox + double-confirm
 *      Row "Last ned full historikk" (Download) → 2 format chips md/json → "Kommer snart" toast
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import { Archive, Clock, Download, Lock, Loader2, Shield, Trash2 } from "lucide-react";
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
  const [legalHoldToggle, setLegalHoldToggle] = React.useState(false);
  const [legalHoldDate, setLegalHoldDate] = React.useState("");

  // GDPR expand state
  const [showDeleteByPerson, setShowDeleteByPerson] = React.useState(false);
  const [deletePersonSearch, setDeletePersonSearch] = React.useState("");

  // Sync from DB
  React.useEffect(() => {
    if (retentionData) {
      setRetentionPreset(retentionPresetFromDays(retentionData.retention_days ?? null));
      setAutoArchiveEnabled(retentionData.auto_archive_days !== null);
      setAutoArchiveDays(retentionData.auto_archive_days ?? 90);
      const holdUntil = retentionData.legal_hold_until ?? null;
      setLegalHoldUntil(holdUntil);
      setLegalHoldToggle(holdUntil !== null && new Date(holdUntil) > new Date());
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
      setLegalHoldToggle(false);
      onSettled?.();
    });
  };

  const handleExport = async () => {
    toast.info(t("channel_settings.retention_export_coming_soon"));
  };

  const handleDeleteByPerson = () => {
    toast.info(t("channel_settings.retention_gdpr_delete_coming_soon"));
  };

  const retentionPresets: Array<{
    value: RetentionPreset;
    label: string;
    sublabel?: string;
    consequence: string;
    recommended?: boolean;
  }> = [
    {
      value: 30,
      label: t("channel_settings.retention_preset_30d"),
      sublabel: t("channel_settings.retention_preset_30d_sublabel"),
      consequence: t("channel_settings.retention_preset_30d_consequence"),
    },
    {
      value: 90,
      label: t("channel_settings.retention_preset_90d"),
      sublabel: t("channel_settings.retention_preset_90d_sublabel"),
      consequence: t("channel_settings.retention_preset_90d_consequence"),
      recommended: true,
    },
    {
      value: 365,
      label: t("channel_settings.retention_preset_1yr"),
      sublabel: t("channel_settings.retention_preset_1yr_sublabel"),
      consequence: t("channel_settings.retention_preset_1yr_consequence"),
    },
    {
      value: null,
      label: t("channel_settings.retention_preset_permanent"),
      sublabel: t("channel_settings.retention_preset_permanent_sublabel"),
      consequence: t("channel_settings.retention_preset_permanent_consequence"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[20px] tracking-tight">
            {t("channel_settings.retention_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.retention_lede")}
          </p>
        </div>

        {/* Legal hold active banner */}
        {hasLegalHold && (
          <div className="border-destructive bg-destructive/5 mb-5 flex items-start gap-3 rounded-2xl border p-4">
            <Lock className="text-destructive mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-destructive mb-1 text-sm font-semibold">
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

        {/* Card 1 — Lagringstid (2x2 preset grid) */}
        <fieldset
          aria-label={t("channel_settings.retention_group_label")}
          className="mb-5 grid grid-cols-2 gap-3"
          disabled={hasLegalHold || !isAdmin}
        >
          <legend className="sr-only">{t("channel_settings.retention_group_label")}</legend>

          {retentionPresets.map((preset) => {
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
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-semibold tracking-[-0.005em]">
                        {preset.label}
                      </div>
                      {/* "anbefalt" mono pill on 90d */}
                      {preset.recommended && (
                        <span className="bg-brand-orange/15 text-brand-orange rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase">
                          {t("channel_settings.retention_preset_recommended")}
                        </span>
                      )}
                    </div>
                    {preset.sublabel && (
                      <div className="text-muted-foreground text-[12px] leading-[1.4]">
                        {preset.sublabel}
                      </div>
                    )}
                    {/* Consequence strip (active only) */}
                    {selected && (
                      <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] leading-relaxed tracking-[0.01em]">
                        → {preset.consequence}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </fieldset>

        {/* Card 2 — Auto-arkivering (Section ToggleRow) */}
        <div className="bg-card border-border mb-5 rounded-2xl border p-5">
          <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
            {t("channel_settings.retention_auto_section_heading")}
          </div>

          <label className="flex cursor-pointer items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
                <Archive className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {t("channel_settings.retention_auto_archive_label")}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t("channel_settings.retention_auto_archive_sub")}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoArchiveEnabled}
              onChange={(e) => isAdmin && setAutoArchiveEnabled(e.target.checked)}
              disabled={!isAdmin || hasLegalHold}
              className="accent-brand-orange mt-0.5 h-4 w-4 flex-shrink-0"
            />
          </label>

          {/* Expanded: days input + mono hint */}
          {autoArchiveEnabled && (
            <div className="border-border mt-4 border-t pt-4">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">
                  {t("channel_settings.retention_auto_archive_after")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={autoArchiveDays}
                  onChange={(e) =>
                    setAutoArchiveDays(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={!isAdmin || hasLegalHold}
                  className="border-border bg-background focus:ring-ring w-16 rounded-xl border px-3 py-1.5 text-center font-mono text-sm font-medium focus:ring-2 focus:outline-none"
                />
                <span className="text-muted-foreground text-sm">
                  {t("channel_settings.retention_auto_archive_days_suffix")}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                {t("channel_settings.retention_auto_archive_hint", { days: autoArchiveDays })}
              </p>
            </div>
          )}
        </div>

        {/* Card 3 — Legal hold (admin only, dashed top-border separator) */}
        {isAdmin && (
          <div className="border-border mt-5 border-t border-dashed pt-5">
            <div
              className={cn(
                "bg-card rounded-2xl border p-5 transition-[box-shadow] duration-[180ms]",
                legalHoldToggle ? "border-destructive ring-destructive/12 ring-2" : "border-border",
              )}
            >
              <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
                {t("channel_settings.retention_legal_section_heading")}
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-muted mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
                    <Lock className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {t("channel_settings.retention_legal_hold_label")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t("channel_settings.retention_legal_hold_sub")}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={legalHoldToggle}
                  onChange={(e) => {
                    setLegalHoldToggle(e.target.checked);
                    if (!e.target.checked && hasLegalHold) handleClearLegalHold();
                  }}
                  disabled={isPending}
                  className="accent-destructive mt-0.5 h-4 w-4 flex-shrink-0"
                />
              </label>

              {/* Expanded: date picker + consequence strip */}
              {legalHoldToggle && !hasLegalHold && (
                <div className="border-border mt-4 border-t pt-4">
                  <div className="flex items-center gap-3">
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
                  {legalHoldDate && (
                    <div className="border-border text-muted-foreground mt-3 border-t border-dashed pt-2.5 font-mono text-[12px] leading-relaxed tracking-[0.01em]">
                      <div>→ {t("channel_settings.retention_legal_hold_consequence_lock")}</div>
                      <div>
                        →{" "}
                        {t("channel_settings.retention_legal_hold_consequence_date", {
                          date: new Date(legalHoldDate).toLocaleDateString("nb-NO", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }),
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Already-active hold: show clear button */}
              {hasLegalHold && legalHoldToggle && (
                <div className="border-border mt-4 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearLegalHold}
                    disabled={isPending}
                  >
                    {t("channel_settings.retention_legal_hold_clear")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card 4 — GDPR & eksport (Section card, Row pattern) */}
        <div className="bg-card border-border mt-5 rounded-2xl border">
          <div className="px-5 pt-5 pb-3">
            <div className="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
              {t("channel_settings.retention_gdpr_heading")}
            </div>
          </div>

          {/* Row: Slett alle meldinger fra ansatt */}
          <div className="border-border border-t px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
                  <Trash2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {t("channel_settings.retention_gdpr_delete_person_label")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("channel_settings.retention_gdpr_delete_person_sub")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteByPerson((v) => !v)}
                disabled={!isAdmin}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors focus:outline-none"
                aria-label={t("channel_settings.retention_gdpr_delete_person_expand")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Expand: combobox + double-confirm + "Kommer snart" */}
            {showDeleteByPerson && (
              <div className="bg-destructive/5 border-destructive/20 mt-3 rounded-xl border p-3">
                <input
                  type="text"
                  value={deletePersonSearch}
                  onChange={(e) => setDeletePersonSearch(e.target.value)}
                  placeholder={t("channel_settings.retention_gdpr_delete_person_placeholder")}
                  className="border-border bg-background focus:ring-ring mb-3 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteByPerson}
                  disabled={!deletePersonSearch}
                  className="gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("channel_settings.retention_gdpr_delete_person_action")}
                </Button>
              </div>
            )}
          </div>

          {/* Row: Last ned full historikk */}
          <div className="border-border border-t px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
                  <Download className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {t("channel_settings.retention_export_label")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("channel_settings.retention_export_sub")}
                  </div>
                </div>
              </div>

              {/* Format chips + download button */}
              <div className="flex items-center gap-2">
                {(["json", "md"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide uppercase transition-[border-color,background-color] duration-[180ms]",
                      exportFormat === fmt
                        ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {fmt}
                  </button>
                ))}
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
          </div>

          {/* Footer note */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 pt-1">
              <Shield className="text-muted-foreground h-3 w-3" aria-hidden="true" />
              <span className="text-muted-foreground font-mono text-[11px]">
                {t("channel_settings.retention_gdpr_footer_note")}
              </span>
            </div>
          </div>
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
