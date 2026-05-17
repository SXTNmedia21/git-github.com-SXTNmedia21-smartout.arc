/**
 * ParagrafReferenceList — displays paragraf citations and rates from the tariff.
 *
 * READ-ONLY. No forms, no interactions beyond accessibility. ADR-0133.
 *
 * Renders each paragraf_references entry as a card row showing:
 * - Paragraf identifier (e.g. "Riksavtalen §6")
 * - Description
 * - Rate if present (formatted per rate_type: percentage or NOK amount)
 *
 * Empty state when paragraf_references is an empty array (bound workspace
 * with no rule rows yet, or unbound workspace — caller controls visibility).
 *
 * Nordic Split: muted card rows, orange accent on rate values, overline labels.
 */

import React from "react";
import { View, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BookOpen } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { CurrentTariffData } from "@/hooks/queries/use-current-tariff";

type ParagrafEntry = CurrentTariffData["paragraf_references"][number];
type Props = {
  references: CurrentTariffData["paragraf_references"];
};

function formatRate(entry: ParagrafEntry): string | null {
  if (entry.rate_value === undefined || entry.rate_type === undefined) return null;
  if (entry.rate_type === "percentage") {
    return `${entry.rate_value}%`;
  }
  if (entry.rate_type === "fixed_amount") {
    return `${entry.rate_value.toLocaleString("nb-NO")} kr`;
  }
  if (entry.rate_type === "hourly_rate") {
    return `${entry.rate_value.toLocaleString("nb-NO")} kr/t`;
  }
  return null;
}

export function ParagrafReferenceList({ references }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  if (references.length === 0) {
    return (
      <View
        style={styles.emptyContainer}
        accessibilityLabel="Ingen paragraf-referanser tilgjengelig"
        accessibilityRole="none"
      >
        <BookOpen size={20} color={theme.colors.mutedForeground} strokeWidth={1.5} />
        <Text style={styles.emptyText}>Ingen paragraf-referanser ennå</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {references.map((entry, index) => {
        const rateText = formatRate(entry);
        return (
          <Animated.View
            key={`${entry.paragraf}-${index}`}
            entering={FadeInDown.delay(150 + index * 40)
              .duration(350)
              .springify()}
            style={styles.row}
            accessibilityLabel={`${entry.paragraf}: ${entry.description}${rateText ? `, sats: ${rateText}` : ""}`}
            accessibilityRole="none"
          >
            {/* Paragraf identifier */}
            <View style={styles.rowTop}>
              <View style={styles.paragrafBadge}>
                <Text style={styles.paragrafText} numberOfLines={1}>
                  {entry.paragraf}
                </Text>
              </View>
              {rateText && <Text style={styles.rateText}>{rateText}</Text>}
            </View>

            {/* Description */}
            <Text style={styles.description} numberOfLines={3}>
              {entry.description}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  list: {
    gap: theme.spacing.element,
  },

  /* ── Row ── */
  row: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    gap: theme.spacing.tight,
    ...theme.shadows.sm,
  },
  rowTop: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: theme.spacing.md,
  },

  /* ── Paragraf badge ── */
  paragrafBadge: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.brandOrange, 0.12)
      : withOpacity(theme.colors.brandOrange, 0.08),
    alignSelf: "flex-start" as const,
  },
  paragrafText: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    color: theme.colors.brandOrange,
  },

  /* ── Rate ── */
  rateText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: theme.colors.brandOrange,
    fontVariant: ["tabular-nums" as const],
  },

  /* ── Description ── */
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.mutedForeground,
  },

  /* ── Empty state ── */
  emptyContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.card,
    paddingHorizontal: theme.spacing.card,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.md,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
}));
