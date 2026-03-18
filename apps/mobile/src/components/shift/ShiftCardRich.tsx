/**
 * ShiftCardRich — Expanded shift card with colleagues, leader notes, day info.
 *
 * Used on the home screen (before_shift view) and shift detail page.
 * Includes everything from ShiftCard plus:
 * - Colleague avatars + names
 * - Leader notes from schedule_shift.notes
 * - Day bookings summary (count + VIP flag)
 * - Active deviation warnings
 */

import React, { useCallback } from "react";
import { View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar } from "@/components/common/Avatar";
import { SectionHeader } from "@/components/common/SectionHeader";
import { strings } from "@/constants/strings";
import { formatShiftDate, formatTime, formatWorkHours } from "./ShiftCard";
import type { Colleague } from "@/hooks/queries/use-shift-colleagues";
import type { DayInfo } from "@/hooks/queries/use-day-info";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type ShiftCardRichProps = {
  shift: ScheduleShift;
  colleagues?: Colleague[];
  dayInfo?: DayInfo | null;
  /** Handle shift confirmation */
  onConfirm?: (shiftId: string) => void;
  confirming?: boolean;
};

export function ShiftCardRich({
  shift,
  colleagues = [],
  dayInfo,
  onConfirm,
  confirming = false,
}: ShiftCardRichProps) {
  const styles = useStyles();
  const isConfirmed = Boolean(shift.confirmed_at);
  const vipBookings = dayInfo?.bookings.filter((b) => b.is_vip) ?? [];

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm?.(shift.schedule_shift_id);
  }, [onConfirm, shift.schedule_shift_id]);

  return (
    <Card>
      {/* Confirmation status header */}
      <View style={styles.header}>
        {isConfirmed ? (
          <StatusBadge label={strings.shift.confirmed} variant="success" />
        ) : onConfirm ? (
          <Button
            title={strings.shift.confirm}
            variant="primary"
            size="sm"
            onPress={handleConfirm}
            loading={confirming}
          />
        ) : (
          <StatusBadge label={strings.shift.confirm} variant="warning" />
        )}
      </View>

      {/* Time, role, zone */}
      <Text style={styles.timeRange}>
        {formatTime(shift.start_time)}–{formatTime(shift.end_time)} · {shift.role}
      </Text>

      <View style={styles.meta}>
        {shift.zone && <Text style={styles.metaText}>{shift.zone}</Text>}
        <Text style={styles.metaText}>{formatWorkHours(shift.work_hours)}</Text>
      </View>

      {/* Colleagues section */}
      {colleagues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {strings.shift.colleagues} ({colleagues.length})
          </Text>
          <View style={styles.colleagueRow}>
            {colleagues.slice(0, 5).map((c) => (
              <View key={c.profileId} style={styles.colleague}>
                <Avatar
                  name={`${c.firstName} ${c.lastName}`}
                  size="sm"
                />
                <Text style={styles.colleagueName} numberOfLines={1}>
                  {c.firstName}
                </Text>
              </View>
            ))}
            {colleagues.length > 5 && (
              <Text style={styles.moreColleagues}>+{colleagues.length - 5}</Text>
            )}
          </View>
        </View>
      )}

      {/* Leader notes — shift.notes contains manager-written notes for the day */}
      {shift.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{strings.shift.leader}</Text>
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>{shift.notes}</Text>
          </View>
        </View>
      )}

      {/* Day info — bookings + deviations */}
      {dayInfo && (dayInfo.bookings.length > 0 || dayInfo.deviations.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{strings.shift.dayInfo}</Text>
          {dayInfo.bookings.length > 0 && (
            <Text style={styles.infoLine}>
              {dayInfo.bookings.length} bestillinger
              {vipBookings.length > 0 ? ` (${vipBookings.length} VIP)` : ""}
            </Text>
          )}
          {dayInfo.deviations.length > 0 && (
            <Text style={styles.deviationLine}>
              {dayInfo.deviations.length} aktive avvik
            </Text>
          )}

          {/* Day messages from leaders */}
          {dayInfo.messages.map((msg) => (
            <View key={msg.schedule_day_message_id} style={styles.messageRow}>
              <Text style={styles.messageTitle}>{msg.title}</Text>
              <Text style={styles.messageContent} numberOfLines={2}>
                {msg.content}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: theme.spacing.tight,
  },
  timeRange: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  meta: {
    flexDirection: "row",
    gap: theme.spacing.element,
    marginBottom: theme.spacing.element,
  },
  metaText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  section: {
    marginTop: theme.spacing.element,
    paddingTop: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing.tight,
  },
  colleagueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    flexWrap: "wrap",
  },
  colleague: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  colleagueName: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
    maxWidth: 56,
    textAlign: "center",
  },
  moreColleagues: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.mutedForeground,
  },
  noteContainer: {
    backgroundColor: withOpacity(theme.colors.warning, 0.08),
    borderRadius: theme.radius.md,
    padding: theme.spacing.tight,
  },
  noteText: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
  infoLine: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  deviationLine: {
    ...theme.typography.subheadline,
    color: theme.colors.destructive,
    fontWeight: theme.fontWeights.medium,
    marginBottom: theme.spacing.xs,
  },
  messageRow: {
    marginTop: theme.spacing.tight,
  },
  messageTitle: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.foreground,
  },
  messageContent: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
