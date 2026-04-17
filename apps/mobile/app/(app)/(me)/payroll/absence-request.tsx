/**
 * Registrer frav\u00e6r — Absence request with balance cards + form.
 *
 * Fetches real data from:
 * - useAbsenceBalance() for quota balances (Ferie, Egenmelding, Omsorgsdager)
 * - useAbsenceTypes() for the type selector pills
 * - useMyAbsenceRequests() for the history list
 * - useRequestAbsence() for submitting new absence requests
 *
 * Layout:
 * 1. Balance cards (3-col): dynamic from absence_quota
 * 2. Request form: type pills, date range, projection, submit
 * 3. History: Mine s\u00f8knader with status badges
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Palmtree, Stethoscope, Heart, Calendar, Check, Send, FileText } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useAbsenceBalance } from "@/hooks/queries/use-absence-balance";
import { useAbsenceTypes } from "@/hooks/queries/use-absence-types";
import { useMyAbsenceRequests } from "@/hooks/queries/use-my-absence-requests";
import { useRequestAbsence } from "@/hooks/mutations/use-request-absence";

/* ── Types & Config ── */

const STATUS_CONFIG = {
  pending: {
    label: "Venter",
    color: "#c18200",
    bgColor: "rgba(193,130,0,0.06)",
    borderColor: "rgba(193,130,0,0.2)",
  },
  approved: {
    label: "Godkjent",
    color: "#11ad32",
    bgColor: "rgba(17,173,50,0.06)",
    borderColor: "rgba(17,173,50,0.2)",
  },
  rejected: {
    label: "Avvist",
    color: "#ba1a1a",
    bgColor: "rgba(186,26,26,0.06)",
    borderColor: "rgba(186,26,26,0.2)",
  },
} as const;

/** Maps absence type categories to display icons */
const CATEGORY_ICONS: Record<string, typeof Palmtree> = {
  vacation: Palmtree,
  sick_leave: Stethoscope,
  care_days: Heart,
  leave: FileText,
};

/** Picks the right icon for an absence type name (fallback to FileText) */
function getIconForAbsenceType(name: string): typeof Palmtree {
  const lower = name.toLowerCase();
  if (lower.includes("ferie")) return Palmtree;
  if (lower.includes("syk") || lower.includes("egenmelding")) return Stethoscope;
  if (lower.includes("omsorg")) return Heart;
  return FileText;
}

