"use client";

/**
 * SkrankeTab — Phase 3 visual redesign (web-settings.jsx).
 *
 * ADR-0165 four-preset model kept verbatim:
 *   - "Ingen skranke"      → downgradeChannelFromHelpdesk
 *   - "Fag-skranke"        → upgradeChannelToHelpdesk({ preset: "fag" })
 *   - "HR-skranke"         → upgradeChannelToHelpdesk({ preset: "hr_privat" })
 *   - "Tilpasset"          → upgradeChannelToHelpdesk({ preset: "tilpasset", ... })
 *
 * Visual shape from prototype:
 *   - Section intro with 22px heading + "Les mer" external link
 *   - 2-col grid of 4 preset cards (14px radius, 18px padding)
 *   - Active card gets brand-orange border + ring
 *   - Active card consequence strip (dashed top-border + mono 12px)
 *   - Warn variant for "tilpasset" (amber left-border strip)
 *   - Ansvarlig card (only when helpdesk preset) — LighthouseAvatar halo="idle"
 *   - Live private-mode preview strip (eye chip + body copy)
 *   - Sticky footer with clock hint + Cancel/Save buttons
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  Clock,
  ChevronDown,
  Eye,
  ExternalLink,
  LifeBuoy,
  Loader2,
  Lock,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { LighthouseAvatar } from "@/components/helpdesk-orb";
import { ResponsibleRepCombobox, type ResponsibleRep } from "./ResponsibleRepCombobox";
import {
  upgradeChannelToHelpdesk,
  downgradeChannelFromHelpdesk,
  setResponsibleRep,
} from "../_actions/helpdesk-channel-actions";

type UiPreset = "aapen" | "offentlig" | "privat" | "tilpasset";

type SkrankeTabProps = {
  channelId: string;
  channelName: string;
  helpdeskEnabled: boolean;
  privacyMode: "public" | "private_per_requester" | null;
  responsibleProfileId: string | null;
  eligibleReps: ResponsibleRep[];
  onSettled?: () => void;
  onCancel?: () => void;
};

/**
 * Derive the currently-active UI preset from the channel's flags. Used on
 * mount to highlight the correct radio + to short-circuit no-op saves.
 */
function currentPreset(
  helpdeskEnabled: boolean,
  privacyMode: SkrankeTabProps["privacyMode"],
): UiPreset {
  if (!helpdeskEnabled) return "aapen";
  if (privacyMode === "private_per_requester") return "privat";
  if (privacyMode === "public") return "offentlig";
  return "tilpasset";
}

