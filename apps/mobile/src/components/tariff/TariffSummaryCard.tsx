/**
 * TariffSummaryCard — displays the workspace's active tariff binding.
 *
 * READ-ONLY. No authoring affordances. ADR-0133: D1-D5 authoring stays on web.
 *
 * Shows:
 * - Union name (e.g. "Riksavtalen")
 * - Law version (e.g. "2026")
 * - Effective-from date
 * - "Ikke tariff-bundet" soft state when is_bound = false
 *
 * Nordic Split mobile card: warm orange accent, brandOrange icon, muted subtext.
 */

import React from "react";
import { View, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FileText, Info } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { CurrentTariffData } from "@/hooks/queries/use-current-tariff";

type Props = {
  data: CurrentTariffData;
};

function formatEffectiveFrom(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TariffSummaryCard({ data }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  /* Unbound workspace — soft informational state */
  if (!data.is_bound) {
    return (
      <Animated.View
        entering={FadeInDown.delay(100).duration(400).springify()}
        style={styles.unboundCard}
        accessibilityLabel="Tariff ikke bundet — lønn baseres på lokal avtale"
        accessibilityRole="none"
      >
        <View style={styles.unboundIconWrap}>
          <Info size={22} color={theme.colors.mutedForeground} strokeWidth={1.5} />
        </View>
        <View style={styles.unboundBody}>
          <Text style={styles.unboundTitle}>Ikke tariff-bundet</Text>
          <Text style={styles.unboundSubtext}>
            Din arbeidsplass er ikke tariff-bundet — lønn baseres på lokal avtale.
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400).springify()}
      style={styles.card}
      accessibilityLabel={`Tariff: ${data.union_name ?? "—"}, lovversjon ${data.law_version ?? "—"}`}
      accessibilityRole="none"
    >
      {/* Decorative top accent */}
      <View style={styles.topAccent} />

      <View style={styles.content}>
        {/* Icon + union name row */}
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <FileText size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.overline}>TARIFF</Text>
            <Text style={styles.unionName} numberOfLines={2}>
              {data.union_name ?? "—"}
            </Text>
          </View>
        </View>

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Lovversjon</Text>
            <Text style={styles.detailValue}>{data.law_version ?? "—"}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Gjelder fra</Text>
            <Text style={styles.detailValue}>{formatEffectiveFrom(data.effective_from)}</Text>
          </View>
        </View>

        {/* Bound indicator */}
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Tariff-bundet arbeidsplass</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  /* ── Bound card ── */
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    overflow: "hidden" as const,
    ...theme.shadows.md,
  },
  topAccent: {
    height: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  content: {
    padding: theme.spacing.page,
    gap: theme.spacing.section,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: theme.spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.brandOrange, 0.12)
      : withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  overline: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  unionName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },

  /* ── Details grid ── */
  detailsGrid: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  detailItem: {
    flex: 1,
    gap: 2,
  },
  detailDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  /* ── Status indicator ── */
  statusRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },

  /* ── Unbound card ── */
  unboundCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: theme.spacing.md,
    padding: theme.spacing.page,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  unboundIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  unboundBody: {
    flex: 1,
    gap: 4,
  },
  unboundTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
  },
  unboundSubtext: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
}));
