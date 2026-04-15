// apps/web/src/components/shift-timeline/AdminShiftTimeline.tsx
"use client";

/**
 * AdminShiftTimeline — admin/manager composition of the timeline.
 *
 * Same phase arc as EmployeeShiftTimeline but richer per-stage detail
 * (punch status, approval status, reconciliation status, deviation
 * badges). Cost fields are allowed on this surface — RLS on the view
 * restricts who can see them, and admins that can't read cost simply
 * get nulls.
 *
 * Vertical only — horizontal dense grid is explicitly out-of-scope per
 * plan §9 "Non-goals".
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

export type AdminShiftTimelineProps = {
  shiftId: string;
  onOpenBotsson?: (ctx: {
    shiftId: string;
    phase: ShiftPhase;
    capability?: string;
    reason: "deviation" | "help";
  }) => void;
  onOpenDeviation?: (ctx: { shiftId: string; phase: ShiftPhase }) => void;
  className?: string;
  initialData?: ShiftLifecycleRow;
};

function deriveState(forPhase: ShiftPhase, active: ShiftPhase): StageState {
  const forIdx = PHASE_ORDER.indexOf(forPhase);
  const activeIdx = PHASE_ORDER.indexOf(active);
  if (forIdx < activeIdx) return "completed";
  if (forIdx === activeIdx) return "active";
  return "upcoming";
}

function formatHours(h: number | null | undefined): string | undefined {
  if (h === null || h === undefined) return undefined;
  return h.toFixed(2).replace(".", ",").replace(/,00$/, "");
}

export function AdminShiftTimeline({
  shiftId,
  onOpenBotsson,
  onOpenDeviation,
  className,
  initialData,
}: AdminShiftTimelineProps) {
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

  // `row` is the narrowed, non-null data. TypeScript can't carry the
  // narrowing across closure boundaries, so we freeze it here.
  const row: ShiftLifecycleRow = data;
  const activePhase = row.phase;

  // Build the badges stack for a given phase — admin surface is dense,
  // so we show multiple badges when applicable.
  function badgesFor(phase: ShiftPhase): React.ReactNode {
    if (phase !== activePhase) return undefined;
    const badges: React.ReactNode[] = [];
    if (row.has_blocking_deviation) {
      badges.push(
        <StageBadge key="blocking" variant="blocking" label={t("timeline.badge.blocking")} />,
      );
    } else if (row.has_deviation) {
      badges.push(
        <StageBadge key="deviation" variant="deviation" label={t("timeline.badge.deviation")} />,
      );
    }
    if (phase === "pagar" && row.last_punch_in && !row.last_punch_out) {
      badges.push(
        <StageBadge key="in" variant="punched-in" label={t("timeline.badge.punched_in")} />,
      );
    }
    if (phase === "oppgjor" && row.last_punch_out) {
      badges.push(
        <StageBadge key="out" variant="punched-out" label={t("timeline.badge.punched_out")} />,
      );
    }
    if (phase === "oppgjor" && row.approval_status && row.approval_status !== "approved") {
      badges.push(
        <StageBadge
          key="pending"
          variant="pending-approval"
          label={t("timeline.badge.pending_approval")}
        />,
      );
    }
    if (phase === "avsluttet" && row.reconciliation_status === "locked") {
      badges.push(<StageBadge key="locked" variant="locked" label={t("timeline.badge.locked")} />);
    }
    return badges.length > 0 ? <div className="flex flex-wrap gap-1">{badges}</div> : undefined;
  }

  function metricFor(phase: ShiftPhase): string | undefined {
    const scheduled = formatHours(row.scheduled_hours);
    const interpreted = formatHours(row.interpreted_hours);
    const approved = formatHours(row.approved_hours);
    switch (phase) {
      case "planlegges":
        return scheduled ? t("timeline.metric.planned_hours", { hours: scheduled }) : undefined;
      case "pagar":
        return row.last_punch_in && !row.last_punch_out
          ? t("timeline.metric.in_progress", { hours: scheduled ?? "–" })
          : t("timeline.metric.not_started");
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
      <h2 className="font-heading mb-4 text-2xl">{t("timeline.heading_admin")}</h2>

      <div className="sr-only" aria-live="polite">
        {t(`timeline.phase.${activePhase}` as const)}
      </div>

      <div className="relative" role="list" aria-label={t("timeline.aria.step_list")}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ActiveOrb anchorPhase={activePhase} size="sm" />
        </div>

        <ol className="relative z-10 flex flex-col">
          {PHASE_ORDER.map((phase, idx) => {
            const state = deriveState(phase, activePhase);
            const isActive = phase === activePhase;
            const deviationActionable =
              isActive && (row.has_deviation || row.has_blocking_deviation);
            return (
              <li key={phase} role="listitem">
                <LifecycleStage
                  phase={phase}
                  state={state}
                  label={t(`timeline.phase.${phase}` as const)}
                  metric={metricFor(phase)}
                  ariaCurrent={state === "active" ? "step" : false}
                  hasDeviation={isActive && row.has_deviation}
                  hasBlockingDeviation={isActive && row.has_blocking_deviation}
                  onClick={
                    deviationActionable
                      ? () =>
                          onOpenDeviation
                            ? onOpenDeviation({ shiftId, phase })
                            : onOpenBotsson?.({
                                shiftId,
                                phase,
                                capability: "shift_lifecycle",
                                reason: "deviation",
                              })
                      : undefined
                  }
                  detail={badgesFor(phase)}
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
