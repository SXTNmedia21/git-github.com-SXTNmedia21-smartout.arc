/**
 * Safety Round (Vernerunde) — Checklist inspection screen.
 *
 * Queries `procedure` (type = safety) and `procedure_step` for checklist items.
 * Persists completion by creating deviation records for failed checks and
 * logging the round via the session_note table.
 *
 * Layout:
 * 1. Breadcrumb — Inspection > Kitchen Safety
 * 2. Hero — "Vernerunde" + progress
 * 3. Checklist items — Yes/No buttons per checkpoint
 * 4. Photo evidence button
 * 5. FAB — Complete round (persists to database)
 */

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight, Camera, CheckCheck, ClipboardList } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useReportDeviation } from "@/hooks/mutations/use-report-deviation";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

type CheckStatus = "yes" | "no" | null;

type CheckItem = {
  id: string;
  number: string;
  title: string;
  description: string;
};

/**
 * Fetches safety-type procedures and their steps for the workspace.
 * Each procedure_step becomes a checklist item in the vernerunde.
 */
function useSafetyChecklistItems(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["safety-checklist", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      /* Find safety procedures via their parent protocol (workspace-scoped) */
      const { data: procedures, error: procError } = await supabase
        .from("procedure")
        .select(
          `
          procedure_id,
          name,
          protocol:protocol_id(workspace_id)
        `,
        )
        .eq("procedure_type", "safety")
        .eq("is_active", true)
        .order("sort_order");

      if (procError) throw procError;

      /* Filter to only procedures belonging to this workspace */
      const workspaceProcedures = (procedures ?? []).filter(
        (p) => (p.protocol as { workspace_id: string } | null)?.workspace_id === workspaceId,
      );

      if (workspaceProcedures.length === 0) return [];

      const procedureIds = workspaceProcedures.map((p) => p.procedure_id);

      const { data: steps, error: stepError } = await supabase
        .from("procedure_step")
        .select("step_id, title, description, step_order, procedure_id, is_required")
        .in("procedure_id", procedureIds)
        .order("step_order");

      if (stepError) throw stepError;

      return (steps ?? []).map((s, i) => ({
        id: s.step_id,
        number: String(i + 1).padStart(2, "0"),
        title: s.title,
        description: s.description,
      }));
    },
    enabled: !!workspaceId,
  });
}

