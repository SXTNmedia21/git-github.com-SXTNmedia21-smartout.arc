"use client";

/**
 * SeasonSidebar — left rail of the year-wheel shell.
 *
 * WHAT: Lists all seasons for the current year, with a filter-pill header
 * (Alle / Aktiv / Utkast / Arkivert) and a draw-hint footer.
 *
 * WHY: Gives users a single list view of every season in the year, with quick
 * filter slicing and gap visibility (missing pieces blocking activation). The
 * canvas owns drawing; this rail owns selection + filtering.
 *
 * Telemetry: Does NOT emit. The parent (year-wheel-page-client) already owns
 * the workspace/profile context required by `emit()`, so it is the cleaner
 * place to emit `"season sidebar_filter_changed"` from its filter-change
 * handler. This component is pure UI — it calls `onFilterChange(next)` and
 * lets the page-client emit.
 */

import type { Season } from "@/app/dashboard/year-wheel/_hooks";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "active" | "draft" | "archived";

/** A Season with an optional gap-count array injected by the page-client. */
type SeasonWithGaps = Season & { missing?: string[] };

type Props = {
  seasons: SeasonWithGaps[];
  selectedId: string | null;
  filter: FilterKey;
  onSelect: (id: string) => void;
  onFilterChange: (filter: FilterKey) => void;
  year: number;
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Alle",
  active: "Aktiv",
  draft: "Utkast",
  archived: "Arkivert",
};

const FILTER_ORDER: FilterKey[] = ["all", "active", "draft", "archived"];

/** Maps season.status to the 3px colored status bar on each list item. */
function statusBarClass(status: Season["status"]): string {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "draft":
      return "bg-amber-500";
    case "archived":
      return "bg-muted-foreground/40";
  }
}

/** yyyy-mm-dd → d.m.yy for the compact mono date label under each name. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)}.${Number(m)}.${y.slice(2)}`;
}

function matchesFilter(season: Season, filter: FilterKey): boolean {
  if (filter === "all") return true;
  return season.status === filter;
}

function countFor(seasons: Season[], filter: FilterKey): number {
  if (filter === "all") return seasons.length;
  return seasons.filter((s) => s.status === filter).length;
}

export function SeasonSidebar({
  seasons,
  selectedId,
  filter,
  onSelect,
  onFilterChange,
  year,
}: Props) {
  const visible = seasons.filter((s) => matchesFilter(s, filter));

  return (
    <aside
      className="border-border bg-card hidden shrink-0 flex-col overflow-y-auto border-r md:flex md:w-[260px] lg:w-[220px] xl:w-[260px]"
      aria-label={`Sesonger ${year}`}
    >
      {/* Header */}
      <div className="border-border border-b px-5 pt-5 pb-4">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-[2px] uppercase">
          Sesonger {year}
        </div>

        {/* Filter pills */}
        <div role="tablist" aria-label="Filtrer sesonger" className="mt-3 flex flex-wrap gap-1">
          {FILTER_ORDER.map((key) => {
            const active = key === filter;
            const count = countFor(seasons, key);
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onFilterChange(key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{FILTER_LABELS[key]}</span>
                <span
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    active ? "opacity-70" : "opacity-60",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Season list */}
      <nav className="flex-1 p-2" aria-label="Sesongliste">
        {visible.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-xs">
            Ingen sesonger i dette filteret.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((season) => {
              const selected = season.season_id === selectedId;
              const gapCount = season.missing?.length ?? 0;
              const isActive = season.status === "active";
              return (
                <li key={season.season_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(season.season_id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-lg py-2 pr-2.5 pl-3 text-left transition-colors",
                      selected
                        ? "bg-sidebar-accent border-border border"
                        : "hover:bg-muted border border-transparent",
                    )}
                  >
                    {/* 3px colored status bar */}
                    <span
                      className={cn(
                        "absolute top-2 bottom-2 left-0 w-[3px] rounded-full",
                        statusBarClass(season.status),
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground truncate text-sm font-medium">
                          {season.name}
                        </span>
                        {isActive ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                            aria-label="Aktiv sesong"
                          />
                        ) : null}
                      </div>
                      <div className="text-muted-foreground mt-0.5 font-mono text-[11px] tabular-nums">
                        {formatDate(season.start_date)}
                        <span className="mx-1 opacity-60">→</span>
                        {formatDate(season.end_date)}
                      </div>
                    </div>
                    {gapCount > 0 ? (
                      <span
                        className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-amber-500/15 px-1.5 font-mono text-[10px] font-semibold text-amber-700 tabular-nums dark:text-amber-400"
                        aria-label={`${gapCount} mangler`}
                        title={`${gapCount} mangler før aktivering`}
                      >
                        {gapCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer tip */}
      <div className="border-border border-t px-5 py-4">
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Tegn nye sesonger <span className="opacity-70">— klikk og dra i lerretet</span>
        </p>
      </div>
    </aside>
  );
}
