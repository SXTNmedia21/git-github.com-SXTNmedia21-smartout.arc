/**
 * ShiftClockSummary — Post-punch-out view showing shift statistics.
 *
 * Displays: checkmark + congratulations header, 2x2 stats grid (work time,
 * breaks, points, streak), registered supplements, and a "Ferdig" button
 * to dismiss and return to idle state.
 *
 * Mirrors the web ShiftClockSummary with React Native primitives.
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckCircle2, Clock, Coffee, Star, Flame, Coins } from "lucide-react-native";

import { createStyles, withOpacity } from "@/theme";

type ClaimedSupplement = {
  id: string;
  description: string;
  amount: number;
  status: string | null;
};

type BreakEntry = {
  start: string;
  end: string | null;
};

type ShiftClockSummaryProps = {
  punchInTime: string;
  punchOutTime: string;
  breaks: BreakEntry[];
  claimedSupplements: ClaimedSupplement[];
  onDismiss: () => void;
};

/** Calculate total break minutes from completed breaks */
function totalBreakMinutes(breaks: BreakEntry[]): number {
  return breaks.reduce((sum, b) => {
    if (!b.end) return sum;
    const start = new Date(b.start).getTime();
    const end = new Date(b.end).getTime();
    return sum + Math.round((end - start) / 60_000);
  }, 0);
}

/** Format minutes as "Xt Ym" */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export function ShiftClockSummary({
  punchInTime,
  punchOutTime,
  breaks,
  claimedSupplements,
  onDismiss,
}: ShiftClockSummaryProps) {
  const styles = useStyles();

  const punchInMs = new Date(punchInTime).getTime();
  const punchOutMs = new Date(punchOutTime).getTime();
  const totalMinutes = Math.round((punchOutMs - punchInMs) / 60_000);
  const breakMins = totalBreakMinutes(breaks);
  const workMinutes = totalMinutes - breakMins;

  const formatTimeStr = (iso: string) =>
    new Date(iso).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Success header */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
        <View style={styles.checkCircle}>
          <CheckCircle2 size={40} color={styles.successColor.color} strokeWidth={1.8} />
        </View>
        <Text style={styles.title}>Bra jobbet!</Text>
        <Text style={styles.subtitle}>
          {formatTimeStr(punchInTime)} - {formatTimeStr(punchOutTime)}
        </Text>
      </Animated.View>

      {/* 2x2 stats grid */}
      <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.statsGrid}>
        <StatCard
          icon={<Clock size={16} color={styles.infoColor.color} strokeWidth={2} />}
          label="Arbeidstid"
          value={formatDuration(workMinutes)}
        />
        <StatCard
          icon={<Coffee size={16} color={styles.warningColor.color} strokeWidth={2} />}
          label="Pauser"
          value={breaks.length > 0 ? formatDuration(breakMins) : "Ingen"}
        />
        <StatCard
          icon={<Star size={16} color={styles.warningColor.color} strokeWidth={2} />}
          label="Poeng"
          value="+7"
          subtle
        />
        <StatCard
          icon={<Flame size={16} color={styles.brandOrangeColor.color} strokeWidth={2} />}
          label="Streak"
          value="3 dager"
          subtle
        />
      </Animated.View>

      {/* Claimed supplements */}
      {claimedSupplements.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.supplementsSection}
        >
          <Text style={styles.sectionLabel}>Registrerte tillegg</Text>
          {claimedSupplements.map((s) => (
            <View key={s.id} style={styles.supplementRow}>
              <View style={styles.supplementLeft}>
                <Coins size={14} color={styles.successColor.color} strokeWidth={2} />
                <Text style={styles.supplementText}>{s.description}</Text>
              </View>
              <Text style={styles.supplementAmount}>{s.amount} kr</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Dismiss button */}
      <Animated.View entering={FadeInDown.delay(550).duration(500)} style={styles.buttonContainer}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss();
          }}
          style={({ pressed }) => [styles.dismissButton, pressed && styles.dismissButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Ferdig"
        >
          <Text style={styles.dismissButtonText}>Ferdig</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  StatCard helper                                                           */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon,
  label,
  value,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtle?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.statCard, subtle && styles.statCardSubtle]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  content: {
    alignItems: "center" as const,
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },

  /* Header */
  header: {
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 32,
  },

  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withOpacity(theme.colors.success, 0.12),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
  },

  subtitle: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },

  /* Stats */
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 12,
    marginBottom: 24,
    width: "100%" as const,
  },

  statCard: {
    flex: 1,
    minWidth: "45%" as unknown as number,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
  },

  statCardSubtle: {
    opacity: 0.6,
  },

  statValue: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  statLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },

  /* Supplements */
  supplementsSection: {
    width: "100%" as const,
    marginBottom: 24,
    gap: 8,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
    marginBottom: 4,
  },

  supplementRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
  },

  supplementLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },

  supplementText: {
    fontSize: 14,
    color: theme.colors.foreground,
  },

  supplementAmount: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums" as const],
  },

  /* Dismiss button */
  buttonContainer: {
    width: "100%" as const,
    marginTop: 8,
  },

  dismissButton: {
    backgroundColor: theme.colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center" as const,
  },

  dismissButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  dismissButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.primaryForeground,
  },

  successColor: {
    color: theme.colors.success,
  },

  infoColor: {
    color: theme.colors.info,
  },

  warningColor: {
    color: theme.colors.warning,
  },

  brandOrangeColor: {
    color: theme.colors.brandOrange,
  },
}));
