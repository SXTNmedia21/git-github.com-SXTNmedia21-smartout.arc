/**
 * Registrer fravær — Absence request with balance cards + form.
 *
 * Layout:
 * 1. Hero: "Registrer fravær" serif display
 * 2. Balance cards (3-col): Ferie, Egenmelding, Omsorgsdager
 * 3. Request form: type pills, date range, projection, submit
 * 4. History: Mine søknader with status badges
 */

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { Palmtree, Stethoscope, Calendar, Check, Send } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

/* ── Types & Data ── */

const ABSENCE_TYPES = ["Ferie", "Sykdom", "Permisjon"];

type HistoryEntry = {
  id: string;
  icon: typeof Palmtree;
  title: string;
  dates: string;
  status: "pending" | "approved" | "rejected";
};

const MOCK_HISTORY: HistoryEntry[] = [
  { id: "1", icon: Palmtree, title: "Sommerferie 2026", dates: "12.07 — 28.07", status: "pending" },
  { id: "2", icon: Stethoscope, title: "Egenmelding", dates: "04.03 — 05.03", status: "approved" },
];

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
};

/* ── Component ── */

export default function AbsenceRequestScreen() {
  const styles = useStyles();
  const theme = useTheme();

  const [selectedType, setSelectedType] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = useCallback(() => {
    Alert.alert("Ikke tilgjengelig", "Denne funksjonen er under utvikling.");
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Demo Banner */}
      <View
        style={{
          backgroundColor: "#fef3cd",
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: "#856404",
            fontSize: 13,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Demo — denne siden er under utvikling
        </Text>
      </View>

      {/* Balance Cards — 3-col */}
      <View style={styles.balanceRow}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Ferie</Text>
          <View style={styles.balanceBottom}>
            <Text style={styles.balanceValue}>18</Text>
            <Text style={styles.balanceUnit}> dager</Text>
          </View>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Egenm.</Text>
          <View style={styles.balanceBottom}>
            <Text style={styles.balanceValue}>3</Text>
            <Text style={styles.balanceUnit}> / 4</Text>
          </View>
        </View>
        <View style={[styles.balanceCard, styles.balanceCardAccent]}>
          <Text style={styles.balanceLabel}>Omsorg</Text>
          <View style={styles.balanceBottom}>
            <Text style={styles.balanceValue}>10</Text>
            <Text style={styles.balanceUnit}> dager</Text>
          </View>
        </View>
      </View>

      {/* Request Form */}
      <View style={styles.formCard}>
        {/* Type pills */}
        <Text style={styles.fieldLabel}>Type fravær</Text>
        <View style={styles.typeRow}>
          {ABSENCE_TYPES.map((type, i) => (
            <Pressable
              key={type}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedType(i);
              }}
              style={[styles.typePill, selectedType === i && styles.typePillActive]}
            >
              <Text style={[styles.typePillText, selectedType === i && styles.typePillTextActive]}>
                {type}
              </Text>
            </Pressable>
          ))}
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

        {/* Projection */}
        <View style={styles.projectionCard}>
          <View style={styles.projectionLeft}>
            <View style={styles.projectionRow}>
              <Check size={14} color="#16a34a" strokeWidth={2.5} />
              <Text style={styles.projectionText}>5 virkedager valgt</Text>
            </View>
            <Text style={styles.projectionCaption}>Beregnet fravær for perioden</Text>
          </View>
          <View style={styles.projectionRight}>
            <Text style={styles.projectionAfterLabel}>Saldo etter:</Text>
            <Text style={styles.projectionAfterValue}>13 dager</Text>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [styles.submitButton, pressed && styles.submitPressed]}
        >
          <Text style={styles.submitText}>Send søknad</Text>
          <Send size={18} color="#ffffff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* History */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Mine søknader</Text>
          <Pressable onPress={() => Haptics.selectionAsync()}>
            <Text style={styles.historyViewAll}>Se alle</Text>
          </Pressable>
        </View>

        {MOCK_HISTORY.map((entry) => {
          const IconComponent = entry.icon;
          const status = STATUS_CONFIG[entry.status];

          return (
            <View
              key={entry.id}
              style={[styles.historyRow, entry.status !== "pending" && styles.historyRowFaded]}
            >
              <View style={styles.historyLeft}>
                <View style={styles.historyIcon}>
                  <IconComponent
                    size={20}
                    color={
                      entry.status === "pending"
                        ? theme.colors.brandOrange
                        : theme.colors.mutedForeground
                    }
                    strokeWidth={1.5}
                  />
                </View>
                <View>
                  <Text style={styles.historyName}>{entry.title}</Text>
                  <Text style={styles.historyDates}>{entry.dates}</Text>
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

  /* Hero */
  heroTitle: {
    fontSize: 42,
    fontWeight: "400" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
    lineHeight: 46,
  },
  heroTitleLine2: {
    fontSize: 42,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: theme.colors.foreground,
    letterSpacing: -1,
    lineHeight: 46,
    marginBottom: theme.spacing.page,
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
}));
