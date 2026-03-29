/**
 * AbsenceRequestScreen — Nordic Split absence request with balance-first design.
 *
 * Layout:
 * 1. Hero title: "Registrer fravaer" serif italic 5xl
 * 2. Balance cards: 3-col square grid (Ferie, Egenmelding, Omsorgsdager)
 * 3. Request form card: type picker pills, 2-col date range, live projection, gradient CTA
 * 4. History section: "Mine soknader" with status badges
 *
 * Data from useAbsenceBalance(), useAbsenceTypes(), useMyAbsenceRequests().
 */

import React, { useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Calendar, Clock, Heart, Palmtree, Send } from "lucide-react-native";

import { createStyles, useTheme, withOpacity } from "@/theme";
import { Input } from "@/components/ui/Input";
import { strings } from "@/constants/strings";
import { useAbsenceBalance } from "@/hooks/queries/use-absence-balance";
import { useAbsenceTypes } from "@/hooks/queries/use-absence-types";
import { useMyAbsenceRequests } from "@/hooks/queries/use-my-absence-requests";
import { useSupplementRules } from "@/hooks/queries/use-supplement-rules";
import { useRequestAbsence } from "@/hooks/mutations/use-request-absence";
import { useCancelAbsence } from "@/hooks/mutations/use-cancel-absence";
import { projectAbsenceBalance } from "@/lib/absence-projection";
import type { ProjectionResult } from "@/lib/absence-projection";

const CATEGORY_COLOR_KEYS: Record<
  string,
  { colorKey: keyof ReturnType<typeof useTheme>["colors"]; label: string }
> = {
  vacation: { colorKey: "success", label: strings.payroll.vacation },
  sick_self: { colorKey: "warning", label: strings.payroll.selfReported },
  care_of_child: { colorKey: "brandPurple", label: strings.payroll.careDays },
};

/** Maps schedule_absence.status to badge variant + label */
function getStatusDisplay(status: string): {
  variant: "warning" | "success" | "destructive" | "muted";
  label: string;
  color: string;
} {
  switch (status) {
    case "pending":
      return { variant: "warning", label: "Venter", color: "#c18200" };
    case "approved":
      return { variant: "success", label: "Godkjent", color: "#11ad32" };
    case "rejected":
      return { variant: "destructive", label: "Avvist", color: "#e7000b" };
    case "cancelled":
      return { variant: "muted", label: "Kansellert", color: "#7a756e" };
    default:
      return { variant: "muted", label: status, color: "#7a756e" };
  }
}

/** Format ISO date as "DD. mon" for compact display */
function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate);
  const dd = date.getDate();
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return `${dd}. ${months[date.getMonth()]}`;
}

/** Balance card icon by category */
function getCategoryIcon(category: string) {
  switch (category) {
    case "vacation":
      return Palmtree;
    case "sick_self":
      return Clock;
    case "care_of_child":
      return Heart;
    default:
      return Calendar;
  }
}

