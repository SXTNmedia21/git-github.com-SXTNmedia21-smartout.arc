/**
 * ShiftCard — Compact shift summary card for use in the shifts list.
 *
 * Shows: date, time range, position/role, zone, work hours, confirmation status.
 * Pressable with haptic feedback. Unconfirmed shifts show an inline confirm button.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type ShiftCardProps = {
  shift: ScheduleShift;
  /** Navigate to shift detail */
  onPress?: () => void;
  /** Handle shift confirmation */
  onConfirm?: (shiftId: string) => void;
  /** Whether confirmation is in progress */
  confirming?: boolean;
};

/**
 * Formats a shift date string (YYYY-MM-DD) to Norwegian display format.
 * "2026-03-21" -> "Fredag 21. mars"
 */
function formatShiftDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const days = ["Sondag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag"];
  const months = [
    "januar", "februar", "mars", "april", "mai", "juni",
    "juli", "august", "september", "oktober", "november", "desember",
  ];
  const dayName = days[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const monthName = months[date.getUTCMonth()];
  return `${dayName} ${dayNum}. ${monthName}`;
}

/** Formats "HH:MM:SS" time to "HH:MM" */
function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Formats work hours as "Xt Ymin" */
function formatWorkHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

export function ShiftCard({ shift, onPress, onConfirm, confirming = false }: ShiftCardProps) {
  const styles = useStyles();
  const isConfirmed = Boolean(shift.confirmed_at);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm?.(shift.schedule_shift_id);
  }, [onConfirm, shift.schedule_shift_id]);

  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatShiftDate(shift.shift_date)}</Text>
        {isConfirmed ? (
          <StatusBadge label={strings.shift.confirmed} variant="success" />
        ) : (
          <StatusBadge label={strings.shift.confirm} variant="warning" />
        )}
      </View>

      <Text style={styles.timeRange}>
        {formatTime(shift.start_time)}–{formatTime(shift.end_time)} · {shift.role}
      </Text>

      <View style={styles.details}>
        {shift.zone && <Text style={styles.detail}>{shift.zone}</Text>}
        <Text style={styles.detail}>{formatWorkHours(shift.work_hours)}</Text>
      </View>

      {!isConfirmed && onConfirm && (
        <View style={styles.confirmRow}>
          <Button
            title={strings.shift.confirm}
            variant="primary"
            size="sm"
            onPress={handleConfirm}
            loading={confirming}
            fullWidth
          />
        </View>
      )}
    </Card>
  );
}

/** Export date/time formatters for reuse in ShiftCardRich */
export { formatShiftDate, formatTime, formatWorkHours };

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  date: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  timeRange: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.xs,
  },
  details: {
    flexDirection: "row",
    gap: theme.spacing.element,
  },
  detail: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  confirmRow: {
    marginTop: theme.spacing.element,
  },
}));
