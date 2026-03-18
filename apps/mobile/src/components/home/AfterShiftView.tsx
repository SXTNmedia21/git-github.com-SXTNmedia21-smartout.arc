/**
 * AfterShiftView — Home screen content after the employee has punched out.
 *
 * Shows handoff text field + hours confirmation side by side (both visible, neither blocks the other).
 * Handoff is strongly encouraged but does NOT gate hours confirmation.
 */

import React, { useState, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/common/SectionHeader";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type AfterShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  /** Submit handoff text */
  onSubmitHandoff?: (text: string) => void;
  submittingHandoff?: boolean;
  /** Confirm registered hours */
  onConfirmHours?: () => void;
  confirmingHours?: boolean;
  /** Dispute registered hours */
  onDisputeHours?: () => void;
};

/** Calculate duration between two timestamps in "Xt Ymin" format */
function formatDuration(start: string, end: string): string {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const diffMs = Math.max(0, endMs - startMs);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}t ${minutes.toString().padStart(2, "0")}min`;
}

/** Calculate break duration from the breaks JSONB array */
function calculateBreakMinutes(breaks: unknown): number {
  if (!Array.isArray(breaks)) return 0;
  let totalMs = 0;
  for (const b of breaks) {
    if (b && typeof b === "object" && "start" in b && "end" in b) {
      const start = new Date(b.start as string).getTime();
      const end = new Date(b.end as string).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        totalMs += Math.max(0, end - start);
      }
    }
  }
  return Math.round(totalMs / 60_000);
}

export function AfterShiftView({
  shift,
  timeEntry,
  onSubmitHandoff,
  submittingHandoff = false,
  onConfirmHours,
  confirmingHours = false,
  onDisputeHours,
}: AfterShiftViewProps) {
  const styles = useStyles();
  const [handoffText, setHandoffText] = useState("");
  const [handoffSent, setHandoffSent] = useState(false);

  const handleSubmitHandoff = useCallback(() => {
    if (!handoffText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmitHandoff?.(handoffText.trim());
    setHandoffSent(true);
  }, [handoffText, onSubmitHandoff]);

  const plannedHours = shift ? `${shift.work_hours}t 00min` : "—";
  const registeredHours = timeEntry.punch_out
    ? formatDuration(timeEntry.punch_in, timeEntry.punch_out)
    : "—";
  const breakMinutes = calculateBreakMinutes(timeEntry.breaks);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{strings.home.shiftDone}</Text>

      {/* Handoff section */}
      <Card style={styles.section}>
        <SectionHeader title={strings.handoff.title} />
        {handoffSent ? (
          <Text style={styles.sentText}>{strings.common.done}</Text>
        ) : (
          <View style={styles.handoffForm}>
            <Input
              placeholder={strings.handoff.placeholder}
              value={handoffText}
              onChangeText={setHandoffText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Button
              title={strings.handoff.send}
              variant="primary"
              size="md"
              onPress={handleSubmitHandoff}
              loading={submittingHandoff}
              disabled={!handoffText.trim()}
              fullWidth
            />
          </View>
        )}
      </Card>

      {/* Hours confirmation section */}
      <Card style={styles.section}>
        <SectionHeader title={strings.hours.title} />
        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>{strings.hours.planned}:</Text>
          <Text style={styles.hoursValue}>{plannedHours}</Text>
        </View>
        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>{strings.hours.registered}:</Text>
          <Text style={styles.hoursValue}>{registeredHours}</Text>
        </View>
        {breakMinutes > 0 && (
          <View style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>{strings.hours.break}:</Text>
            <Text style={styles.hoursValue}>{breakMinutes}min</Text>
          </View>
        )}

        <View style={styles.hoursActions}>
          <Button
            title={strings.hours.confirm}
            variant="primary"
            size="md"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onConfirmHours?.();
            }}
            loading={confirmingHours}
            style={styles.confirmButton}
          />
          <Button
            title={strings.hours.dispute}
            variant="ghost"
            size="md"
            onPress={() => {
              Haptics.selectionAsync();
              onDisputeHours?.();
            }}
            style={styles.disputeButton}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.section,
  },
  section: {
    marginBottom: theme.spacing.section,
  },
  handoffForm: {
    gap: theme.spacing.element,
  },
  sentText: {
    ...theme.typography.body,
    color: theme.colors.success,
    fontWeight: theme.fontWeights.medium,
    textAlign: "center",
    paddingVertical: theme.spacing.element,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.tight,
  },
  hoursLabel: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  hoursValue: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  hoursActions: {
    flexDirection: "row",
    gap: theme.spacing.element,
    marginTop: theme.spacing.element,
  },
  confirmButton: {
    flex: 1,
  },
  disputeButton: {
    flex: 1,
  },
}));