/** Format a date string to "DD.MM" */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}`;
}

/** Compute business days between two dates */
function countBusinessDays(start: string, end: string): number {
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Parse DD.MM or DD.MM.YYYY input to YYYY-MM-DD */
function parseDateInput(input: string): string | null {
  const parts = input.split(".");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/* ── Component ── */

export default function AbsenceRequestScreen() {
  const styles = useStyles();
  const theme = useTheme();

  const { data: balanceData, isLoading: loadingBalance } = useAbsenceBalance();
  const { data: absenceTypes, isLoading: loadingTypes } = useAbsenceTypes();
  const { data: requestsData, isLoading: loadingRequests } = useMyAbsenceRequests();
  const { requestAbsence } = useRequestAbsence();

  const [selectedType, setSelectedType] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build type options from real absence types, falling back to defaults
  const typeOptions = useMemo(() => {
    if (absenceTypes && absenceTypes.length > 0) {
      return absenceTypes.map((t) => ({
        id: t.id,
        label: t.name_no ?? t.name,
      }));
    }
    return [
      { id: "ferie", label: "Ferie" },
      { id: "sykdom", label: "Sykdom" },
      { id: "permisjon", label: "Permisjon" },
    ];
  }, [absenceTypes]);

  // Build balance cards from real quota data — show up to 3
  const balanceCards = useMemo(() => {
    if (!balanceData?.quotas || balanceData.quotas.length === 0) return [];

    // Look up absence type names from the types list
    const typeMap = new Map((absenceTypes ?? []).map((t) => [t.id, t.name_no ?? t.name]));

    return balanceData.quotas.slice(0, 3).map((quota) => {
      const name = typeMap.get(quota.absence_type_id) ?? "Frav\u00e6r";
      const total = quota.entitled_days + quota.adjusted_days + quota.carried_over_days;
      const remaining = quota.remaining_days ?? 0;
      return { name, total, remaining };
    });
  }, [balanceData?.quotas, absenceTypes]);

  // Compute projection from date inputs
  const projection = useMemo(() => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    if (!start || !end) return null;
    const days = countBusinessDays(start, end);
    if (days <= 0) return null;

    // Find remaining balance for the currently selected type
    const selectedTypeId = typeOptions[selectedType]?.id;
    const currentQuota = balanceData?.quotas?.find((q) => q.absence_type_id === selectedTypeId);
    const remaining = currentQuota ? (currentQuota.remaining_days ?? 0) : null;

    return {
      days,
      afterBalance: remaining !== null ? remaining - days : null,
    };
  }, [startDate, endDate, selectedType, typeOptions, balanceData?.quotas]);

  const handleSubmit = useCallback(async () => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    if (!start || !end) {
      Alert.alert("Ugyldig dato", "Vennligst fyll inn gyldige datoer (DD.MM).");
      return;
    }

    const selectedOption = typeOptions[selectedType];
    if (!selectedOption) return;

    setIsSubmitting(true);
    try {
      await requestAbsence({
        absenceType: selectedOption.label,
        shiftDate: start,
        startDate: start,
        endDate: end,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sendt", "Frav\u00e6rss\u00f8knaden din er registrert.");
      setStartDate("");
      setEndDate("");
    } catch {
      Alert.alert("Feil", "Kunne ikke sende s\u00f8knaden. Pr\u00f8v igjen.");
    } finally {
      setIsSubmitting(false);
    }
  }, [startDate, endDate, selectedType, typeOptions, requestAbsence]);

  const requests = requestsData?.requests ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Balance Cards — up to 3-col from real quotas */}
      {loadingBalance ? (
        <View style={styles.balanceRow}>
          <View
            style={[
              styles.balanceCard,
              { alignItems: "center" as const, justifyContent: "center" as const },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          </View>
        </View>
      ) : balanceCards.length > 0 ? (
        <View style={styles.balanceRow}>
          {balanceCards.map((card, i) => (
            <View
              key={card.name}
              style={[
                styles.balanceCard,
                i === balanceCards.length - 1 && styles.balanceCardAccent,
              ]}
            >
              <Text style={styles.balanceLabel}>{card.name}</Text>
              <View style={styles.balanceBottom}>
                <Text style={styles.balanceValue}>{card.remaining}</Text>
                <Text style={styles.balanceUnit}> / {card.total}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Ingen frav\u00e6rskvoter satt opp enn\u00e5</Text>
        </View>
      )}

      {/* Request Form */}
      <View style={styles.formCard}>
        {/* Type pills */}
        <Text style={styles.fieldLabel}>Type frav\u00e6r</Text>
        <View style={styles.typeRow}>
          {loadingTypes ? (
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          ) : (
            typeOptions.map((type, i) => (
              <Pressable
                key={type.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(i);
                }}
                style={[styles.typePill, selectedType === i && styles.typePillActive]}
              >
                <Text
                  style={[styles.typePillText, selectedType === i && styles.typePillTextActive]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Date range */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Fra dato</Text>
            <View style={styles.dateInput}>
              <TextInput
                style={styles.dateInputText}
                placeholder="DD.MM"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numbers-and-punctuation"
              />
              <Calendar
                size={16}
                color={withOpacity(theme.colors.mutedForeground, 0.4)}
                strokeWidth={1.5}
              />
            </View>
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Til dato</Text>
            <View style={styles.dateInput}>
              <TextInput
                style={styles.dateInputText}
                placeholder="DD.MM"
                placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numbers-and-punctuation"
              />
              <Calendar
                size={16}
                color={withOpacity(theme.colors.mutedForeground, 0.4)}
                strokeWidth={1.5}
              />
            </View>
          </View>
        </View>

        {/* Projection — only shown when both dates are valid */}
        {projection && (
          <View style={styles.projectionCard}>
            <View style={styles.projectionLeft}>
              <View style={styles.projectionRow}>
                <Check size={14} color="#16a34a" strokeWidth={2.5} />
                <Text style={styles.projectionText}>{projection.days} virkedager valgt</Text>
              </View>
              <Text style={styles.projectionCaption}>Beregnet frav\u00e6r for perioden</Text>
            </View>
            {projection.afterBalance !== null && (
              <View style={styles.projectionRight}>
                <Text style={styles.projectionAfterLabel}>Saldo etter:</Text>
                <Text style={styles.projectionAfterValue}>{projection.afterBalance} dager</Text>
              </View>
            )}
          </View>
        )}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitPressed,
            isSubmitting && { opacity: 0.6 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitText}>Send s\u00f8knad</Text>
              <Send size={18} color="#ffffff" strokeWidth={2} />
            </>
          )}
        </Pressable>
      </View>

      {/* History */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Mine s\u00f8knader</Text>
          <Pressable onPress={() => Haptics.selectionAsync()}>
            <Text style={styles.historyViewAll}>Se alle</Text>
          </Pressable>
        </View>

        {loadingRequests && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          </View>
        )}

        {!loadingRequests && requests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ingen s\u00f8knader enn\u00e5</Text>
          </View>
        )}

        {requests.slice(0, 10).map((entry) => {
          const IconComponent = getIconForAbsenceType(entry.absence_type);
          const status =
            STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
          const isPending = entry.status === "pending";

          return (
            <View
              key={entry.schedule_absence_id}
              style={[styles.historyRow, !isPending && styles.historyRowFaded]}
            >
              <View style={styles.historyLeft}>
                <View style={styles.historyIcon}>
                  <IconComponent
                    size={20}
                    color={isPending ? theme.colors.brandOrange : theme.colors.mutedForeground}
                    strokeWidth={1.5}
                  />
                </View>
                <View>
                  <Text style={styles.historyName}>{entry.absence_type}</Text>
                  <Text style={styles.historyDates}>
                    {formatShortDate(entry.start_date)} \u2014 {formatShortDate(entry.end_date)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: status.bgColor, borderColor: status.borderColor },
                ]}
              >
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
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
    paddingBottom: 160,
  },

  /* Balance Cards — 3-col squares */
  balanceRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.element,
    marginBottom: theme.spacing.page,
  },
  balanceCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    justifyContent: "space-between" as const,
  },
  balanceCardAccent: {
    borderWidth: 2,
    borderColor: withOpacity(theme.colors.brandOrange, 0.05),
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
  },
  balanceBottom: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  balanceUnit: {
    fontSize: 14,
    color: withOpacity(theme.colors.foreground, 0.6),
  },

  /* Form */
  formCard: {
    backgroundColor: theme.isDark ? theme.colors.card : "#ffffff",
    borderRadius: theme.radius.xl,
    padding: theme.spacing.page,
    gap: theme.spacing.section,
    marginBottom: theme.spacing.page,
    ...theme.shadows.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: theme.colors.mutedForeground,
    marginLeft: 2,
  },
  typeRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.tight,
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
  },
  typePillActive: {
    backgroundColor: theme.colors.brandOrange,
  },
  typePillText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  typePillTextActive: {
    color: "#ffffff",
  },
  dateRow: {
    flexDirection: "row" as const,
    gap: theme.spacing.md,
  },
  dateField: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dateInput: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  dateInputText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },

  /* Projection */
  projectionCard: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    backgroundColor: "#f0f4f1",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(209,224,212,0.3)",
  },
  projectionLeft: {
    gap: 4,
  },
  projectionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  projectionText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "#166534",
  },
  projectionCaption: {
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: "rgba(22,101,52,0.6)",
  },
  projectionRight: {
    alignItems: "flex-end" as const,
  },
  projectionAfterLabel: {
    fontSize: 11,
    color: "rgba(22,101,52,0.6)",
  },
  projectionAfterValue: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: "#166534",
  },

  /* Submit */
  submitButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.tight,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    ...theme.shadows.lg,
  },
  submitPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  submitText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: "#ffffff",
  },

  /* History */
  historySection: {
    gap: theme.spacing.element,
  },
  historyHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: "300" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
  },
  historyViewAll: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },
  historyRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: theme.isDark ? theme.colors.card : theme.colors.secondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.card,
  },
  historyRowFaded: {
    opacity: 0.7,
  },
  historyLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  historyName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: theme.colors.foreground,
  },
  historyDates: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500" as const,
    textTransform: "uppercase" as const,
  },

  /* Empty / Loading states */
  emptyState: {
    paddingVertical: theme.spacing.page,
    alignItems: "center" as const,
    marginBottom: theme.spacing.page,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
  },
}));
