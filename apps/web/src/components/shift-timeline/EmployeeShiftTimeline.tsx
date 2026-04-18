// apps/web/src/components/shift-timeline/EmployeeShiftTimeline.tsx
"use client";

/**
 * EmployeeShiftTimeline — employee-facing composition of the shift timeline.
 *
 * Always renders the four phases (planlegges → pagar → oppgjor → avsluttet)
 * so the employee sees the whole arc. State per stage is derived from the
 * current `phase` on v_shift_lifecycle:
 *
 *   stages BEFORE current  → completed
 *   stage EQUAL current    → active
 *   stages AFTER current   → upcoming
 *
 * No cost fields — enforced both by RLS on the view and a defensive UI
 * filter (we simply never render gross_cost on this surface).
 *
 * Deviation clicks bubble up via `onOpenBotsson` so the container decides
 * where Botsson lives (right-side panel on web, route push on mobile).
 */

import * as React from "react";
import {
  LifecycleStage,
  StageConnector,
  ActiveOrb,
  StageBadge,
  type ShiftPhase,
  type StageState,
} from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { useShiftLifecycle, type ShiftLifecycleRow } from "@smartout/schedule";

const PHASE_ORDER: ShiftPhase[] = ["planlegges", "pagar", "oppgjor", "avsluttet"];

export type EmployeeShiftTimelineProps = {
  shiftId: string;
  onOpenBotsson?: (ctx: {
    shiftId: string;
    phase: ShiftPhase;
    reason: "deviation" | "help";
  }) => void;
  className?: string;
  /** Test hook — injects a fixed row so the component can render without Supabase. */
  initialData?: ShiftLifecycleRow;
};

/** Derive the visual state for a given phase relative to the active one. */
function deriveState(forPhase: ShiftPhase, active: ShiftPhase): StageState {
  const forIdx = PHASE_ORDER.indexOf(forPhase);
  const activeIdx = PHASE_ORDER.indexOf(active);
  if (forIdx < activeIdx) return "completed";
  if (forIdx === activeIdx) return "active";
  return "upcoming";
}

/** Format a number of hours in Norwegian-style `7,25` (comma decimal). */
function formatHours(hours: number | null | undefined): string | undefined {
  if (hours === null || hours === undefined) return undefined;
  return hours.toFixed(2).replace(".", ",").replace(/,00$/, "");
}

export function EmployeeShiftTimeline({
  shiftId,
  onOpenBotsson,
  className,
  initialData,
}: EmployeeShiftTimelineProps) {
  const { t } = useTranslation("shift");
  const { data, isLoading, isError } = useShiftLifecycle(shiftId, { initialData });

  if (isLoading) {
    return (
      <div className={className} role="status" aria-live="polite">
        <p className="text-muted-foreground text-sm">{t("timeline.fallback.loading")}</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={className} role="alert">
        <p className="text-destructive text-sm">{t("timeline.fallback.error")}</p>
      </div>
    );
  }

  const activePhase = data.phase;

  // Metric per stage — employee view, no cost.
  function metricFor(phase: ShiftPhase): string | undefined {
    const scheduled = formatHours(data?.scheduled_hours);
    const interpreted = formatHours(data?.interpreted_hours);
    const approved = formatHours(data?.approved_hours);

    switch (phase) {
      case "planlegges":
        return scheduled ? t("timeline.metric.planned_hours", { hours: scheduled }) : undefined;
      case "pagar":
        if (data?.last_punch_in && !data.last_punch_out) {
          return t("timeline.metric.in_progress", { hours: scheduled ?? "–" });
        }
        return t("timeline.metric.not_started");
      case "oppgjor":
        return interpreted
          ? t("timeline.metric.interpreted_hours", { hours: interpreted })
          : undefined;
      case "avsluttet":
        return approved ? t("timeline.metric.approved_hours", { hours: approved }) : undefined;
    }
  }

  return (
    <div className={className}>
      <h2 className="font-heading mb-4 text-2xl">{t("timeline.heading")}</h2>

      {/* Screen-reader announcement of the current phase. */}
      <div className="sr-only" aria-live="polite">
        {t(`timeline.phase.${activePhase}` as const)}
      </div>

      <div className="relative" role="list" aria-label={t("timeline.aria.step_list")}>
        {/* Warm focal glow behind the active stage. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ActiveOrb anchorPhase={activePhase} size="sm" />
        </div>

        <ol className="relative z-10 flex flex-col">
          {PHASE_ORDER.map((phase, idx) => {
            const state = deriveState(phase, activePhase);
            const isOnActive = phase === activePhase;
            const showDeviation = isOnActive && data.has_deviation;
            const showBlocking = isOnActive && data.has_blocking_deviation;
            return (
              <li key={phase} role="listitem">
                <LifecycleStage
                  phase={phase}
                  state={state}
                  label={t(`timeline.phase.${phase}` as const)}
                  metric={metricFor(phase)}
                  ariaCurrent={state === "active" ? "step" : false}
                  hasDeviation={showDeviation}
                  hasBlockingDeviation={showBlocking}
                  onClick={
                    showDeviation || showBlocking
                      ? () =>
                          onOpenBotsson?.({
                            shiftId,
                            phase,
                            reason: "deviation",
                          })
                      : undefined
                  }
                  detail={
                    showBlocking ? (
                      <StageBadge variant="blocking" label={t("timeline.badge.blocking")} />
                    ) : showDeviation ? (
                      <StageBadge variant="deviation" label={t("timeline.badge.deviation")} />
                    ) : undefined
                  }
                />
                {idx < PHASE_ORDER.length - 1 && (
                  <StageConnector
                    fromState={state}
                    toState={deriveState(PHASE_ORDER[idx + 1]!, activePhase)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
