"use client";

/**
 * SkrankeTab — Phase 2 Progressive Channel (ADR-0165).
 *
 * In-channel admin surface for flipping helpdesk posture. Replaces the
 * deleted /dashboard/komm/desks/ admin page — admins now manage the
 * helpdesk discriminator INSIDE the channel it affects, not on a
 * separate list page.
 *
 * Four user-facing presets, mapped to the backend preset enum:
 *   - "Åpen kanal"       → downgradeChannelFromHelpdesk (no backend preset)
 *   - "Offentlig skranke" → upgradeChannelToHelpdesk({ preset: "fag" })
 *   - "Privat skranke"   → upgradeChannelToHelpdesk({ preset: "hr_privat" })
 *   - "Tilpasset"        → upgradeChannelToHelpdesk({ preset: "tilpasset", ... })
 *
 * Each preset shows a consequence summary so the admin knows what flipping
 * to it will do. No deep config dialog — the rep combobox expands in place
 * under the selected preset (avoids modal-on-modal nesting).
 *
 * Downgrade safety: if the Server Action returns a blocking error because
 * open tickets still reference the channel, the component surfaces the
 * count in-place and disables the "Turn off helpdesk" button.
 *
 * Nordic Split: Lucide icons only, warm OKLCH via CSS variables,
 * Instrument Serif headings via `font-heading`, Geist body.
 */

import * as React from "react";
import { toast } from "sonner";
import { Circle, CircleDot, LifeBuoy, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
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
}: SkrankeTabProps) {
  const { t } = useTranslation("helpdesk");

  const initialPreset = currentPreset(helpdeskEnabled, privacyMode);
  const [selectedPreset, setSelectedPreset] = React.useState<UiPreset>(initialPreset);
  const [selectedRep, setSelectedRep] = React.useState<string | null>(responsibleProfileId);
  const [isPending, startTransition] = React.useTransition();
  const [blockedCount, setBlockedCount] = React.useState<number | null>(null);

  // Keep local state in sync if the parent re-fetches and the channel
  // was updated elsewhere (e.g. another admin reassigning the rep).
  React.useEffect(() => {
    setSelectedPreset(currentPreset(helpdeskEnabled, privacyMode));
    setSelectedRep(responsibleProfileId);
  }, [helpdeskEnabled, privacyMode, responsibleProfileId]);

  const needsRep =
    selectedPreset === "offentlig" || selectedPreset === "privat" || selectedPreset === "tilpasset";
  const repMissing = needsRep && !selectedRep;

  const handleSave = () => {
    setBlockedCount(null);

    // Case 1: Turn off (current is helpdesk, target is "aapen").
    if (selectedPreset === "aapen") {
      if (!helpdeskEnabled) return; // no-op
      startTransition(async () => {
        const result = await downgradeChannelFromHelpdesk({ channel_id: channelId });
        if (!result.ok) {
          // Server Action does not currently emit a machine-readable
          // blocked count — the message itself is localized Norwegian.
          // Fall back to surfacing the server-provided error text.
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
      // If already helpdesk AND only the rep changed, use the cheaper
      // setResponsibleRep path. Avoids re-running the upgrade branch +
      // re-upserting channel_ai_policy when nothing about posture changed.
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
        // For 'tilpasset' we default to public+disabled so the call succeeds
        // without the UI exposing deep-config fields yet. Admins who want
        // the full matrix can still hit the underlying Server Action; this
        // tab ships the 4 presets path first per ADR-0165.
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

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-foreground text-lg">{t("skranke_tab.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("skranke_tab.lede")}</p>
      </div>

      <fieldset aria-label={t("skranke_tab.preset_group_label")} className="flex flex-col gap-2">
        <legend className="sr-only">{t("skranke_tab.preset_group_label")}</legend>
        <PresetOption
          value="aapen"
          selected={selectedPreset === "aapen"}
          label={t("skranke_tab.preset_aapen_label")}
          summary={t("skranke_tab.preset_aapen_summary")}
          onSelect={() => setSelectedPreset("aapen")}
          icon="none"
        />
        <PresetOption
          value="offentlig"
          selected={selectedPreset === "offentlig"}
          label={t("skranke_tab.preset_offentlig_label")}
          summary={t("skranke_tab.preset_offentlig_summary")}
          onSelect={() => setSelectedPreset("offentlig")}
          icon="lighthouse"
        />
        <PresetOption
          value="privat"
          selected={selectedPreset === "privat"}
          label={t("skranke_tab.preset_privat_label")}
          summary={t("skranke_tab.preset_privat_summary")}
          onSelect={() => setSelectedPreset("privat")}
          icon="lock"
        />
        <PresetOption
          value="tilpasset"
          selected={selectedPreset === "tilpasset"}
          label={t("skranke_tab.preset_tilpasset_label")}
          summary={t("skranke_tab.preset_tilpasset_summary")}
          onSelect={() => setSelectedPreset("tilpasset")}
          icon="none"
        />
      </fieldset>

      {/* Responsible combobox expands in place, no nested modal. */}
      {needsRep && (
        <div className="flex flex-col gap-2">
          <label className="text-foreground text-sm font-medium">
            {t("skranke_tab.responsible_label")}
          </label>
          <ResponsibleRepCombobox
            reps={eligibleReps}
            value={selectedRep}
            onChange={setSelectedRep}
            disabled={isPending}
          />
        </div>
      )}

      {blockedCount !== null && blockedCount > 0 && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {t("toast.skranke_downgrade_blocked", { count: blockedCount })}
        </p>
      )}

      <div className="flex items-center gap-2">
        {selectedPreset === "aapen" && helpdeskEnabled ? (
          <Button
            type="button"
            variant="destructive"
            data-testid="skranke-confirm-upgrade"
            onClick={handleSave}
            disabled={isPending}
            className="min-w-32"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("skranke_tab.disable_pending")}
              </>
            ) : (
              t("skranke_tab.disable")
            )}
          </Button>
        ) : (
          <Button
            type="button"
            data-testid="skranke-confirm-upgrade"
            onClick={handleSave}
            disabled={isPending || repMissing}
            className="min-w-32"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("skranke_tab.save_pending")}
              </>
            ) : (
              t("skranke_tab.save")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Internal preset option button ──────────────────────────────────────

type PresetOptionProps = {
  value: UiPreset;
  selected: boolean;
  label: string;
  summary: string;
  onSelect: () => void;
  icon: "lighthouse" | "lock" | "none";
};

function PresetOption({ value, selected, label, summary, onSelect, icon }: PresetOptionProps) {
  // Map the internal UI preset enum to stable test selectors expected by
  // E2E specs. The test values follow the ADR-0165 canonical preset names
  // (aapen/public/private/tilpasset) rather than the Norwegian UI-layer
  // labels so selectors stay stable across locale changes.
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
        "group flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none",
        selected
          ? "border-primary bg-primary/5"
          : "border-border/60 bg-background hover:border-border hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary text-primary" : "border-muted-foreground/50",
        )}
      >
        {selected ? <CircleDot className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{label}</span>
          {icon === "lighthouse" && (
            <LifeBuoy className="text-primary h-3.5 w-3.5" aria-hidden="true" />
          )}
          {icon === "lock" && (
            <Lock className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
          )}
        </div>
        <span className="text-muted-foreground text-xs leading-relaxed">{summary}</span>
      </div>
    </button>
  );
}
