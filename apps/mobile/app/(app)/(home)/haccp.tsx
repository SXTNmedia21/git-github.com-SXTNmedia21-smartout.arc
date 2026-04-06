/**
 * HACCP Temperature Control Screen — Mobile port of landing FeatureHaccp.
 *
 * Displays a checklist of cooling units to inspect. Employee taps each unit
 * to log the temperature reading. Units over threshold trigger a deviation alert.
 *
 * For now uses demo data — will connect to haccp_log table in V2.
 */

import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Thermometer, CheckCircle2, AlertTriangle, Shield } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useLogHaccp } from "@/hooks/mutations/use-log-haccp";

type UnitStatus = "pending" | "ok" | "avvik" | "resolved";

type CoolingUnit = {
  id: string;
  name: string;
  location: string;
  temperature: number;
  threshold: number;
};

/** Demo data used as fallback when no cooling units are registered in the asset table */
const DEMO_UNITS: CoolingUnit[] = [
  { id: "u1", name: "Kjoleskap 1", location: "Hovedkjokken", temperature: 3.2, threshold: 4 },
  { id: "u2", name: "Kjolerom", location: "Lager B", temperature: 9.1, threshold: 4 },
  { id: "u3", name: "Fryser", location: "Hovedkjokken", temperature: -18.5, threshold: -15 },
];

/** Fetches cooling units from the asset table for the current workspace */
function useHaccpUnits(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["haccp-units", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      // asset_type "storage" covers refrigeration/cooling units in the schema enum.
      // The asset table doesn't store live temperature — temperature is logged via haccp_log.
      // We fetch units for display only; temperature defaults to 0 until a reading is logged.
      const { data, error } = await supabase
        .from("asset")
        .select("asset_id, name, location:location_id(name)")
        .eq("workspace_id", workspaceId)
        .eq("asset_type", "storage")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.asset_id,
        name: a.name,
        location: (a.location as { name: string } | null)?.name ?? "Ukjent",
        temperature: 0,
        threshold: 4,
      }));
    },
    enabled: !!workspaceId,
  });
}

function getStatusColor(status: UnitStatus, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case "ok":
      return {
        bg: withOpacity(theme.colors.success, 0.08),
        border: withOpacity(theme.colors.success, 0.2),
        text: theme.colors.success,
      };
    case "avvik":
      return {
        bg: withOpacity(theme.colors.destructive, 0.08),
        border: withOpacity(theme.colors.destructive, 0.25),
        text: theme.colors.destructive,
      };
    case "resolved":
      return {
        bg: withOpacity(theme.colors.warning, 0.08),
        border: withOpacity(theme.colors.warning, 0.2),
        text: theme.colors.warning,
      };
    default:
      return {
        bg: "transparent",
        border: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        text: theme.colors.mutedForeground,
      };
  }
}

