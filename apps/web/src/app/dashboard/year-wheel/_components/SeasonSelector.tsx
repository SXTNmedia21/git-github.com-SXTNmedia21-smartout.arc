// ============================================
// SeasonSelector.tsx
// Dropdown to select the active season, with a status badge.
// Reads all seasons for the workspace and lets the user pick one.
// Connected to: page.tsx (rendered in the year-wheel toolbar)
// ============================================

"use client";

import { useTranslation } from "@smartout/i18n";
import { useSeasons } from "../_hooks";

type Props = {
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
};

export function SeasonSelector({ selectedSeasonId, onSelect }: Props) {
  const { t } = useTranslation("dashboard");
  const { seasons, isLoading } = useSeasons();

  if (isLoading) {
    return <div className="bg-muted h-10 w-64 animate-pulse rounded-xl" />;
  }

  if (seasons.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("yearWheel.no_seasons_yet")}</p>;
  }

  // Status badge: maps season status to semantic CSS variable classes
  const statusColors: Record<string, string> = {
    draft: "text-warning bg-warning/10 border-warning/20",
    active: "text-success bg-success/10 border-success/20",
    archived: "text-muted-foreground bg-muted border-border",
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedSeasonId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="border-input bg-background text-foreground focus:border-primary rounded-xl border px-4 py-2 text-sm font-medium transition-colors outline-none"
      >
        <option value="" disabled>
          {t("yearWheel.select_season")}
        </option>
        {seasons.map((s) => (
          <option key={s.season_id} value={s.season_id}>
            {s.name} ({s.status})
          </option>
        ))}
      </select>

      {selectedSeasonId &&
        (() => {
          const selected = seasons.find((s) => s.season_id === selectedSeasonId);
          if (!selected) return null;
          return (
            <span
              className={`rounded border px-2 py-0.5 text-xs font-bold ${statusColors[selected.status] ?? statusColors.draft}`}
            >
              {selected.status === "active"
                ? t("yearWheel.active")
                : selected.status === "draft"
                  ? t("yearWheel.draft")
                  : t("yearWheel.archived")}
            </span>
          );
        })()}
    </div>
  );
}
