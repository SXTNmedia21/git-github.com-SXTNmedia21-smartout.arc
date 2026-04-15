/**
 * PhaseStrip — 56pt horizontal compact variant of the shift timeline.
 *
 * Used as the header inside `ShiftCard`. Renders the four phase anchors
 * horizontally with a single drifting orb underneath. Long-press on a phase
 * reveals the explainer (handled via `onLongPressPhase` callback so the host
 * can render the tooltip — the strip itself stays tiny).
 *
 * No cost metrics; no deviation badge here — the strip is a pure navigator.
 * The full phase detail lives inside the expanded ShiftTimeline or the shift
 * detail route.
 */

import React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { createStyles, useTheme } from "@/theme";
import { useTranslation } from "@smartout/i18n";

import { PhaseOrb } from "./PhaseOrb";
import { PHASE_ORDER, deriveStageState, type ShiftLifecyclePhase } from "./types";

export const PHASE_STRIP_HEIGHT = 56;

export type PhaseStripProps = {
  activePhase: ShiftLifecyclePhase;
  /** Freeze orb + desaturate when offline. */
  frozen?: boolean;
  /** Long-press reveals phase explainer tooltip via host. */
  onLongPressPhase?: (phase: ShiftLifecyclePhase) => void;
};

export function PhaseStrip({ activePhase, frozen = false, onLongPressPhase }: PhaseStripProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation("shift");

  // Strip is horizontal — the PhaseOrb needs a horizontal track.
  // We estimate track width via layout; use a fixed pct-based position inside
  // a relative container so the orb follows the flex layout of the row.
  return (
    <View
      style={styles.strip}
      accessibilityRole="tablist"
      accessibilityLabel={t("timeline.aria.step_list")}
    >
      {!frozen ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.orbTrack}>
            <PhaseOrb
              activePhase={activePhase}
              trackHeight={STRIP_INTERNAL_TRACK}
              orientation="horizontal"
              size={80}
              intensity={0.7}
            />
          </View>
        </View>
      ) : null}

      {PHASE_ORDER.map((phase) => {
        const state = deriveStageState(phase, activePhase);
        const isActive = state === "active";
        const color = frozen
          ? theme.colors.mutedForeground
          : state === "upcoming"
            ? theme.colors.mutedForeground
            : theme.colors.foreground;
        return (
          <Pressable
            key={phase}
            onLongPress={onLongPressPhase ? () => onLongPressPhase(phase) : undefined}
            delayLongPress={400}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(`timeline.phase.${phase}`)}
            style={styles.cell}
          >
            <Text
              style={[
                styles.label,
                { color, fontWeight: isActive ? "600" : "400" },
                frozen && styles.frozenLabel,
              ]}
              numberOfLines={1}
            >
              {t(`timeline.phase.${phase}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Virtual track width used by the orb calculation inside the strip. */
const STRIP_INTERNAL_TRACK = 320;

const useStyles = createStyles((theme) => ({
  strip: {
    height: PHASE_STRIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.tight,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  orbTrack: {
    width: STRIP_INTERNAL_TRACK,
    height: PHASE_STRIP_HEIGHT,
    alignSelf: "center",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  frozenLabel: {
    opacity: 0.65,
  },
}));