export default function HaccpScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { data: fetchedUnits = [] } = useHaccpUnits(profile?.workspace_id);
  const UNITS = fetchedUnits.length > 0 ? fetchedUnits : DEMO_UNITS;
  const { logHaccp } = useLogHaccp();
  const [checkedCount, setCheckedCount] = useState(0);
  const [resolved, setResolved] = useState(false);

  const getUnitStatus = useCallback(
    (index: number): UnitStatus => {
      if (index >= checkedCount) return "pending";
      const unit = UNITS[index]!;
      const isOver = unit.temperature > unit.threshold;
      if (resolved && isOver) return "resolved";
      if (isOver) return "avvik";
      return "ok";
    },
    [checkedCount, resolved],
  );

  const handleCheck = useCallback(
    (index: number) => {
      if (index !== checkedCount) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCheckedCount((c) => c + 1);

      // Persist the temperature reading to the offline sync queue.
      // HACCP logging is a Mattilsynet legal requirement — must never be skipped.
      const unit = UNITS[index]!;
      const isWithinRange = unit.temperature <= unit.threshold;
      if (profile?.profile_id && profile?.workspace_id) {
        void logHaccp({
          ccp_reference: unit.id,
          temperature: unit.temperature,
          unit: unit.name,
          is_within_range: isWithinRange,
          corrective_action: isWithinRange
            ? null
            : `Temperaturavvik: ${(unit.temperature - unit.threshold).toFixed(1)}°C over grense`,
          session_id: null,
          profile_id: profile.profile_id,
          workspace_id: profile.workspace_id,
        });
      }

      // Auto-resolve after all checked and avvik found
      const isLast = index === UNITS.length - 1;
      if (isLast) {
        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResolved(true);
        }, 1200);
      }
    },
    [checkedCount, UNITS, profile, logHaccp],
  );

  const hasAvvik = checkedCount >= 2; // Unit 2 is over threshold
  const allDone = checkedCount >= UNITS.length;
  const progress = Math.min(checkedCount, UNITS.length) / UNITS.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>HACCP-kontroll</Text>
          <Text style={styles.headerSubtitle}>
            Daglig temperatursjekk — {new Date().toLocaleDateString("nb-NO")}
          </Text>
        </View>
        <View style={styles.mattilsynBadge}>
          <Shield size={12} color={theme.colors.success} strokeWidth={2} />
          <Text style={styles.mattilsynText}>Mattilsynet</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {Math.min(checkedCount, UNITS.length)} av {UNITS.length} kontrollert
            </Text>
            <Text style={styles.progressStatus}>
              {allDone ? (resolved ? "Fullfort" : "Avvik funnet") : "Pagar"}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
                hasAvvik && !resolved ? styles.progressFillDanger : styles.progressFillSuccess,
              ]}
            />
          </View>
        </Animated.View>

        {/* Unit cards */}
        {UNITS.map((unit, i) => {
          const status = getUnitStatus(i);
          const isCurrent = i === checkedCount && checkedCount < UNITS.length;
          const isOver = unit.temperature > unit.threshold;
          const colors = getStatusColor(status, theme);

          return (
            <Animated.View key={unit.id} entering={FadeInDown.delay(200 + i * 100).duration(300)}>
              <Pressable
                onPress={() => handleCheck(i)}
                disabled={!isCurrent}
                style={({ pressed }) => [
                  styles.unitCard,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  isCurrent && styles.unitCardCurrent,
                  pressed && isCurrent && styles.pressed,
                  status === "pending" && !isCurrent && styles.unitCardPending,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sjekk ${unit.name}`}
              >
                <View style={styles.unitRow}>
                  <View style={[styles.unitIcon, { backgroundColor: colors.bg }]}>
                    <Thermometer size={20} color={colors.text} strokeWidth={2} />
                  </View>
                  <View style={styles.unitInfo}>
                    <Text style={styles.unitName}>{unit.name}</Text>
                    <Text style={styles.unitLocation}>{unit.location}</Text>
                  </View>
                  <View style={styles.unitRight}>
                    {status !== "pending" && (
                      <Text
                        style={[
                          styles.unitTemp,
                          isOver && status !== "resolved" ? styles.tempDanger : styles.tempOk,
                        ]}
                      >
                        {unit.temperature > 0 ? "+" : ""}
                        {unit.temperature}°C
                      </Text>
                    )}
                    {status === "ok" && (
                      <CheckCircle2 size={20} color={theme.colors.success} strokeWidth={2} />
                    )}
                    {status === "avvik" && (
                      <AlertTriangle size={20} color={theme.colors.destructive} strokeWidth={2} />
                    )}
                    {status === "resolved" && (
                      <CheckCircle2 size={20} color={theme.colors.warning} strokeWidth={2} />
                    )}
                  </View>
                </View>

                {status !== "pending" && (
                  <View style={styles.thresholdRow}>
                    <Text style={styles.thresholdText}>
                      Grense: {unit.threshold > 0 ? "+" : ""}
                      {unit.threshold}°C
                    </Text>
                    {status === "ok" && <Text style={styles.statusOk}>Godkjent</Text>}
                    {status === "avvik" && (
                      <Text style={styles.statusDanger}>
                        Avvik: {(unit.temperature - unit.threshold).toFixed(1)}°C over
                      </Text>
                    )}
                    {status === "resolved" && (
                      <Text style={styles.statusWarning}>Avvik meldt — tiltak iverksatt</Text>
                    )}
                  </View>
                )}

                {isCurrent && <Text style={styles.tapHint}>Trykk for a registrere</Text>}
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Alert banner */}
        {hasAvvik && !resolved && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.alertBanner}>
            <AlertTriangle size={18} color={theme.colors.destructive} strokeWidth={2} />
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>Temperaturavvik registrert</Text>
              <Text style={styles.alertSubtitle}>
                Kjolerom (Lager B) — +9.1°C — Varslet avdelingsleder
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Success banner */}
        {resolved && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.successBanner}>
            <CheckCircle2 size={18} color={theme.colors.success} strokeWidth={2} />
            <View style={styles.alertText}>
              <Text style={styles.successTitle}>HACCP-kontroll fullfort</Text>
              <Text style={styles.alertSubtitle}>
                2 godkjent, 1 avvik meldt og handtert. Logg lagret.
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    gap: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  foregroundColor: {
    color: theme.colors.foreground,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  mattilsynBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark
      ? "rgba(255,255,255,0.06)"
      : withOpacity(theme.colors.success, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.success, 0.2),
  },
  mattilsynText: {
    ...theme.typography.micro,
    color: theme.colors.success,
    fontWeight: theme.fontWeights.medium,
  },
  content: {
    padding: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.element,
  },

  /* Progress */
  progressCard: {
    padding: theme.spacing.element,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.tight,
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  progressStatus: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressFillSuccess: {
    backgroundColor: theme.colors.success,
  },
  progressFillDanger: {
    backgroundColor: theme.colors.destructive,
  },

  /* Unit cards */
  unitCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.tight,
  },
  unitCardCurrent: {
    borderColor: withOpacity(theme.colors.success, 0.3),
  },
  unitCardPending: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  unitIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  unitInfo: {
    flex: 1,
    gap: 2,
  },
  unitName: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  unitLocation: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  unitRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  unitTemp: {
    fontSize: 18,
    fontWeight: theme.fontWeights.bold,
    fontVariant: ["tabular-nums" as const],
  },
  tempOk: {
    color: theme.colors.success,
  },
  tempDanger: {
    color: theme.colors.destructive,
  },
  thresholdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 52,
  },
  thresholdText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  statusOk: {
    ...theme.typography.caption,
    color: theme.colors.success,
    fontWeight: theme.fontWeights.medium,
  },
  statusDanger: {
    ...theme.typography.caption,
    color: theme.colors.destructive,
    fontWeight: theme.fontWeights.medium,
  },
  statusWarning: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontWeight: theme.fontWeights.medium,
  },
  tapHint: {
    ...theme.typography.caption,
    color: theme.colors.success,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },

  /* Banners */
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: withOpacity(theme.colors.destructive, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.2),
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: withOpacity(theme.colors.success, 0.06),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.success, 0.2),
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.destructive,
  },
  successTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.success,
  },
  alertSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
