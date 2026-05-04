import * as React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";

import { nativeTheme } from "@smartout/design-tokens/native";
import type { DayKpi } from "./types";
import { SOURCE_SUFFIX, deltaGlyph, deltaTone } from "./kpi-tile-shared";

/**
 * KpiTile (React Native) — mirrors the web `.tsx` contract using RN
 * primitives and `nativeTheme` hex values.
 *
 * ADR-0158 dual-platform: paired with `KpiTile.tsx`. Shared source suffix /
 * delta glyph / delta tone mapping lives in `kpi-tile-shared.ts`.
 */
export function KpiTile({
  tile,
  variant = "default",
}: {
  tile: DayKpi;
  variant?: "default" | "compact";
}) {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? nativeTheme.dark : nativeTheme.light;

  const tone = deltaTone(tile.deltaDir);
  const deltaColor =
    tone === "success"
      ? palette.success
      : tone === "warning"
        ? palette.warning
        : palette.mutedForeground;

  const padding = variant === "compact" ? 14 : 18;
  const numberSize = variant === "compact" ? 22 : 30;
  const sourceHint = tile.source ? SOURCE_SUFFIX[tile.source] : "";

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          padding,
        },
      ]}
    >
      <Text style={[styles.label, { color: palette.mutedForeground }]}>
        {tile.label.toUpperCase()}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: palette.foreground, fontSize: numberSize }]}>
          {tile.value}
        </Text>
        <Text style={[styles.unit, { color: palette.mutedForeground }]}>{tile.unit}</Text>
      </View>
      {tile.sub || tile.delta ? (
        <View style={styles.subRow}>
          {tile.delta ? (
            <Text style={[styles.delta, { color: deltaColor }]}>
              {deltaGlyph(tile.deltaDir)} {tile.delta}
            </Text>
          ) : null}
          <Text style={[styles.sub, { color: palette.mutedForeground }]} numberOfLines={1}>
            {tile.sub}
            {sourceHint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  label: {
    marginBottom: 8,
    fontFamily: "GeistMono-Regular",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontFamily: "GeistMono-Regular",
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  unit: {
    fontSize: 13,
    fontWeight: "500",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  delta: {
    fontFamily: "GeistMono-Regular",
    fontSize: 11,
    fontWeight: "600",
  },
  sub: {
    fontSize: 11,
    flex: 1,
  },
});
