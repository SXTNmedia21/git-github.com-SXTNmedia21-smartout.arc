"use client";

/**
 * AnnouncementTierPicker — 3-value tier selector displayed as visual chips.
 *
 * Shows tier name + notification channel preview per chip.
 * Controlled: value + onChange. Emits announcement.tier_overridden when the
 * user manually picks a tier that differs from the kind's auto-default.
 *
 * i18n keys: komm.nyheter.tier.*
 */

import { emit, nonEmpty } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { cn } from "@/lib/utils";
import type { AnnouncementKind, AnnouncementTier } from "./AnnouncementKindPicker";
import { DEFAULT_TIER_FOR_KIND } from "./AnnouncementKindPicker";

const TIERS: AnnouncementTier[] = ["social", "work", "external"];

// Notification channel preview per tier (matches publish_announcement_atomic routing)
const TIER_CHANNELS: Record<AnnouncementTier, string> = {
  social: "push + in_app",
  work: "push + in_app",
  external: "push + in_app + e-post",
};

type AnnouncementTierPickerProps = {
  value: AnnouncementTier;
  kind: AnnouncementKind;
  onChange: (next: AnnouncementTier) => void;
  profileId: string;
};

export function AnnouncementTierPicker({
  value,
  kind,
  onChange,
  profileId,
}: AnnouncementTierPickerProps) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();
  const defaultTier = DEFAULT_TIER_FOR_KIND[kind];

  function handleSelect(next: AnnouncementTier) {
    if (next === value) return;

    // Emit only when user overrides the kind-default — not on auto-updates
    if (next !== defaultTier) {
      void emit({
        event: "announcement.tier_overridden",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          kind,
          default_tier: defaultTier,
          chosen_tier: next,
        },
      });
    }

    onChange(next);
  }

  return (
    <div className="flex gap-2" role="group" aria-label={t("nyheter.tier.label")}>
      {TIERS.map((tier) => {
        const isActive = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => handleSelect(tier)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-md border px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
            aria-pressed={isActive}
          >
            <span className="font-medium">{t(`nyheter.tier.${tier}`)}</span>
            <span className="text-muted-foreground text-xs">{TIER_CHANNELS[tier]}</span>
          </button>
        );
      })}
    </div>
  );
}