export default function SafetyRoundScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { data: ITEMS = [], isLoading } = useSafetyChecklistItems(profile?.workspace_id);
  const { reportDeviation, isSubmitting } = useReportDeviation();
  const [answers, setAnswers] = useState<Record<string, CheckStatus>>({});

  const totalItems = ITEMS.length;
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const progressPercent = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;

  const handleAnswer = (itemId: string, answer: CheckStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers((prev) => ({ ...prev, [itemId]: answer }));
  };

  /** Persist the safety round: create deviations for "no" answers */
  const handleComplete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const failedItems = ITEMS.filter((item) => answers[item.id] === "no");

    /* Create a deviation for each failed check.
     * reported_by/workspace_id resolved server-side via getProfileContext()
     * inside useReportDeviation — ADR-0134, not supplied by caller */
    const deviationPromises = failedItems.map((item) =>
      reportDeviation({
        domain: "safety",
        severity: "medium",
        title: `Vernerunde: ${item.title}`,
        description: `Avvik funnet under vernerunde: ${item.description}`,
      }),
    );

    try {
      await Promise.all(deviationPromises);

      /* Emit a summary event for the round — resolve identity from server (ADR-0134) */
      if (failedItems.length > 0) {
        const { profileId, workspaceId } = await getProfileContext();
        void emit({
          event: "deviation reported",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            entity: { entity_type: "deviation", entity_id: "safety-round" },
            data: {
              domain: "safety",
              severity: "medium",
            },
          },
        });
      }

      Alert.alert(
        "Vernerunde fullfort",
        `${answeredCount - failedItems.length} godkjent, ${failedItems.length} avvik meldt.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Feil", "Kunne ikke lagre vernerunden. Prov igjen.");
    }
  }, [ITEMS, answers, answeredCount, reportDeviation, router]);

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
        <Text style={styles.headerTitle}>Vernerunde</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Text style={styles.crumbText}>INSPEKSJON</Text>
          <ChevronRight
            size={12}
            color={withOpacity(theme.colors.mutedForeground, 0.6)}
            strokeWidth={2}
          />
          <Text style={styles.crumbText}>SIKKERHET</Text>
        </View>

        {/* Loading state */}
        {isLoading && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme.colors.brandOrange} />
            <Text style={styles.emptySubtitle}>Laster sjekkpunkter...</Text>
          </View>
        )}

        {/* Empty state — no safety procedures configured */}
        {!isLoading && ITEMS.length === 0 && (
          <View style={styles.emptyState}>
            <ClipboardList size={40} color={theme.colors.mutedForeground} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Ingen sjekkpunkter konfigurert</Text>
            <Text style={styles.emptySubtitle}>
              Legg til sikkerhetsprosedyrer i administrasjonspanelet for a starte vernerunder.
            </Text>
          </View>
        )}

        {/* Hero — only show when items exist */}
        {ITEMS.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.delay(50).duration(500).springify()}>
              <Text style={styles.heroTitle}>Vernerunde</Text>
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View>
                    <Text style={styles.progressLabel}>AKTUELL FREMDRIFT</Text>
                    <Text style={styles.progressValue}>
                      {answeredCount} av {totalItems} punkter sjekket
                    </Text>
                  </View>
                  <Text style={styles.progressPercent}>{progressPercent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            </Animated.View>

            {/* Checklist */}
            <View style={styles.checklist}>
              {ITEMS.map((item, i) => {
                const answer = answers[item.id] ?? null;
                const isAnswered = answer !== null;
                /* Mark the first unanswered item as active */
                const firstUnansweredIndex = ITEMS.findIndex((it) => !answers[it.id]);
                const isActive = i === firstUnansweredIndex;
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(200 + i * 80)
                      .duration(400)
                      .springify()}
                  >
                    <View
                      style={[styles.checkCard, isActive && !isAnswered && styles.checkCardActive]}
                    >
                      <View style={styles.checkContent}>
                        <View style={styles.checkLabelRow}>
                          <Text style={styles.checkNumber}>PKT #{item.number}</Text>
                          {isActive && !isAnswered && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>AKTIV</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.checkTitle}>{item.title}</Text>
                        <Text style={styles.checkDesc}>{item.description}</Text>
                      </View>
                      {!isAnswered ? (
                        <View style={styles.answerRow}>
                          <Pressable
                            onPress={() => handleAnswer(item.id, "no")}
                            style={({ pressed }) => [
                              styles.answerButton,
                              styles.answerNo,
                              pressed && styles.answerPressed,
                            ]}
                          >
                            <Text style={styles.answerNoText}>Nei</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleAnswer(item.id, "yes")}
                            style={({ pressed }) => [
                              styles.answerButton,
                              styles.answerYes,
                              pressed && styles.answerPressed,
                            ]}
                          >
                            <Text style={styles.answerYesText}>Ja</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.answeredRow}>
                          <Text
                            style={[
                              styles.answeredText,
                              answer === "yes" ? styles.answeredGood : styles.answeredBad,
                            ]}
                          >
                            {answer === "yes" ? "Godkjent" : "Avvik meldt"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })}

              {/* Remaining items indicator */}
              {answeredCount < totalItems && answeredCount > 0 && (
                <View style={styles.placeholderCard}>
                  <Text style={styles.placeholderText}>
                    {totalItems - answeredCount} gjenstående sjekkpunkter
                  </Text>
                </View>
              )}
            </View>

            {/* Photo evidence */}
            <View style={styles.evidenceCard}>
              <Text style={styles.evidenceTitle}>Gjenstående observasjoner?</Text>
              <Pressable onPress={() => Haptics.selectionAsync()} style={styles.evidenceButton}>
                <Camera size={16} color={theme.colors.foreground} strokeWidth={1.8} />
                <Text style={styles.evidenceButtonText}>Legg til bildebevis</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB — Complete round (only when all items answered) */}
      {ITEMS.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(500).duration(500).springify()}
          style={styles.fabWrap}
        >
          <Pressable
            onPress={handleComplete}
            disabled={answeredCount < totalItems || isSubmitting}
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed,
              (answeredCount < totalItems || isSubmitting) && styles.fabDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <CheckCheck size={28} color="#ffffff" strokeWidth={2} />
            )}
          </Pressable>
        </Animated.View>
      )}
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
  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 120 },

  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: theme.spacing.page,
  },
  crumbText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },

  heroTitle: {
    fontSize: 36,
    fontWeight: "300",
    letterSpacing: -1,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.section,
    lineHeight: 42,
  },
  progressCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  progressValue: {
    ...theme.typography.headline,
    fontStyle: "italic",
    color: theme.colors.foreground,
    marginTop: 4,
  },
  progressPercent: { fontSize: 24, fontWeight: "500", color: theme.colors.brandOrange },
  progressTrack: {
    height: 8,
    backgroundColor: theme.colors.muted,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.colors.brandOrange, borderRadius: 4 },

  checklist: { gap: theme.spacing.md },
  checkCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.section,
    gap: theme.spacing.section,
    ...theme.shadows.sm,
  },
  checkCardActive: { borderLeftWidth: 4, borderLeftColor: theme.colors.brandOrange },
  checkContent: { gap: 8 },
  checkLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkNumber: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.brandOrange,
  },
  activeBadge: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  activeBadgeText: { fontSize: 10, fontWeight: "600", color: theme.colors.brandOrange },
  checkTitle: { ...theme.typography.title, color: theme.colors.foreground, lineHeight: 28 },
  checkDesc: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    lineHeight: 20,
  },
  answerRow: { flexDirection: "row", gap: theme.spacing.element },
  answerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  answerNo: {
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.3),
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
  },
  answerYes: { backgroundColor: theme.colors.brandOrange, ...theme.shadows.md },
  answerPressed: { transform: [{ scale: 0.95 }] },
  answerNoText: { ...theme.typography.bodyBold, color: theme.colors.foreground },
  answerYesText: { ...theme.typography.bodyBold, color: "#ffffff" },
  answeredRow: { alignItems: "center", paddingVertical: 8 },
  answeredText: { ...theme.typography.bodyBold },
  answeredGood: { color: theme.colors.success },
  answeredBad: { color: theme.colors.destructive },

  placeholderCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: withOpacity(theme.colors.border, 0.2),
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    alignItems: "center",
    opacity: 0.4,
  },
  placeholderText: {
    ...theme.typography.subheadline,
    fontStyle: "italic",
    color: theme.colors.foreground,
  },

  evidenceCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.muted,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.page,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  evidenceTitle: { ...theme.typography.headline, color: theme.colors.foreground },
  evidenceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.mutedForeground,
  },
  evidenceButtonText: { ...theme.typography.subheadline, color: theme.colors.foreground },

  fabWrap: { position: "absolute", bottom: 100, right: theme.spacing.section },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.lg,
  },
  fabPressed: { transform: [{ scale: 0.9 }] },
  fabDisabled: { opacity: 0.4 },

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