export function AbsenceRequestScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { data: balanceData, isLoading: balanceLoading } = useAbsenceBalance();
  const { data: requestsData, isLoading: requestsLoading } = useMyAbsenceRequests();
  const { data: supplementRulesData } = useSupplementRules();
  const { requestAbsence } = useRequestAbsence();
  const { cancelAbsence } = useCancelAbsence();

  const absenceTypesQuery = useAbsenceTypes();

  /* Form state */
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const absenceTypes = absenceTypesQuery.data ?? [];
  const quotas = balanceData?.quotas ?? [];
  const requests = requestsData?.requests ?? [];

  const selectedType = useMemo(
    () => absenceTypes.find((t) => t.id === selectedTypeId) ?? null,
    [absenceTypes, selectedTypeId],
  );

  const typeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of absenceTypes) {
      map.set(t.id, t.name_no ?? t.name);
    }
    return map;
  }, [absenceTypes]);

  const currentYearInstances = useMemo(() => {
    if (!selectedType) return 0;
    const currentYear = new Date().getFullYear().toString();
    return requests.filter(
      (r) =>
        r.absence_type === selectedType.name &&
        r.start_date.startsWith(currentYear) &&
        (r.status === "pending" || r.status === "approved"),
    ).length;
  }, [selectedType, requests]);

  const currentQuota = useMemo(
    () => quotas.find((q) => q.absence_type_id === selectedTypeId) ?? null,
    [quotas, selectedTypeId],
  );

  /** Live balance projection — recalculates on every type/date change */
  const projection: ProjectionResult | null = useMemo(() => {
    if (!selectedType || !startDate || !endDate) return null;
    return projectAbsenceBalance({
      currentBalance: currentQuota?.remaining_days ?? 0,
      startDate,
      endDate,
      absenceType: {
        category: selectedType.category,
        countWeekends: selectedType.count_weekends,
        maxDaysPerInstance: selectedType.max_days_per_instance,
        maxInstancesPerYear: selectedType.max_instances_per_year,
        currentYearInstances,
      },
      holidays: supplementRulesData?.holidays ?? [],
      existingRequests: requests
        .filter((r) => r.status === "pending" || r.status === "approved")
        .map((r) => ({
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status,
        })),
    });
  }, [selectedType, startDate, endDate, currentQuota, currentYearInstances, requests]);

  const canSubmit =
    !!selectedType && !!startDate && !!endDate && (projection?.isAllowed ?? false) && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !startDate || !endDate || !projection?.isAllowed) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await requestAbsence({
        absenceType: selectedType.name,
        shiftDate: startDate,
        startDate,
        endDate,
        comment: comment.trim() || undefined,
      });
      setSelectedTypeId(null);
      setStartDate("");
      setEndDate("");
      setComment("");
    } catch (error) {
      const message = error instanceof Error ? error.message : strings.payroll.requestFailed;
      Alert.alert(strings.payroll.requestFailedTitle, message);
    } finally {
      setSubmitting(false);
    }
  }, [selectedType, startDate, endDate, comment, projection, requestAbsence]);

  const handleCancel = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cancelAbsence(id);
    },
    [cancelAbsence],
  );

  const handleStartDateInput = useCallback(
    (text: string) => {
      setStartDate(text);
      if (text.length === 10 && (!endDate || text > endDate)) {
        setEndDate(text);
      }
    },
    [endDate],
  );

  if (balanceLoading || requestsLoading || absenceTypesQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{strings.common.loading}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Title ── */}
      <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.hero}>
        <Text style={styles.heroTitle}>Registrer</Text>
        <Text style={styles.heroTitleItalic}>fravaer</Text>
      </Animated.View>

      {/* ── Balance Cards — 3-col square grid ── */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400).springify()}
        style={styles.balanceGrid}
      >
        {quotas.map((quota) => {
          const absType = absenceTypes.find((t) => t.id === quota.absence_type_id);
          const category = absType?.category ?? "vacation";
          const accentKey = CATEGORY_COLOR_KEYS[category]?.colorKey;
          const accent = accentKey ? theme.colors[accentKey] : theme.colors.mutedForeground;
          const Icon = getCategoryIcon(category);
          const remaining = quota.remaining_days ?? 0;
          const entitled = quota.entitled_days;
          const typeName = typeNameMap.get(quota.absence_type_id) ?? "Fravaer";

          /* Short label for the card */
          const shortLabel =
            category === "vacation"
              ? "Ferie"
              : category === "sick_self"
                ? "Egenm."
                : category === "care_of_child"
                  ? "Omsorg"
                  : typeName;

          return (
            <View key={quota.id} style={styles.balanceCard}>
              <View style={[styles.balanceCardAccent, { backgroundColor: accent }]} />
              <View style={styles.balanceCardBody}>
                <Icon size={18} color={accent} strokeWidth={1.5} />
                <Text style={styles.balanceCardLabel}>{shortLabel}</Text>
                <Text style={styles.balanceCardValue}>{remaining}</Text>
                <Text style={styles.balanceCardUnit}>
                  {category === "sick_self" ? `/ ${entitled}` : "dager"}
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* ── Request Form Card ── */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400).springify()}
        style={styles.formCard}
      >
        {/* Type picker pills */}
        <Text style={styles.fieldLabel}>Type fravaer</Text>
        <View style={styles.typePickerRow}>
          {absenceTypes.map((type) => {
            const isSelected = type.id === selectedTypeId;
            const accentColorKey = CATEGORY_COLOR_KEYS[type.category]?.colorKey;
            const accent = accentColorKey
              ? theme.colors[accentColorKey]
              : theme.colors.mutedForeground;

            return (
              <Pressable
                key={type.id}
                style={[
                  styles.typePill,
                  isSelected && {
                    backgroundColor: withOpacity(accent, 0.15),
                    borderColor: accent,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedTypeId(type.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.typePillText,
                    isSelected && { color: theme.colors.foreground, fontWeight: "600" },
                  ]}
                >
                  {type.name_no ?? type.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date range — 2-col grid with calendar icons */}
        <Text style={styles.fieldLabel}>Periode</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateFieldWrapper}>
            <View style={styles.dateInputWrapper}>
              <Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Input
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={handleStartDateInput}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.dateInput}
              />
            </View>
            <Text style={styles.dateHint}>Fra dato</Text>
          </View>

          <View style={styles.dateFieldWrapper}>
            <View style={styles.dateInputWrapper}>
              <Calendar size={16} color={theme.colors.mutedForeground} strokeWidth={1.5} />
              <Input
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.dateInput}
              />
            </View>
            <Text style={styles.dateHint}>Til dato</Text>
          </View>
        </View>

        {/* Live balance projection — green tinted card */}
        {projection && projection.isAllowed && (
          <View style={styles.projectionCard}>
            <Text style={styles.projectionTitle}>{projection.requestedDays} virkedager valgt</Text>
            <Text style={styles.projectionSubtitle}>
              Saldo etter: {projection.balanceAfter} dager
            </Text>
          </View>
        )}

        {/* Blocked projection — red warning */}
        {projection && !projection.isAllowed && (
          <View style={styles.projectionBlocked}>
            <Text style={styles.projectionBlockedText}>
              {projection.warnings[0] ?? strings.payroll.insufficientBalance}
            </Text>
            {projection.warnings.length > 1 &&
              projection.warnings.slice(1).map((warning, idx) => (
                <Text key={idx} style={styles.projectionWarningText}>
                  {warning}
                </Text>
              ))}
          </View>
        )}

        {/* Comment */}
        <Input
          label={strings.payroll.commentOptional}
          placeholder={strings.payroll.commentPlaceholder}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Send CTA — gradient pill */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Send size={18} color="#ffffff" strokeWidth={2} />
              <Text style={styles.submitButtonText}>Send soknad</Text>
            </>
          )}
        </Pressable>
      </Animated.View>

      {/* ── History: Mine soknader ── */}
      {requests.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(350).duration(400).springify()}
          style={styles.historySection}
        >
          <Text style={styles.sectionTitle}>Mine soknader</Text>

          {requests.map((request, _index) => {
            const statusDisplay = getStatusDisplay(request.status);
            const typeName = typeNameMap.get(request.absence_type) ?? request.absence_type;
            const isPending = request.status === "pending";

            return (
              <View key={request.schedule_absence_id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyType}>{typeName}</Text>
                    <Text style={styles.historyDates}>
                      {formatDateShort(request.start_date)}
                      {request.start_date !== request.end_date &&
                        ` - ${formatDateShort(request.end_date)}`}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: withOpacity(statusDisplay.color, 0.12) },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusDisplay.color }]} />
                      <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>
                        {statusDisplay.label}
                      </Text>
                    </View>
                    {isPending && (
                      <Pressable
                        onPress={() => handleCancel(request.schedule_absence_id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={strings.payroll.cancelRequest}
                      >
                        <Text style={styles.cancelText}>Avbryt</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.element,
  },
  loadingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  /* ── Hero ── */
  hero: {
    paddingTop: theme.spacing.page,
    paddingBottom: theme.spacing.section,
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "300" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
  },
  heroTitleItalic: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
  },

  /* ── Balance Grid — 3-col squares ── */
  balanceGrid: {
    flexDirection: "row" as const,
    gap: theme.spacing.element,
    marginBottom: theme.spacing.section,
  },
  balanceCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden" as const,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
  },
  balanceCardAccent: {
    height: 3,
  },
  balanceCardBody: {
    flex: 1,
    padding: theme.spacing.element,
    justifyContent: "space-between" as const,
  },
  balanceCardLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },
  balanceCardValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700" as const,
    color: theme.colors.foreground,
  },
  balanceCardUnit: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
  },

  /* ── Form Card ── */
  formCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.card,
    gap: theme.spacing.element,
    marginBottom: theme.spacing.section,
  },
  fieldLabel: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.foreground,
    marginTop: theme.spacing.xs,
  },

  /* Type picker pills */
  typePickerRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.tight,
  },
  typePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.colors.border,
    backgroundColor: "transparent",
  },
  typePillText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },

  /* Date range — 2-col */
  dateRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.element,
  },
  dateFieldWrapper: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dateInputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.border,
  },
  dateInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
  },
  dateHint: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginLeft: theme.spacing.xs,
  },

  /* Projection — green tinted card */
  projectionCard: {
    backgroundColor: withOpacity(theme.colors.success, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.success, 0.15),
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    gap: 2,
  },
  projectionTitle: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.success,
  },
  projectionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.success,
  },
  projectionBlocked: {
    backgroundColor: withOpacity(theme.colors.destructive, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.15),
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    gap: 4,
  },
  projectionBlockedText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.destructive,
  },
  projectionWarningText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
  },

  /* Submit CTA — gradient pill */
  submitButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.tight,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    marginTop: theme.spacing.tight,
    ...theme.shadows.lg,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  submitButtonText: {
    ...theme.typography.bodyBold,
    color: "#ffffff",
  },

  /* ── History Section ── */
  historySection: {
    gap: theme.spacing.element,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  historyCard: {
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
  },
  historyRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  historyLeft: {
    flex: 1,
    marginRight: theme.spacing.element,
  },
  historyType: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.foreground,
  },
  historyDates: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  historyRight: {
    alignItems: "flex-end" as const,
    gap: theme.spacing.xs,
  },
  statusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.semibold,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  cancelText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.destructive,
  },
}));
