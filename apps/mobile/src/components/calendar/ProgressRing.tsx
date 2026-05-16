/**
 * ProgressRing — SVG circular progress ring.
 *
 * 56px default. Tracks task completion percentage; renders orange fill for
 * normal progress, error-red fill when hasError=true (avvik > 0). The inner
 * label shows the percentage in Geist Mono.
 *
 * Uses react-native-svg directly — no Reanimated needed for this atom (the
 * handoff keeps it static; animated filling is Phase 3c territory if needed).
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme";

type ProgressRingProps = {
  /** Number of items total. */
  total: number;
  /** Number of completed items. */
  completed: number;
  /** When true, ring color switches to error-red. */
  hasError?: boolean;
  /** Diameter in points. Default 56. */
  size?: number;
};

export function ProgressRing({ total, completed, hasError = false, size = 56 }: ProgressRingProps) {
  const theme = useTheme();

  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const ringColor = hasError ? theme.colors.destructive : theme.colors.brandOrange;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fill */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          // Rotate so progress starts from 12 o'clock.
          // Use SVG transform attr (not rotation/origin props) to avoid
          // react-native-svg web-shim emitting kebab `transform-origin`
          // which React 19 rejects on the DOM circle element.
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, styles.labelContainer]}>
        <Text style={[styles.label, { color: ringColor }]}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    position: "relative",
  },
  labelContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "GeistMono-Regular",
  },
});
