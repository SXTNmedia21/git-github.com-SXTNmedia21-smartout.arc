/**
 * HoursConfirmation — End-of-shift hours review and confirmation.
 *
 * Shows planned hours vs registered (calculated) hours and break time.
 * Two actions:
 *   - "Bekreft" enqueues confirm_hours with status = 'approved'
 *   - "Bestrid" opens a justification text input, then enqueues with status = 'disputed'
 *
 * This does NOT depend on handoff completion — they run in parallel.
 */
import React, { useCallback, useState } from "react";
import { View, Text, Keyboard } from "react-native";
import * as Haptics from "expo-haptics";

import { Button, Input } from "@/components/ui";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { useConfirmHours, type ConfirmHoursPayload } from "@/hooks/mutations/use-confirm-hours";

type HoursConfirmationProps = {
  approvalId: string;
  plannedHours: number;
  calculatedHours: number | null;
  /** Total break time in hours (derived from time_entry.breaks) */
  breakHours: number;
  /** Whether handoff has been submitted — shown as status, not a gate */
  handoffSubmitted: boolean;
  onComplete: () => void;
};

export function HoursConfirmation({
  approvalId,
  plannedHours,
  calculatedHours,
  breakHours,
  handoffSubmitted,
  onComplete,
}: HoursConfirmationProps) {
  const styles = useStyles();
  const { confirmHours, isSubmitting } = useConfirmHours();

  const [isDisputing, setIsDisputing] = useState(false);
  const [justification, setJustification] = useState("");

  const displayCalculated = calculatedHours ?? 0;
  const difference = displayCalculated - plannedHours;
  const hasDifference = Math.abs(difference) > 0.01;

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const payload: ConfirmHoursPayload = {
      approval_id: approvalId,
      status: "approved",
    };

    await confirmHours(payload);
    onComplete();
  }, [isSubmitting, approvalId, confirmHours, onComplete]);

  const handleStartDispute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDisputing(true);
  }, []);

  const handleSubmitDispute = useCallback(async () => {
    if (isSubmitting || justification.trim().length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Keyboard.dismiss();

    const payload: ConfirmHoursPayload = {
      approval_id: approvalId,
      status: "disputed",
      edit_justification: justification.trim(),
    };

    await confirmHours(payload);
    onComplete();
  }, [isSubmitting, justification, approvalId, confirmHours, onComplete]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.hours.title}</Text>

      {/* Hours breakdown */}
      <View style={styles.card}>
        <HoursRow label={strings.hours.planned} value={formatHours(plannedHours)} />
        <HoursRow
          label={strings.hours.registered}
          value={formatHours(displayCalculated)}
          highlight={hasDifference}
        />
        {breakHours > 0 && (
          <HoursRow label={strings.hours.break} value={formatHours(breakHours)} muted />
        )}
        {hasDifference && (
          <View style={styles.diffRow}>
            <Text style={styles.diffLabel}>Differanse</Text>
            <Text style={[styles.diffValue, difference > 0 ? styles.positive : styles.negative]}>
              {difference > 0 ? "+" : ""}
              {formatHours(difference)}
            </Text>
          </View>
        )}
      </View>

      {/* Handoff status — informational only, not a gate */}
      {!handoffSubmitted && (
        <View style={styles.handoffWarning}>
          <Text style={styles.handoffWarningText}>{strings.handoff.notSubmitted}</Text>
        </View>
      )}

      {/* Dispute mode — justification input */}
      {isDisputing ? (
        <View style={styles.disputeSection}>
          <Input
            label="Hvorfor bestrider du timene?"
            value={justification}
            onChangeText={setJustification}
            placeholder="Forklar hva som er feil..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />
          <View style={styles.disputeActions}>
            <Button
              title={strings.common.cancel}
              variant="ghost"
              size="md"
              onPress={() => setIsDisputing(false)}
            />
            <Button
              title="Send bestridelse"
              variant="destructive"
              size="md"
              loading={isSubmitting}
              disabled={justification.trim().length === 0}
              onPress={handleSubmitDispute}
            />
          </View>
        </View>
      ) : (
        /* Normal actions — confirm or dispute */
        <View style={styles.actions}>
          <Button
            title={strings.hours.confirm}
            variant="primary"
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={handleConfirm}
          />
          <Button
            title={strings.hours.dispute}
            variant="ghost"
            size="md"
            fullWidth
            onPress={handleStartDispute}
          />
        </View>
      )}
    </View>
  );
}

/** Single row in the hours breakdown card */
function HoursRow({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={styles.hoursRow}>
      <Text style={[styles.hoursLabel, muted && styles.muted]}>{label}</Text>
      <Text style={[styles.hoursValue, highlight && styles.highlight, muted && styles.muted]}>
        {value}
      </Text>
    </View>
  );
}

/** Formats hours as "Xt Ym" — e.g. 7.5 → "7t 30m" */
function formatHours(hours: number): string {
  const absHours = Math.abs(hours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  const sign = hours < 0 ? "-" : "";

  if (m === 0) return `${sign}${h}t`;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}t ${m}m`;
}

const useStyles = createStyles((theme) => ({
  container: {
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },

  /* Hours breakdown card */
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.element,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hoursLabel: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  hoursValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  highlight: {
    color: theme.colors.warning,
  },
  muted: {
    color: theme.colors.mutedForeground,
  },
  diffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.element,
  },
  diffLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  diffValue: {
    ...theme.typography.bodyBold,
  },
  positive: {
    color: theme.colors.success,
  },
  negative: {
    color: theme.colors.destructive,
  },

  /* Handoff warning */
  handoffWarning: {
    backgroundColor: theme.colors.warning + "1A",
    borderRadius: theme.radius.md,
    padding: theme.spacing.element,
    alignItems: "center",
  },
  handoffWarningText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.warning,
  },

  /* Actions */
  actions: {
    gap: theme.spacing.tight,
  },

  /* Dispute section */
  disputeSection: {
    gap: theme.spacing.element,
  },
  disputeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.tight,
  },
}));
