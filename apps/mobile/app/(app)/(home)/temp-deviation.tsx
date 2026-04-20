/**
 * Temperature Deviation — HACCP temp control handling screen.
 *
 * Queries the most recent open safety deviation for the workspace. Shows the
 * deviation details, corrective action steps based on severity, last successful
 * HACCP log, and a CTA to resolve the deviation.
 *
 * Layout:
 * 1. Context header — "Håndter avvik" label
 * 2. Hero — deviation title + temp badge (from HACCP log)
 * 3. Action steps checklist — dynamic based on severity
 * 4. System status info card — last successful HACCP log
 * 5. CTA — "Bekreft tiltak utført" (resolves deviation)
 */

import React, { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Check, Clock, Wrench, BadgeCheck, AlertTriangle } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { emit } from "@smartout/telemetry";

type ActionStep = {
  id: string;
  title: string;
  subtitle: string;
  icon?: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
};

/**
 * Returns corrective action steps based on deviation severity.
 * Higher severity = more escalation steps.
 */
function getCorrectiveSteps(severity: string): ActionStep[] {
  const baseSteps: ActionStep[] = [
    { id: "1", title: "Kontroller temperaturen manuelt", subtitle: "Bruk kalibrert termometer" },
    { id: "2", title: "Mal pa nytt etter 30 min", subtitle: "Vent og mal igjen", icon: Clock },
  ];

  if (severity === "high" || severity === "critical") {
    baseSteps.push(
      { id: "3", title: "Nullstill kompressor", subtitle: "Sjekk stroemforsyning og termostat" },
      {
        id: "4",
        title: "Meld fra til tekniker",
        subtitle: "Eskaleringsprosedyre",
        icon: Wrench,
      },
    );
  }

  if (severity === "critical") {
    baseSteps.push({
      id: "5",
      title: "Flytt matvarer til alternativ kjoeling",
      subtitle: "Forebygg matsvinn og helserisiko",
    });
  }

  return baseSteps;
}

