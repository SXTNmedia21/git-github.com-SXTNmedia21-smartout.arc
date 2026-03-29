/**
 * AbsenceRequestScreen — Balance-first absence request form with live projection.
 *
 * Layout (Planday-inspired):
 * 1. Top: Horizontal balance cards (Ferie, Egenmelding, Omsorgsdager)
 * 2. Middle: Request form with type picker, date range, live projection, comment
 * 3. Bottom: "Mine soknader" history list with cancel support
 *
 * The projection recalculates on every type/date change using the pure
 * projectAbsenceBalance() function — no network round-trip needed.
 */

import React, { useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { createStyles, useTheme, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/common/SectionHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { strings } from "@/constants/strings";
import { useAbsenceBalance } from "@/hooks/queries/use-absence-balance";
import { useAbsenceTypes } from "@/hooks/queries/use-absence-types";
import { useMyAbsenceRequests } from "@/hooks/queries/use-my-absence-requests";
import { useSupplementRules } from "@/hooks/queries/use-supplement-rules";
import { useRequestAbsence } from "@/hooks/mutations/use-request-absence";
import { useCancelAbsence } from "@/hooks/mutations/use-cancel-absence";
import { projectAbsenceBalance } from "@/lib/absence-projection";
import type { ProjectionResult } from "@/lib/absence-projection";

// UI Events:
// - action: requestAbsence() (submit button)
// - action: cancelAbsence(id) (cancel button on pending request)
// - action: selectAbsenceType(type) (type picker row press)
// - action: pickStartDate / pickEndDate (date field press)
// - color-regime: balance-health-based (green > 20%, amber < 20%, red = 0)

const CATEGORY_COLOR_KEYS: Record<
  string,
  { colorKey: keyof ReturnType<typeof useTheme>["colors"]; label: string }
> = {
  vacation: { colorKey: "success", label: strings.payroll.vacation },
  sick_self: { colorKey: "warning", label: strings.payroll.selfReported },
  care_of_child: { colorKey: "brandPurple", label: strings.payroll.careDays },
};

/** Maps schedule_absence.status to StatusBadge variant + label */
function getStatusDisplay(status: string): {
  variant: "warning" | "success" | "destructive" | "muted";
  label: string;
} {
  switch (status) {
    case "pending":
      return { variant: "warning", label: strings.payroll.pending };
    case "approved":
      return { variant: "success", label: strings.payroll.approved };
    case "rejected":
      return { variant: "destructive", label: strings.payroll.rejected };
    case "cancelled":
      return { variant: "muted", label: strings.payroll.cancelled };
    default:
      return { variant: "muted", label: status };
  }
}

/** Format ISO date as "DD. mon" for compact display in request rows */
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

export function AbsenceRequestScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { data: balanceData, isLoading: balanceLoading } = useAbsenceBalance();
  const { data: requestsData, isLoading: requestsLoading } = useMyAbsenceRequests();
  const { data: supplementRulesData } = useSupplementRules();
  const { requestAbsence } = useRequestAbsence();
  const { cancelAbsence } = useCancelAbsence();

  const absenceTypesQuery = useAbsenceTypes();

  // Form state
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const absenceTypes = absenceTypesQuery.data ?? [];
  const quotas = balanceData?.quotas ?? [];
  const requests = requestsData?.requests ?? [];

  /** Currently selected absence type object */
  const selectedType = useMemo(
    () => absenceTypes.find((t) => t.id === selectedTypeId) ?? null,
    [absenceTypes, selectedTypeId],
  );

  /** Map absence_type_id → display name */
  const typeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of absenceTypes) {
      map.set(t.id, t.name_no ?? t.name);
    }
    return map;
  }, [absenceTypes]);

  /** Count current-year instances of the selected type from existing requests.
   *
   * schedule_absence.absence_type is a free-text name string (not a UUID FK),
   * so we match against the type's name field, not its id. */
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

  /** Find the quota for the currently selected type */
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

  /** Submit absence request */
  const handleSubmit = useCallback(async () => {
    if (!selectedType || !startDate || !endDate || !projection?.isAllowed) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await requestAbsence({
        // absence_type is a free-text name on the DB row, not a UUID
        absenceType: selectedType.name,
        // shift_date is required by the schema — use startDate as the anchor date
        shiftDate: startDate,
        startDate,
        endDate,
        comment: comment.trim() || undefined,
      });
      // Reset form only after a successful submit — not on error
      setSelectedTypeId(null);
      setStartDate("");
      setEndDate("");
      setComment("");
    } catch (error) {
      // Surface the error to the user — do NOT reset the form so they can retry
      const message = error instanceof Error ? error.message : strings.payroll.requestFailed;
      Alert.alert(strings.payroll.requestFailedTitle, message);
    } finally {
      setSubmitting(false);
    }
  }, [selectedType, startDate, endDate, comment, projection, requestAbsence]);

  /** Cancel a pending absence request */
  const handleCancel = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cancelAbsence(id);
    },
    [cancelAbsence],
  );

  /** Validate and set a date string (YYYY-MM-DD format) */
  const handleStartDateInput = useCallback(
    (text: string) => {
      setStartDate(text);
      // Auto-set end date if not set or if end < start
      if (text.length === 10 && (!endDate || text > endDate)) {
        setEndDate(text);
      }
    },
    [endDate],
  );

  // Loading state
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
    >
      {/* Top: Balance cards — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.balanceCardsRow}
        style={styles.balanceCardsScroll}
      >
        {quotas.map((quota) => {
          const typeName = typeNameMap.get(quota.absence_type_id) ?? strings.payroll.unknownType;
          const remaining = quota.remaining_days ?? 0;
          const entitled = quota.entitled_days;
          const absType = absenceTypes.find((t) => t.id === quota.absence_type_id);
          const accentKey = absType ? CATEGORY_COLOR_KEYS[absType.category]?.colorKey : undefined;
          const accent = accentKey ? theme.colors[accentKey] : theme.colors.mutedForeground;

          return (
            <View key={quota.id} style={styles.balanceCard}>
              <View style={[styles.balanceCardAccent, { backgroundColor: accent }]} />
              <Card style={styles.balanceCardInner}>
                <Text style={styles.balanceCardLabel} numberOfLines={1}>
                  {typeName}
                </Text>
                <Text style={styles.balanceCardValue}>
                  {remaining}
                  <Text style={styles.balanceCardTotal}> / {entitled}</Text>
                </Text>
                <Text style={styles.balanceCardUnit}>{strings.payroll.daysRemaining}</Text>
              </Card>
            </View>
          );
        })}
      </ScrollView>

      {/* Middle: Request form */}
      <Card style={styles.formCard}>
        <SectionHeader title={strings.payroll.requestAbsence} />

        {/* Type picker — inline scrollable list */}
        <Text style={styles.fieldLabel}>{strings.payroll.absenceType}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typePickerRow}
        >
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
                  isSelected && { backgroundColor: withOpacity(accent, 0.15), borderColor: accent },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedTypeId(type.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.typePillDot, { backgroundColor: accent }]} />
                <Text
                  style={[styles.typePillText, isSelected && { color: theme.colors.foreground }]}
                >
                  {type.name_no ?? type.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Date range fields — simple text inputs with YYYY-MM-DD format for MVP */}
        <Text style={styles.fieldLabel}>{strings.payroll.period}</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateFieldWrapper}>
            <Input
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={handleStartDateInput}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={styles.dateInput}
            />
            <Text style={styles.dateHint}>{strings.payroll.fromDate}</Text>
          </View>

          <Text style={styles.dateSeparator}>–</Text>

          <View style={styles.dateFieldWrapper}>
            <Input
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={styles.dateInput}
            />
            <Text style={styles.dateHint}>{strings.payroll.toDate}</Text>
          </View>
        </View>

        {/* Live balance projection */}
        {projection && (
          <View
            style={[
              styles.projectionBanner,
              projection.isAllowed ? styles.projectionAllowed : styles.projectionBlocked,
            ]}
          >
            {projection.isAllowed ? (
              <Text style={styles.projectionTextAllowed}>
                {projection.requestedDays} {strings.payroll.workdays} ·{" "}
                {strings.payroll.balanceAfter}: {projection.balanceAfter} dager
              </Text>
            ) : (
              <Text style={styles.projectionTextBlocked}>
                {projection.warnings[0] ?? strings.payroll.insufficientBalance}
              </Text>
            )}
            {/* Show additional warnings below the primary message */}
            {projection.warnings.length > 1 &&
              projection.warnings.slice(1).map((warning, idx) => (
                <Text key={idx} style={styles.projectionWarning}>
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

        {/* Submit button */}
        <Button
          title={strings.payroll.sendRequest}
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          fullWidth
        />
      </Card>

      {/* Bottom: Request history */}
      {requests.length > 0 && (
        <View style={styles.historySection}>
          <SectionHeader title={strings.payroll.myRequests} />
          <Card>
            {requests.map((request, index) => {
              const statusDisplay = getStatusDisplay(request.status);
              const typeName = typeNameMap.get(request.absence_type) ?? request.absence_type;
              const isPending = request.status === "pending";

              return (
                <View key={request.schedule_absence_id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.requestRow}>
                    <View style={styles.requestLeft}>
                      <Text style={styles.requestType}>{typeName}</Text>
                      <Text style={styles.requestDates}>
                        {formatDateShort(request.start_date)}
                        {request.start_date !== request.end_date &&
                          ` – ${formatDateShort(request.end_date)}`}
                      </Text>
                    </View>
                    <View style={styles.requestRight}>
                      <StatusBadge label={statusDisplay.label} variant={statusDisplay.variant} />
                      {isPending && (
                        <Pressable
                          onPress={() => handleCancel(request.schedule_absence_id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={strings.payroll.cancelRequest}
                        >
                          <Text style={styles.cancelText}>{strings.payroll.cancelRequest}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
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
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
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

  /* Balance cards — horizontal scroll row */
  balanceCardsScroll: {
    marginBottom: theme.spacing.section,
    marginHorizontal: -theme.spacing.card,
  },
  balanceCardsRow: {
    paddingHorizontal: theme.spacing.card,
    gap: theme.spacing.element,
  },
  balanceCard: {
    width: 140,
    overflow: "hidden" as const,
    borderRadius: 14,
  },
  balanceCardAccent: {
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  balanceCardInner: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: theme.spacing.element,
  },
  balanceCardLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
    marginBottom: theme.spacing.xs,
  },
  balanceCardValue: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  balanceCardTotal: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.regular,
  },
  balanceCardUnit: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xs,
  },

  /* Request form */
  formCard: {
    marginBottom: theme.spacing.section,
    gap: theme.spacing.element,
  },
  fieldLabel: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
    marginTop: theme.spacing.tight,
  },

  /* Type picker pills */
  typePickerRow: {
    gap: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
  },
  typePill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  typePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typePillText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },

  /* Date range fields */
  dateRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.tight,
  },
  dateFieldWrapper: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dateInput: {
    // No extra style needed — Input component handles it
  },
  dateHint: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  dateSeparator: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    marginTop: -theme.spacing.md,
  },

  /* Projection banner */
  projectionBanner: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  projectionAllowed: {
    backgroundColor: withOpacity(theme.colors.success, 0.1),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.success, 0.2),
  },
  projectionBlocked: {
    backgroundColor: withOpacity(theme.colors.destructive, 0.1),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.2),
  },
  projectionTextAllowed: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.success,
  },
  projectionTextBlocked: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.destructive,
  },
  projectionWarning: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    marginTop: theme.spacing.xs,
  },

  /* Request history */
  historySection: {
    gap: theme.spacing.tight,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  requestRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: theme.spacing.element,
  },
  requestLeft: {
    flex: 1,
    marginRight: theme.spacing.element,
  },
  requestType: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  requestDates: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  requestRight: {
    alignItems: "flex-end" as const,
    gap: theme.spacing.xs,
  },
  cancelText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.destructive,
  },
}));
