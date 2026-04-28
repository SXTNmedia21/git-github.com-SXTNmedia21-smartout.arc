/**
 * WeeklyTemplateCard — Layer 1 of "Min tilgjengelighet".
 *
 * Shows the employee's recurring weekly availability rules (stored as
 * RFC-5545 RRULEs on the `employee_availability` table). Empty state is
 * itself a CTA (Invariant #13): the "+ Legg til ukemal" pill is always
 * present, whether the list is empty or not.
 *
 * Layer 1 is the *hard* calendar truth — "hver mandag etter 22 ikke
 * tilgjengelig". Layer 2 handles per-day overrides. Layer 3 handles
 * "kan jobbe ekstra i dag".
 */
import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Plus, Repeat, X } from "lucide-react-native";

import { createStyles, useTheme, withOpacity } from "@/theme";
import type { AvailabilityRule } from "@/hooks/queries/use-my-availability";

type WeeklyTemplateCardProps = {
  templates: AvailabilityRule[];
  onAdd: () => void;
  onDelete: (id: string) => void;
};

const WEEKDAY_LABEL_NB: Record<string, string> = {
  MO: "mandag",
  TU: "tirsdag",
  WE: "onsdag",
  TH: "torsdag",
  FR: "fredag",
  SA: "lørdag",
  SU: "søndag",
};

/**
 * Renders a human-readable Norwegian summary of an RRULE.
 * Supports the subset of RRULE we author in-app: FREQ=WEEKLY + BYDAY[+BYHOUR].
 * Falls back to the raw rrule string if parsing fails.
 */
function describeRule(rule: AvailabilityRule): string {
  const rrule = rule.rrule ?? "";
  if (!rrule.includes("FREQ=WEEKLY")) return rrule || "Tilpasset regel";

  const byDay = /BYDAY=([A-Z,]+)/.exec(rrule)?.[1];
  const byHour = /BYHOUR=(\d+)/.exec(rrule)?.[1];

  const days = byDay
    ? byDay
        .split(",")
        .map((d) => WEEKDAY_LABEL_NB[d] ?? d)
        .join(", ")
    : "ukedager";

  const prefix = rule.preference_type === "preferred" ? "Foretrekker å jobbe" : "Ikke tilgjengelig";
  const timeClause = byHour ? ` etter ${byHour.padStart(2, "0")}:00` : "";

  return `Hver ${days}${timeClause} — ${prefix.toLowerCase()}`;
}

export function WeeklyTemplateCard({ templates, onAdd, onDelete }: WeeklyTemplateCardProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleAdd = useCallback(() => {
    Haptics.selectionAsync();
    onAdd();
  }, [onAdd]);

  const handleDelete = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDelete(id);
    },
    [onDelete],
  );

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Ukemal</Text>
        <Text style={styles.sectionHint}>Gjentakende regler</Text>
      </View>

      {templates.length === 0 ? (
        // Empty state IS the CTA (Invariant #13).
        <Pressable
          onPress={handleAdd}
          style={styles.emptyCta}
          accessibilityRole="button"
          accessibilityLabel="Legg til ukemal"
          accessibilityHint="Lag en regel som gjentar seg hver uke"
        >
          <View style={styles.emptyIcon}>
            <Repeat size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Ingen ukemal enda</Text>
          <Text style={styles.emptyBody}>
            Lag en regel som gjentar seg — f.eks. «Hver mandag etter 22:00 ikke tilgjengelig».
          </Text>
          <View style={styles.emptyAddPill}>
            <Plus size={16} color={theme.colors.brandOrange} strokeWidth={1.8} />
            <Text style={styles.emptyAddText}>Legg til ukemal</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.list}>
          {templates.map((tpl) => (
            <View key={tpl.id} style={styles.ruleRow}>
              <View style={styles.ruleIcon}>
                <Repeat size={18} color={theme.colors.brandOrange} strokeWidth={1.6} />
              </View>
              <View style={styles.ruleBody}>
                <Text style={styles.ruleText}>{describeRule(tpl)}</Text>
                {tpl.reason ? <Text style={styles.ruleReason}>{tpl.reason}</Text> : null}
              </View>
              <Pressable
                onPress={() => handleDelete(tpl.id)}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel="Slett ukemal"
                hitSlop={8}
              >
                <X size={16} color={theme.colors.mutedForeground} strokeWidth={1.6} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={handleAdd}
            style={styles.addPill}
            accessibilityRole="button"
            accessibilityLabel="Legg til ukemal"
          >
            <Plus size={16} color={theme.colors.brandOrange} strokeWidth={1.8} />
            <Text style={styles.addPillText}>Legg til ukemal</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  section: { gap: theme.spacing.md, marginBottom: theme.spacing.page },

  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionLabel: { ...theme.typography.title, color: theme.colors.foreground },
  sectionHint: {
    ...theme.typography.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  /* Empty CTA (Invariant #13) */
  emptyCta: {
    minHeight: 180,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withOpacity(theme.colors.border, 0.4),
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.secondary,
    padding: theme.spacing.page,
    gap: theme.spacing.element,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.foreground,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    lineHeight: 22,
  },
  emptyAddPill: {
    marginTop: theme.spacing.element,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: theme.radius.full,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  emptyAddText: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.brandOrange,
  },

  /* List state */
  list: { gap: theme.spacing.element },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    minHeight: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  ruleBody: { flex: 1, gap: 2 },
  ruleText: { ...theme.typography.body, color: theme.colors.foreground },
  ruleReason: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },

  addPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: theme.radius.full,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  addPillText: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.brandOrange,
  },
}));