/** Fetches the most recent open safety deviation for the workspace */
function useOpenSafetyDeviation(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["open-safety-deviation", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("deviation")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("domain", "safety")
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
}

/** Fetches the last successful (within range) HACCP log for context */
function useLastSuccessfulHaccpLog(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["last-haccp-success", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("haccp_log")
        .select("logged_at, temperature, unit")
        .eq("workspace_id", workspaceId)
        .eq("is_within_range", true)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
}

export default function TempDeviationScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { data: deviation, isLoading: deviationLoading } = useOpenSafetyDeviation(
    profile?.workspace_id,
  );
  const { data: lastLog } = useLastSuccessfulHaccpLog(profile?.workspace_id);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [isResolving, setIsResolving] = useState(false);

  /** Dynamic steps based on deviation severity */
  const STEPS = useMemo(
    () => getCorrectiveSteps(deviation?.severity ?? "medium"),
    [deviation?.severity],
  );

  const allStepsCompleted = STEPS.length > 0 && STEPS.every((s) => completed[s.id]);

  const handleToggle = (stepId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompleted((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  /** Format the last successful log timestamp for display */
  const lastLogText = useMemo(() => {
    if (!lastLog) return "Ingen tidligere vellykkede logger funnet.";
    const logDate = new Date(lastLog.logged_at);
    const now = new Date();
    const diffMs = now.getTime() - logDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1)
      return `Siste vellykkede logg: for ${Math.floor(diffMs / 60000)} min siden (${lastLog.unit}).`;
    if (diffHours < 24)
      return `Siste vellykkede logg: for ${diffHours} timer siden kl. ${logDate.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })} (${lastLog.unit}).`;
    return `Siste vellykkede logg: ${logDate.toLocaleDateString("nb-NO")} kl. ${logDate.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })} (${lastLog.unit}).`;
  }, [lastLog]);

  /** Resolve the deviation by updating its status */
  const handleResolve = useCallback(async () => {
    if (!deviation || !profile?.profile_id || !profile?.workspace_id) return;

    setIsResolving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const completedStepNames = STEPS.filter((s) => completed[s.id]).map((s) => s.title);

      const { error: updateError } = await supabase
        .from("deviation")
        .update({
          status: "resolved",
          resolved_by: profile.profile_id,
          resolved_at: new Date().toISOString(),
          resolution_notes: `Tiltak utfort: ${completedStepNames.join(", ")}`,
        })
        .eq("deviation_id", deviation.deviation_id);

      if (updateError) throw updateError;

      void emit({
        event: "deviation updated",
        workspace_id: profile.workspace_id,
        actor_id: profile.profile_id,
        properties: {
          entity: { entity_type: "deviation", entity_id: deviation.deviation_id },
          data: {
            status: "resolved",
          },
        },
      });

      Alert.alert("Avvik lukket", "Tiltakene er bekreftet og avviket er markert som lost.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Feil", "Kunne ikke lukke avviket. Prov igjen.");
    } finally {
      setIsResolving(false);
    }
  }, [deviation, profile, STEPS, completed, router]);

  /** Extract deviation title for display — falls back to generic text */
  const deviationTitle = deviation?.title ?? "Temperaturavvik";
  const deviationDescription = deviation?.description ?? "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>Temp-avvik</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Loading state */}
        {deviationLoading && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme.colors.brandOrange} />
            <Text style={styles.emptySubtitle}>Laster avvik...</Text>
          </View>
        )}

        {/* Empty state — no open deviation */}
        {!deviationLoading && !deviation && (
          <View style={styles.emptyState}>
            <AlertTriangle size={40} color={theme.colors.mutedForeground} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Ingen aktive temperaturavvik</Text>
            <Text style={styles.emptySubtitle}>
              Det finnes ingen apne sikkerhetsavvik for denne arbeidsplassen.
            </Text>
          </View>
        )}

        {/* Deviation content */}
        {deviation && (
          <>
            {/* Context */}
            <Animated.View entering={FadeIn.delay(50).duration(400)} style={styles.contextRow}>
              <Text style={styles.contextLabel}>HANDTER AVVIK</Text>
            </Animated.View>

            {/* Hero */}
            <Animated.View entering={FadeInDown.delay(100).duration(500).springify()}>
              <Text style={styles.heroTitle}>
                {deviationTitle}
                {deviationDescription ? (
                  <>
                    {"\n"}
                    <Text style={styles.heroAccent}>{deviationDescription}</Text>
                  </>
                ) : null}
              </Text>
              <View style={styles.tempBadge}>
                <Text style={styles.tempValue}>
                  {deviation.severity === "critical"
                    ? "Kritisk"
                    : deviation.severity === "high"
                      ? "Hoy"
                      : deviation.severity === "medium"
                        ? "Medium"
                        : "Lav"}
                </Text>
                <View style={styles.tempDivider} />
                <Text style={styles.tempLimit}>Alvorlighetsgrad: {deviation.severity}</Text>
              </View>
            </Animated.View>

            {/* Action Steps */}
            <View style={styles.stepsSection}>
              <Text style={styles.stepsSectionTitle}>TILTAKSTRINN</Text>
              {STEPS.map((step, i) => {
                const isDone = completed[step.id] ?? false;
                const IconComponent = step.icon;
                return (
                  <Animated.View
                    key={step.id}
                    entering={FadeInDown.delay(250 + i * 80)
                      .duration(400)
                      .springify()}
                  >
                    <Pressable
                      onPress={() => handleToggle(step.id)}
                      style={({ pressed }) => [
                        styles.stepRow,
                        isDone && styles.stepRowDone,
                        pressed && styles.stepRowPressed,
                      ]}
                    >
                      <View style={[styles.stepCircle, isDone && styles.stepCircleDone]}>
                        {isDone && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                      </View>
                      {!isDone && IconComponent && (
                        <IconComponent
                          size={18}
                          color={withOpacity(theme.colors.mutedForeground, 0.3)}
                          strokeWidth={1.5}
                        />
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {/* System Status — last successful HACCP log */}
            <Animated.View
              entering={FadeInDown.delay(500).duration(400).springify()}
              style={styles.statusCard}
            >
              <Text style={styles.statusLabel}>SYSTEMSTATUS</Text>
              <Text style={styles.statusText}>{lastLogText}</Text>
            </Animated.View>

            {/* CTA */}
            <Animated.View
              entering={FadeInDown.delay(600).duration(500).springify()}
              style={styles.ctaSection}
            >
              <Pressable
                onPress={handleResolve}
                disabled={!allStepsCompleted || isResolving}
                style={({ pressed }) => [
                  styles.ctaButton,
                  pressed && styles.ctaPressed,
                  (!allStepsCompleted || isResolving) && styles.ctaDisabled,
                ]}
              >
                {isResolving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <BadgeCheck size={20} color="#ffffff" strokeWidth={2} />
                )}
                <Text style={styles.ctaText}>Bekreft tiltak utfort</Text>
              </Pressable>
              <Text style={styles.ctaId}>
                ID: {deviation.deviation_id.slice(0, 8).toUpperCase()}
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: theme.spacing.xl + 40 },

  contextRow: { marginBottom: theme.spacing.md },
  contextLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
  },

  heroTitle: {
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 44,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.section,
  },
  heroAccent: { fontStyle: "italic", color: theme.colors.brandOrange },
  tempBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    alignSelf: "flex-start",
    backgroundColor: withOpacity(theme.colors.destructive, 0.08),
    paddingHorizontal: theme.spacing.section,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.1),
    marginBottom: theme.spacing.page,
  },
  tempValue: { fontSize: 20, fontWeight: "600", color: theme.colors.destructive },
  tempDivider: {
    width: 1,
    height: 16,
    backgroundColor: withOpacity(theme.colors.destructive, 0.2),
  },
  tempLimit: {
    ...theme.typography.subheadline,
    fontWeight: "500",
    color: theme.colors.mutedForeground,
  },

  stepsSection: { gap: theme.spacing.element, marginBottom: theme.spacing.page },
  stepsSectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginBottom: theme.spacing.element,
    paddingHorizontal: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.card,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    ...theme.shadows.sm,
  },
  stepRowDone: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.3) : theme.colors.secondary,
  },
  stepRowPressed: { opacity: 0.85 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  stepCircleDone: {
    backgroundColor: theme.colors.brandOrange,
    borderColor: theme.colors.brandOrange,
  },
  stepContent: { flex: 1, gap: 2 },
  stepTitle: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },
  stepSubtitle: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  statusCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.muted,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    marginBottom: theme.spacing.page,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
  },
  statusText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    lineHeight: 22,
  },

  ctaSection: { paddingTop: theme.spacing.md },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  ctaPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  ctaText: { ...theme.typography.bodyBold, color: "#ffffff" },
  ctaId: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    textAlign: "center",
    marginTop: theme.spacing.md,
    textTransform: "uppercase",
  },
  ctaDisabled: { opacity: 0.4 },

  /* Empty / loading state */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.element,
  },
  emptyTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  emptySubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    paddingHorizontal: theme.spacing.card,
  },
}));
