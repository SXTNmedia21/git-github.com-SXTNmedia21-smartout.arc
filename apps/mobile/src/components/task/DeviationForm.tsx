/**
 * DeviationForm — Bottom sheet for reporting operational deviations.
 *
 * Accessible from any context (task feed, shift view, standalone FAB action).
 * Designed for minimal friction: domain chips, severity picker, title, description.
 * Submit enqueues to the sync queue for offline safety.
 *
 * Domain categories match the deviation_domain enum:
 *   safety | customer | procedure | system | material
 */
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Keyboard } from "react-native";
import * as Haptics from "expo-haptics";

import { Button, Input } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";

import { strings } from "@/constants/strings";
import {
  useReportDeviation,
  type DeviationDomain,
  type DeviationSeverity,
  type DeviationPayload,
} from "@/hooks/mutations/use-report-deviation";

type DeviationFormProps = {
  profileId: string;
  workspaceId: string;
  /** Optional context — pre-fills department/session/shift if reporting from a shift */
  departmentId?: string | null;
  sessionId?: string | null;
  shiftId?: string | null;
  onComplete: () => void;
};

/** Domain options with Norwegian labels */
const DOMAIN_OPTIONS: { value: DeviationDomain; label: string }[] = [
  { value: "safety", label: "Sikkerhet" },
  { value: "customer", label: "Kunde" },
  { value: "procedure", label: "Prosedyre" },
  { value: "system", label: "System" },
  { value: "material", label: "Materiell" },
];

/** Severity options with Norwegian labels and theme color keys */
const SEVERITY_OPTIONS: { value: DeviationSeverity; label: string; colorKey: string }[] = [
  { value: "low", label: "Lav", colorKey: "mutedForeground" },
  { value: "medium", label: "Middels", colorKey: "warning" },
  { value: "high", label: "H\u00F8y", colorKey: "brandOrange" },
  { value: "critical", label: "Kritisk", colorKey: "destructive" },
];

export function DeviationForm({
  profileId,
  workspaceId,
  departmentId,
  sessionId,
  shiftId,
  onComplete,
}: DeviationFormProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { reportDeviation, isSubmitting } = useReportDeviation();

  const [domain, setDomain] = useState<DeviationDomain | null>(null);
  const [severity, setSeverity] = useState<DeviationSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = domain !== null && title.trim().length > 0;

  const handleSelectDomain = useCallback((value: DeviationDomain) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDomain(value);
  }, []);

  const handleSelectSeverity = useCallback((value: DeviationSeverity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSeverity(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !domain || isSubmitting) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();

    const payload: DeviationPayload = {
      domain,
      severity,
      title: title.trim(),
      description: description.trim() || null,
      department_id: departmentId ?? null,
      session_id: sessionId ?? null,
      linked_shift_id: shiftId ?? null,
      // reported_by and workspace_id resolved server-side via getProfileContext()
      // inside useReportDeviation — ADR-0134, not supplied by caller
    };

    await reportDeviation(payload);
    onComplete();
  }, [
    canSubmit,
    domain,
    severity,
    title,
    description,
    departmentId,
    sessionId,
    shiftId,
    isSubmitting,
    reportDeviation,
    onComplete,
  ]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Domain picker — selectable chips */}
      <View style={styles.field}>
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.chipRow}>
          {DOMAIN_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => handleSelectDomain(opt.value)}
              style={[styles.chip, domain === opt.value && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: domain === opt.value }}
            >
              <Text style={[styles.chipText, domain === opt.value && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Severity picker — horizontal options with color indicators */}
      <View style={styles.field}>
        <Text style={styles.label}>Alvorlighetsgrad</Text>
        <View style={styles.severityRow}>
          {SEVERITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => handleSelectSeverity(opt.value)}
              style={[
                styles.severityOption,
                severity === opt.value && {
                  borderColor: (colors as Record<string, string>)[opt.colorKey],
                  borderWidth: 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: severity === opt.value }}
            >
              <View
                style={[
                  styles.severityDot,
                  { backgroundColor: (colors as Record<string, string>)[opt.colorKey] },
                ]}
              />
              <Text
                style={[styles.severityText, severity === opt.value && styles.severityTextSelected]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Title — required, short description */}
      <Input
        label="Tittel"
        value={title}
        onChangeText={setTitle}
        placeholder="Kort beskrivelse av avviket..."
        maxLength={100}
      />

      {/* Description — optional, longer context */}
      <Input
        label="Beskrivelse (valgfritt)"
        value={description}
        onChangeText={setDescription}
        placeholder="Gi mer kontekst om hva som skjedde..."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Submit button — thumb zone */}
      <View style={styles.submitArea}>
        <Button
          title={strings.tasks.reportDeviation}
          variant="destructive"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.section,
  },
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },

  /* Domain chips — wrap horizontally */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.tight,
  },
  chip: {
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  chipTextSelected: {
    color: theme.colors.primaryForeground,
  },

  /* Severity row */
  severityRow: {
    flexDirection: "row",
    gap: theme.spacing.tight,
  },
  severityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
  },
  severityText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },
  severityTextSelected: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.semibold,
  },

  submitArea: {
    marginTop: theme.spacing.md,
  },
}));
