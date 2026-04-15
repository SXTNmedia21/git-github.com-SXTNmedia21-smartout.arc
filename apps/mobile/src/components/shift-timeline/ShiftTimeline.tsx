/**
 * ShiftTimeline — Employee-facing vertical shift lifecycle (mobile).
 *
 * Always renders all four phases (planlegges → pagar → oppgjor → avsluttet)
 * so the employee sees the full arc. Stage state is derived from the `phase`
 * field on `v_shift_lifecycle` via `deriveStageState`.
 *
 * Costs are never rendered on this surface — the view's RLS already filters
 * them out, and the UI adds a defensive omission (we only display hours).
 *
 * Deviation clicks delegate to the host via `onOpenBotsson` so the mobile
 * host can run the ADR-0078 voice interlock and call
 * `BotssonProvider.openWithIntent`.
 */

import React, { useMemo, useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { createStyles, useTheme, type Theme } from "@/theme";
import { useTranslation } from "@smartout/i18n";

import { PhaseOrb } from "./PhaseOrb";
import { PhaseExplainer } from "./PhaseExplainer";
import {
  PHASE_ORDER,
  deriveStageState,
  type ShiftLifecyclePhase,
  type ShiftLifecycleRow,
  type StageState,
  type TimelineBotssonIntent,
} from "./types";

export type ShiftTimelineProps = {
  /** Shift lifecycle row from `v_shift_lifecycle`. */
  lifecycle: ShiftLifecycleRow;
  /** Called when employee taps the deviation badge on the active phase. */
  onOpenBotsson?: (intent: TimelineBotssonIntent) => void;
  /** Called when employee long-presses a phase (400ms) to reveal explainer. */
  onLongPressPhase?: (phase: ShiftLifecyclePhase) => void;
  /** When true, the orb and transitions are frozen. Set by the host on offline. */
  frozen?: boolean;
};

/** Format hours as Norwegian-style `7,25` — matches the web component. */
function formatHours(hours: number | null | undefined): string | undefined {
  if (hours === null || hours === undefined) return undefined;
  return hours.toFixed(2).replace(".", ",").replace(/,00$/, "");
}

/** Vertical distance each phase row occupies in the full timeline. */
const ROW_HEIGHT = 84;

export function ShiftTimeline({
  lifecycle,
  onOpenBotsson,
  onLongPressPhase,
  frozen = false,
}: ShiftTimelineProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation("shift");
  const [explainerFor, setExplainerFor] = useState<ShiftLifecyclePhase | null>(null);
  const handleLongPress = (phase: ShiftLifecyclePhase) => {
    setExplainerFor(phase);
    onLongPressPhase?.(phase);
  };

  const activePhase: ShiftLifecyclePhase = lifecycle.phase;
  const trackHeight = PHASE_ORDER.length * ROW_HEIGHT;

  const metrics = useMemo(() => {
    const scheduled = formatHours(lifecycle.scheduled_hours);
    const interpreted = formatHours(lifecycle.interpreted_hours);
    const approved = formatHours(lifecycle.approved_hours);
    return { scheduled, interpreted, approved };
  }, [lifecycle.scheduled_hours, lifecycle.interpreted_hours, lifecycle.approved_hours]);

  const metricFor = (phase: ShiftLifecyclePhase): string | undefined => {
    switch (phase) {
      case "planlegges":
        return metrics.scheduled
          ? t("timeline.metric.planned_hours", { hours: metrics.scheduled })
          : undefined;
      case "pagar":
        if (lifecycle.last_punch_in && !lifecycle.last_punch_out) {
          return t("timeline.metric.in_progress", { hours: metrics.scheduled ?? "–" });
        }
        return t("timeline.metric.not_started");
      case "oppgjor":
        return metrics.interpreted
          ? t("timeline.metric.interpreted_hours", { hours: metrics.interpreted })
          : undefined;
      case "avsluttet":
        return metrics.approved
          ? t("timeline.metric.approved_hours", { hours: metrics.approved })
          : undefined;
    }
  };

  return (
    <View style={styles.container} accessibilityLabel={t("timeline.aria.step_list")}>
      <Text style={styles.heading}>{t("timeline.heading")}</Text>

      <View style={[styles.track, { height: trackHeight }]}>
        {!frozen && (
          <PhaseOrb activePhase={activePhase} trackHeight={trackHeight} orientation="vertical" />
        )}

        {PHASE_ORDER.map((phase) => {
          const state = deriveStageState(phase, activePhase);
          const isActive = state === "active";
          const showDeviation = isActive && lifecycle.has_deviation;
          const showBlocking = isActive && lifecycle.has_blocking_deviation;
          const metric = metricFor(phase);

          return (
            <Pressable
              key={phase}
              onLongPress={() => handleLongPress(phase)}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t(`timeline.phase.${phase}`)}
              style={[styles.row, { height: ROW_HEIGHT }]}
            >
              <StageBadgeView state={state} frozen={frozen} />
              <View style={styles.rowText}>
                <Text style={stageLabelStyle(state, theme, frozen)}>
                  {t(`timeline.phase.${phase}`)}
                </Text>
                {metric ? <Text style={styles.metric}>{metric}</Text> : null}
              </View>

              {(showDeviation || showBlocking) && onOpenBotsson ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    showBlocking ? "timeline.badge.blocking" : "timeline.badge.deviation",
                  )}
                  disabled={frozen}
                  onPress={() =>
                    onOpenBotsson({
                      kind: "deviation",
                      shift_id: lifecycle.shift_id,
                      phase,
                    })
                  }
                  style={[
                    styles.deviationBadge,
                    showBlocking
                      ? { backgroundColor: theme.colors.destructive }
                      : { backgroundColor: theme.colors.warning },
                    frozen && styles.disabled,
                  ]}
                >
                  <Text style={styles.deviationBadgeText}>
                    {t(showBlocking ? "timeline.badge.blocking" : "timeline.badge.deviation")}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {explainerFor ? (
          <PhaseExplainer phase={explainerFor} onDismiss={() => setExplainerFor(null)} />
        ) : null}
      </View>
    </View>
  );
}

/** Small round indicator per row — completed / active / upcoming. */
function StageBadgeView({ state, frozen }: { state: StageState; frozen: boolean }) {
  const styles = useBadgeStyles();
  const theme = useTheme();
  const color = frozen
    ? theme.colors.mutedForeground
    : state === "completed"
      ? theme.colors.success
      : state === "active"
        ? theme.colors.foreground
        : theme.colors.border;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function stageLabelStyle(state: StageState, theme: Theme, frozen: boolean) {
  const base = {
    fontSize: 16,
    fontWeight: state === "active" ? ("600" as const) : ("400" as const),
    color: frozen
      ? theme.colors.mutedForeground
      : state === "upcoming"
        ? theme.colors.mutedForeground
        : theme.colors.foreground,
  };
  return base;
}

const useStyles = createStyles((theme) => ({
  container: {
    padding: theme.spacing.card,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.foreground,
    marginBottom: theme.spacing.element,
  },
  track: {
    position: "relative",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.tight,
  },
  rowText: {
    flex: 1,
    marginLeft: theme.spacing.element,
  },
  metric: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  deviationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
  },
  deviationBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.45,
  },
}));

const useBadgeStyles = createStyles(() => ({
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
}));
