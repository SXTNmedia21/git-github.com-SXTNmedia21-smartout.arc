"use client";

/**
 * CompanionRail — right-side 280px rail with three stacked cards.
 *
 * WHY: Spec §3.5. Gives the planner at-a-glance answers to
 *  1. What season am I in right now?
 *  2. What's coming up next?
 *  3. Which draft seasons are still blocked from activation?
 *
 * Hidden below 1280px so the canvas stays the center of attention
 * on laptop widths.
 */

import { TriangleAlert } from "lucide-react";

import type { Season } from "@/app/dashboard/year-wheel/_hooks";
import type { PlanningEventRow } from "@smartout/year-wheel/hooks";

// The spec asks for `PlanningEvent` as the prop type. The canonical row type
// from the year-wheel package is `PlanningEventRow`; we alias it locally so
// callers (and readers) see the spec vocabulary.
export type PlanningEvent = PlanningEventRow;

type Props = {
  seasons: Season[];
  events: PlanningEvent[];
  year: number;
};

// Section-header pattern shared across the three cards (§3.5).
const SECTION_HEADER = "text-[10px] font-semibold uppercase tracking-[2px] text-muted-foreground";

// Base card styling per §3.5: surface card + subtle border + radius-14.
const CARD_BASE = "bg-card border border-border rounded-[14px] p-4";

// Norwegian short-date formatter (e.g. "15. mar").
function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function formatDateRange(start: string | null, end: string | null): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/**
 * Maps planning_event.category to the visual dot color.
 * Per §3.5 + LegendChip rules:
 *  - internal            → muted-foreground
 *  - cultural_commercial → --brand-orange
 *  - business_critical   → destructive (spec vocabulary; not currently in the
 *                          PlanningEventCategory union but may arrive later —
 *                          handled defensively so adding it to the enum
 *                          doesn't require a UI change here)
 *  - anything else       → muted-foreground fallback
 */
function categoryDotColor(category: PlanningEvent["category"] | string): string {
  switch (category) {
    case "cultural_commercial":
      return "var(--brand-orange)";
    case "business_critical":
      return "var(--destructive)";
    case "internal":
    default:
      return "var(--muted-foreground)";
  }
}

type MiniStatProps = {
  label: string;
  value: string;
  percent: number; // 0..100, clamped at render time
};

/**
 * Single progress row used inside the "Aktiv nå" card.
 * Label left, formatted value right, thin bar below.
 */
function MiniStat({ label, value, percent }: MiniStatProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-foreground font-mono text-xs">{value}</span>
      </div>
      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
        <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function CompanionRail({ seasons, events, year: _year }: Props) {
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;

  // Today as YYYY-MM-DD in UTC so we compare apples-to-apples with the
  // `event_date` column (DATE in Postgres, serialized as YYYY-MM-DD).
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = [...events]
    .filter((e) => e.event_date >= todayIso)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 4);

  // TODO(2026-04-20): filter drafts with missing budget once a "missing"
  // derivation is available on Season (spec references `season.missing` but
  // the Season type has no such field yet — see plan Task 2.3 step 1).
  const draftsWithGaps = seasons.filter((s) => s.status === "draft");

  return (
    <aside className="border-border bg-card hidden shrink-0 flex-col gap-3.5 overflow-y-auto border-l p-4 xl:flex xl:w-[280px]">
      {activeSeason && (
        <section className={CARD_BASE} aria-labelledby="companion-active-heading">
          <div
            id="companion-active-heading"
            className={`${SECTION_HEADER} mb-2 flex items-center gap-1.5`}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--success)" }}
            />
            Aktiv nå
          </div>
          <h3 className="font-heading text-[22px] leading-tight font-normal">
            {activeSeason.name}
          </h3>
          <div className="text-muted-foreground mt-1 mb-3.5 font-mono text-xs">
            {formatDateRange(activeSeason.start_date, activeSeason.end_date)}
          </div>
          <div className="flex flex-col gap-3">
            {/*
              Revenue-actual is not yet plumbed from daily_reconciliation. Per
              spec §3.5: render "—" and a 0%-filled bar; do NOT block the rail
              on reconciliation work.
            */}
            <MiniStat label="Omsetning" value="—" percent={0} />
            {/*
              Labor-mål static placeholder until labor-actual lands. A flat
              target reading keeps the surface visually populated without
              fabricating a number we don't have.
            */}
            <MiniStat label="Labor-mål" value="30 %" percent={30} />
          </div>
        </section>
      )}

      <section className={CARD_BASE} aria-labelledby="companion-events-heading">
        <div id="companion-events-heading" className={`${SECTION_HEADER} mb-3`}>
          Neste hendelser
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="text-muted-foreground text-xs">Ingen kommende hendelser.</div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {upcomingEvents.map((event) => {
              // AI-suggested events get a dashed 2px outline dot instead of a
              // filled dot, per §3.5. Source="ai_generated" isn't in the
              // current PlanningEventSource union but we handle it
              // defensively so the UI is forward-compatible.
              const isAiSuggested = (event.source as string) === "ai_generated";
              const dotColor = categoryDotColor(event.category);
              return (
                <li key={event.planning_event_id} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={
                      isAiSuggested
                        ? {
                            background: "transparent",
                            border: `2px dashed ${dotColor}`,
                          }
                        : { background: dotColor }
                    }
                  />
                  <span className="text-foreground flex-1 truncate text-xs">{event.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {formatShortDate(event.event_date)}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    ×{event.demand_multiplier}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {draftsWithGaps.length > 0 && (
        <section
          className="rounded-[14px] border p-4"
          style={{
            background: "color-mix(in oklab, var(--warning) 5%, var(--card))",
            borderColor: "color-mix(in oklab, var(--warning) 20%, var(--border))",
          }}
          aria-labelledby="companion-gaps-heading"
        >
          <div
            id="companion-gaps-heading"
            className={`${SECTION_HEADER} mb-3 flex items-center gap-1.5`}
          >
            <TriangleAlert
              className="h-3 w-3"
              style={{ color: "var(--warning)" }}
              aria-hidden="true"
            />
            Gaps før aktivering
          </div>
          <ul className="flex flex-col gap-2.5">
            {draftsWithGaps.map((season) => {
              // season.missing is not derived yet — see TODO above. When the
              // derivation lands, render `missing.join(' · ')` in the muted
              // row below instead of the generic placeholder.
              const missing: string[] = [];
              return (
                <li key={season.season_id} className="flex flex-col gap-0.5">
                  <span className="text-foreground text-xs font-semibold">{season.name}</span>
                  {missing.length > 0 && (
                    <span className="text-muted-foreground text-[11px]">{missing.join(" · ")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