export function SkrankeTab({
  channelId,
  channelName: _channelName,
  helpdeskEnabled,
  privacyMode,
  responsibleProfileId,
  eligibleReps,
  onSettled,
  onCancel,
}: SkrankeTabProps) {
  const { t } = useTranslation("helpdesk");

  const initialPreset = currentPreset(helpdeskEnabled, privacyMode);
  const [selectedPreset, setSelectedPreset] = React.useState<UiPreset>(initialPreset);
  const [selectedRep, setSelectedRep] = React.useState<string | null>(responsibleProfileId);
  const [isPending, startTransition] = React.useTransition();
  const [blockedCount, setBlockedCount] = React.useState<number | null>(null);
  const [showRepPicker, setShowRepPicker] = React.useState(false);

  // Keep local state in sync if the parent re-fetches and the channel
  // was updated elsewhere (e.g. another admin reassigning the rep).
  React.useEffect(() => {
    setSelectedPreset(currentPreset(helpdeskEnabled, privacyMode));
    setSelectedRep(responsibleProfileId);
    setShowRepPicker(false);
  }, [helpdeskEnabled, privacyMode, responsibleProfileId]);

  const needsRep =
    selectedPreset === "offentlig" || selectedPreset === "privat" || selectedPreset === "tilpasset";
  const repMissing = needsRep && !selectedRep;

  const selectedRepObj = React.useMemo(
    () => eligibleReps.find((r) => r.profile_id === selectedRep) ?? null,
    [eligibleReps, selectedRep],
  );

  const handleSave = () => {
    setBlockedCount(null);

    // Case 1: Turn off (current is helpdesk, target is "aapen").
    if (selectedPreset === "aapen") {
      if (!helpdeskEnabled) return; // no-op
      startTransition(async () => {
        const result = await downgradeChannelFromHelpdesk({ channel_id: channelId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t("toast.skranke_downgraded"));
        onSettled?.();
      });
      return;
    }

    // Cases 2–4: Upgrade / reassign.
    if (!selectedRep) {
      toast.error(t("toast.skranke_error"));
      return;
    }

    // No-op: same preset, same rep.
    if (
      selectedPreset === initialPreset &&
      selectedRep === responsibleProfileId &&
      helpdeskEnabled
    ) {
      return;
    }

    startTransition(async () => {
      const presetUnchanged = selectedPreset === initialPreset;
      if (helpdeskEnabled && presetUnchanged && selectedRep !== responsibleProfileId) {
        const result = await setResponsibleRep({
          channel_id: channelId,
          new_responsible_profile_id: selectedRep,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t("toast.rep_reassigned"));
        onSettled?.();
        return;
      }

      const backendPreset =
        selectedPreset === "offentlig"
          ? "fag"
          : selectedPreset === "privat"
            ? "hr_privat"
            : "tilpasset";

      const result = await upgradeChannelToHelpdesk({
        channel_id: channelId,
        preset: backendPreset,
        responsible_profile_id: selectedRep,
        ...(backendPreset === "tilpasset"
          ? {
              custom_privacy_mode: "public" as const,
              custom_text_participation: "disabled" as const,
              custom_voice_participation: "disabled" as const,
            }
          : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toast.skranke_upgraded"));
      onSettled?.();
    });
  };

  const isDisable = selectedPreset === "aapen" && helpdeskEnabled;
  const saveDisabled = isPending || (!isDisable && repMissing);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px] flex items-end justify-between gap-4">
          <div>
            <div className="font-heading mb-1 text-[22px] tracking-tight">
              {t("skranke_tab.section_heading")}
            </div>
            <p className="text-muted-foreground max-w-[560px] text-sm">
              {t("skranke_tab.section_lede")}
            </p>
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] transition-colors"
          >
            {t("skranke_tab.learn_more")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        {/* Preset grid */}
        <fieldset
          aria-label={t("skranke_tab.preset_group_label")}
          className="mb-6 grid grid-cols-2 gap-3"
        >
          <legend className="sr-only">{t("skranke_tab.preset_group_label")}</legend>

          <PresetCard
            value="aapen"
            selected={selectedPreset === "aapen"}
            icon={null}
            title={t("skranke_tab.preset_aapen_label")}
            lede={t("skranke_tab.preset_aapen_summary")}
            onSelect={() => setSelectedPreset("aapen")}
          />
          <PresetCard
            value="offentlig"
            selected={selectedPreset === "offentlig"}
            icon={<LifeBuoy className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("skranke_tab.preset_offentlig_label")}
            lede={t("skranke_tab.preset_offentlig_summary")}
            consequence={{
              primary: t("skranke_tab.preset_offentlig_consequence_primary"),
              ai: t("skranke_tab.preset_offentlig_consequence_ai"),
            }}
            onSelect={() => setSelectedPreset("offentlig")}
          />
          <PresetCard
            value="privat"
            selected={selectedPreset === "privat"}
            icon={<Lock className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("skranke_tab.preset_privat_label")}
            lede={t("skranke_tab.preset_privat_summary")}
            consequence={{
              primary: t("skranke_tab.preset_privat_consequence_primary"),
              ai: t("skranke_tab.preset_privat_consequence_ai"),
            }}
            onSelect={() => setSelectedPreset("privat")}
          />
          <PresetCard
            value="tilpasset"
            selected={selectedPreset === "tilpasset"}
            icon={<Settings className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("skranke_tab.preset_tilpasset_label")}
            lede={t("skranke_tab.preset_tilpasset_summary")}
            warn={t("skranke_tab.preset_tilpasset_warn")}
            onSelect={() => setSelectedPreset("tilpasset")}
          />
        </fieldset>

        {/* Ansvarlig — only for helpdesk presets */}
        {needsRep && (
          <div className="bg-card border-border mb-4 rounded-2xl border p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t("skranke_tab.responsible_label")}</div>
                <div className="text-muted-foreground text-xs">
                  {t("skranke_tab.responsible_sub")}
                </div>
              </div>
              <span className="text-muted-foreground font-mono text-[10px] tracking-[0.1em]">
                {t("skranke_tab.responsible_required")}
              </span>
            </div>

            {/* Compact selected-rep surface; clicking it reveals the combobox picker.
                When unset OR when the user wants to switch, render the combobox instead. */}
            {selectedRepObj && !showRepPicker ? (
              <button
                type="button"
                onClick={() => setShowRepPicker(true)}
                className="bg-muted border-border hover:border-foreground/20 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid="responsible-rep-trigger"
              >
                <LighthouseAvatar
                  name={selectedRepObj.display_name}
                  src={selectedRepObj.avatar_url ?? undefined}
                  size={36}
                  halo="idle"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{selectedRepObj.display_name}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {selectedRepObj.role || t("skranke_tab.rep_role_fallback")} ·{" "}
                    {t("skranke_tab.responsible_active_now")}
                  </div>
                </div>
                <span className="text-muted-foreground text-[13px]">
                  {t("skranke_tab.responsible_change")}
                </span>
                <ChevronDown className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <ResponsibleRepCombobox
                reps={eligibleReps}
                value={selectedRep}
                onChange={(id) => {
                  setSelectedRep(id);
                  setShowRepPicker(false);
                }}
                disabled={isPending}
              />
            )}
          </div>
        )}

        {/* Live consequence preview (private mode only) */}
        {selectedPreset === "privat" && (
          <div className="bg-background border-border mb-5 flex gap-3.5 rounded-2xl border p-4">
            <div
              aria-hidden="true"
              className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
            >
              <Eye className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="mb-1.5 text-[13px] font-semibold">
                {t("skranke_tab.preview_private_title")}
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed">
                {t("skranke_tab.preview_private_body")}
              </div>
            </div>
          </div>
        )}

        {blockedCount !== null && blockedCount > 0 && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {t("toast.skranke_downgrade_blocked", { count: blockedCount })}
          </p>
        )}
      </div>

      {/* Sticky footer (prototype lines 259-273) */}
      <div className="border-border bg-background/60 flex items-center justify-between border-t px-8 py-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {t("skranke_tab.autosave_hint")}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t("skranke_tab.cancel")}
          </Button>
          <Button
            type="button"
            data-testid="skranke-confirm-upgrade"
            variant={isDisable ? "destructive" : "default"}
            onClick={handleSave}
            disabled={saveDisabled}
            className="min-w-32"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {isDisable ? t("skranke_tab.disable_pending") : t("skranke_tab.save_pending")}
              </>
            ) : isDisable ? (
              t("skranke_tab.disable")
            ) : (
              t("skranke_tab.save_full")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Internal preset card ──────────────────────────────────────

type PresetCardProps = {
  value: UiPreset;
  selected: boolean;
  icon: React.ReactNode | null;
  title: string;
  lede: string;
  consequence?: {
    primary: string;
    ai: string;
  };
  warn?: string;
  onSelect: () => void;
};

function PresetCard({
  value,
  selected,
  icon,
  title,
  lede,
  consequence,
  warn,
  onSelect,
}: PresetCardProps) {
  // Map the UI preset enum → canonical ADR-0165 test preset names so E2E
  // selectors stay stable across locale changes.
  const testIdPreset =
    value === "aapen"
      ? "aapen"
      : value === "offentlig"
        ? "public"
        : value === "privat"
          ? "private"
          : "tilpasset";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-preset={value}
      data-testid={`skranke-preset-${testIdPreset}`}
      className={cn(
        "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
          : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-3.5">
        {/* Radio indicator */}
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
          <div className="mb-1 flex items-center gap-2">
            {icon}
            <div className="text-[15px] font-semibold tracking-[-0.005em]">{title}</div>
          </div>
          <div className="text-muted-foreground text-[13px] leading-[1.5]">{lede}</div>

          {/* Active-only consequence strip (prototype lines 164-174) */}
          {consequence && selected && (
            <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] tracking-[0.01em]">
              <div className="mb-0.5">→ {consequence.primary}</div>
              <div>→ {consequence.ai}</div>
            </div>
          )}

          {/* Warn strip for "tilpasset" (prototype lines 175-185) */}
          {warn && selected && (
            <div className="bg-warning/10 border-warning text-warning-foreground mt-2.5 rounded border-l-2 px-2.5 py-2 text-[12px]">
              {warn}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
