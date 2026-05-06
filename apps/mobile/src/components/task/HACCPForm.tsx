/**
 * HACCPForm — Temperature logging form for HACCP compliance tasks.
 *
 * This is a legally required form (Mattilsynet food safety). Design priorities:
 *   - Dead simple: CCP reference (pre-filled), temperature, range toggle
 *   - Fast: large numeric input, thumb-zone submit button
 *   - Offline-safe: enqueues to sync queue, never blocks on connectivity
 *   - Corrective action field only appears when temperature is outside range
 *
 * Rule: "One screen, one task." No tabs, no navigation, no extra fields.
 */
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, TextInput, Keyboard } from "react-native";
import * as Haptics from "expo-haptics";

import { Button, Input } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { useLogHaccp, type HACCPPayload } from "@/hooks/mutations/use-log-haccp";
import type { SessionTask } from "./TaskModal";

type HACCPFormProps = {
  task: SessionTask;
  profileId: string;
  onComplete: () => void;
};

export function HACCPForm({ task, profileId, onComplete }: HACCPFormProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { logHaccp, isSubmitting } = useLogHaccp();

  const [temperature, setTemperature] = useState("");
  const [isWithinRange, setIsWithinRange] = useState(true);
  const [correctiveAction, setCorrectiveAction] = useState("");

  /** CCP reference comes from the task — e.g. "Kjoleskap A", "Fryser 2" */
  const ccpReference = task.ccp_reference ?? task.title;

  const isValid = temperature.trim().length > 0 && !isNaN(parseFloat(temperature));
  const needsCorrectiveAction = !isWithinRange;
  const canSubmit = isValid && (!needsCorrectiveAction || correctiveAction.trim().length > 0);

  const handleToggleRange = useCallback((withinRange: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsWithinRange(withinRange);
    /* Clear corrective action when switching back to within range */
    if (withinRange) setCorrectiveAction("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();

    const payload: HACCPPayload = {
      ccp_reference: ccpReference,
      temperature: parseFloat(temperature),
      unit: "\u00B0C",
      is_within_range: isWithinRange,
      corrective_action: needsCorrectiveAction ? correctiveAction.trim() : null,
      session_id: task.department_session_id,
      // profile_id and workspace_id resolved server-side via getProfileContext()
      // inside useLogHaccp \u2014 ADR-0134, not supplied by caller
    };

    await logHaccp(payload);
    onComplete();
  }, [
    canSubmit,
    isSubmitting,
    ccpReference,
    temperature,
    isWithinRange,
    needsCorrectiveAction,
    correctiveAction,
    task.department_session_id,
    logHaccp,
    onComplete,
  ]);

  return (
    <View style={styles.container}>
      {/* CCP Reference — read-only, pre-filled from the task */}
      <View style={styles.field}>
        <Text style={styles.label}>Kontrollpunkt</Text>
        <Text style={styles.ccpValue}>{ccpReference}</Text>
      </View>

      {/* Temperature — large numeric input, the primary action */}
      <View style={styles.field}>
        <Text style={styles.label}>Temperatur</Text>
        <View style={styles.tempRow}>
          <TextInput
            style={styles.tempInput}
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="numeric"
            placeholder="0.0"
            placeholderTextColor={theme.colors.mutedForeground}
            maxLength={6}
            autoFocus
            accessibilityLabel="Temperatur i grader celsius"
          />
          <Text style={styles.tempUnit}>{"\u00B0C"}</Text>
        </View>
      </View>

      {/* Range toggle — within / outside */}
      <View style={styles.field}>
        <Text style={styles.label}>Innenfor akseptabelt omr\u00E5de?</Text>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => handleToggleRange(true)}
            style={[styles.toggleOption, isWithinRange && styles.toggleActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: isWithinRange }}
          >
            <Text style={[styles.toggleText, isWithinRange && styles.toggleTextActive]}>Ja</Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleRange(false)}
            style={[styles.toggleOption, !isWithinRange && styles.toggleDanger]}
            accessibilityRole="button"
            accessibilityState={{ selected: !isWithinRange }}
          >
            <Text style={[styles.toggleText, !isWithinRange && styles.toggleTextActive]}>Nei</Text>
          </Pressable>
        </View>
      </View>

      {/* Corrective action — only shown when outside range */}
      {needsCorrectiveAction && (
        <View style={styles.field}>
          <Input
            label="Korrigerende tiltak"
            value={correctiveAction}
            onChangeText={setCorrectiveAction}
            placeholder="Beskriv tiltak som ble gjort..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Submit button — always in thumb zone at the bottom */}
      <View style={styles.submitArea}>
        <Button
          title="Logg temperatur"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    gap: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  ccpValue: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },

  /* Large temperature input — primary interaction area */
  tempRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  tempInput: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    minWidth: 140,
    textAlign: "center",
  },
  tempUnit: {
    ...theme.typography.title,
    color: theme.colors.mutedForeground,
  },

  /* Range toggle buttons */
  toggleRow: {
    flexDirection: "row",
    gap: theme.spacing.tight,
  },
  toggleOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  toggleActive: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + "1A",
  },
  toggleDanger: {
    borderColor: theme.colors.destructive,
    backgroundColor: theme.colors.destructive + "1A",
  },
  toggleText: {
    ...theme.typography.bodyBold,
    color: theme.colors.mutedForeground,
  },
  toggleTextActive: {
    color: theme.colors.foreground,
  },

  submitArea: {
    marginTop: "auto" as unknown as number,
    paddingBottom: theme.spacing.section,
  },
}));
