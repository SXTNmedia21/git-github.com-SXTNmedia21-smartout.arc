/**
 * ShiftCard — Compact shift summary card for use in the shifts list.
 *
 * Shows: date, time range, position/role, zone, work hours, confirmation status.
 * Card body navigates to shift detail. Confirm button is a separate touch target
 * to avoid nested <button> elements on web.
 */

import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SupplementBadges } from "@/components/payroll/SupplementBadges";
import { strings } from "@/constants/strings";
import { getShiftSupplements, mapDbRules } from "@/lib/supplements";
import { useSupplementRules } from "@/hooks/queries/use-supplement-rules";
import { useShiftLifecycle } from "@/hooks/useShiftLifecycle";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useShiftPipeline, resolvePipelineLabel } from "@/hooks/queries/use-shift-pipeline";
import { PhaseStrip, PHASE_STRIP_HEIGHT } from "@/components/shift-timeline";
import type { Database } from "@smartout/supabase/database.types";
import type { ShiftZone } from "@smartout/data";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type ShiftCardProps = {
  shift: ScheduleShift;
  /**
   * Zone assignments for this shift (ADR-0430 M:N readback, reader-only).
   * Optional + additive — callers that source shifts via useMyShifts pass
   * `shift.zones`; legacy callers omit it (renders without zone line).
   */
  zones?: ShiftZone[];
  /** Navigate to shift detail */
  onPress?: () => void;
  /** Handle shift confirmation */
  onConfirm?: (shiftId: string) => void;
  /** Whether confirmation is in progress */
  confirming?: boolean;
  /**
   * When true, render the 56pt PhaseStrip at the top of the card so the
   * employee sees the current lifecycle phase at a glance (Council 6.4).
   * Defaults to false to keep the card backwards-compatible.
   */
  showPhaseStrip?: boolean;
};

/**
 * Formats a shift date string (YYYY-MM-DD) to Norwegian display format.
 * "2026-03-21" -> "Fredag 21. mars"
 */
function formatShiftDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const days = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const months = [
    "januar",
    "februar",
    "mars",
    "april",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "desember",
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

// UI Events:
// - nav: shift detail (card press / body press)
// - action: confirmShift(shiftId) (confirm button)
// - display: supplement badges (kveld/helg/helligdag color-coded)

export function ShiftCard({
  shift,
  zones,
  onPress,
  onConfirm,
  confirming = false,
  showPhaseStrip = false,
}: ShiftCardProps) {
  const styles = useStyles();
  // ADR-0430 M:N zone readback (reader-only): comma-joined zone names, "" when none.
  const zoneLabel = (zones ?? []).map((z) => z.name).join(", ");
  const { colors } = useTheme();
  const isConfirmed = Boolean(shift.confirmed_at);

  // Inline confirmation status — replaces StatusBadge pill (40% reduction principle).
  // Dot (6px) + caption text. Less visual weight than full pill.
  const renderStatusInline = (kind: "confirmed" | "needs-confirm") => (
    <View style={styles.statusInline}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: kind === "confirmed" ? colors.success : colors.warning },
        ]}
      />
      <Text
        style={[
          styles.statusLabel,
          { color: kind === "confirmed" ? colors.success : colors.warning },
        ]}
      >
        {kind === "confirmed" ? strings.shift.confirmed : strings.shift.confirm}
      </Text>
    </View>
  );
  const { data: supplementData } = useSupplementRules();
  // Only fetch the lifecycle when the strip is requested — keeps other
  // card usages (swap, roster lists) on the same lightweight footprint.
  const { data: lifecycle } = useShiftLifecycle(showPhaseStrip ? shift.schedule_shift_id : null);
  const isOnline = useIsOnline();
  const { data: pipelineData } = useShiftPipeline(shift.schedule_shift_id);
  const pipelineInfo = pipelineData?.pipeline ?? null;

  const supplements = useMemo(() => {
    if (!supplementData?.rules || supplementData.rules.length === 0) return [];
    const engineRules = mapDbRules(supplementData.rules);
    if (engineRules.length === 0) return [];
    return getShiftSupplements({
      shiftDate: shift.shift_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      breakMinutes: shift.breaks ?? 0,
      rules: engineRules,
      holidays: supplementData.holidays ?? [],
    });
  }, [supplementData, shift.shift_date, shift.start_time, shift.end_time, shift.breaks]);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm?.(shift.schedule_shift_id);
  }, [onConfirm, shift.schedule_shift_id]);

  const needsConfirm = !isConfirmed && Boolean(onConfirm);

  // When a confirm button exists, the Card can't be pressable (nested <button> on web).
  // Instead, we make the card body a separate Pressable for navigation.
  return (
    <Card onPress={needsConfirm ? undefined : onPress}>
      {showPhaseStrip && lifecycle ? (
        <View style={styles.phaseStripContainer}>
          <PhaseStrip activePhase={lifecycle.phase} frozen={!isOnline} />
        </View>
      ) : null}
      {needsConfirm && onPress ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onPress();
          }}
          accessibilityRole="link"
          accessibilityLabel={`${formatShiftDate(shift.shift_date)} ${shift.role}`}
        >
          <View style={styles.header}>
            <Text style={styles.date}>{formatShiftDate(shift.shift_date)}</Text>
            {renderStatusInline("needs-confirm")}
          </View>
          <Text style={styles.timeRange}>
            {formatTime(shift.start_time)}–{formatTime(shift.end_time)} · {shift.role}
          </Text>
          <View style={styles.details}>
            {/* ADR-0430 M:N zone readback — show zone(s) when assigned. */}
            {zoneLabel ? <Text style={styles.detail}>{zoneLabel}</Text> : null}
            <Text style={styles.detail}>{formatWorkHours(shift.work_hours)}</Text>
          </View>
          {supplements.length > 0 && (
            <View style={styles.badgeRow}>
              <SupplementBadges supplements={supplements} />
            </View>
          )}
          {pipelineInfo && (
            <View style={styles.pipelineLockRow}>
              <Text style={styles.pipelineLockText}>
                🔒 {resolvePipelineLabel(pipelineInfo.blueprint_id)}
              </Text>
            </View>
          )}
        </Pressable>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.date}>{formatShiftDate(shift.shift_date)}</Text>
            {renderStatusInline(isConfirmed ? "confirmed" : "needs-confirm")}
          </View>
          <Text style={styles.timeRange}>
            {formatTime(shift.start_time)}–{formatTime(shift.end_time)} · {shift.role}
          </Text>
          <View style={styles.details}>
            {/* ADR-0430 M:N zone readback — show zone(s) when assigned. */}
            {zoneLabel ? <Text style={styles.detail}>{zoneLabel}</Text> : null}
            <Text style={styles.detail}>{formatWorkHours(shift.work_hours)}</Text>
          </View>
          {supplements.length > 0 && (
            <View style={styles.badgeRow}>
              <SupplementBadges supplements={supplements} />
            </View>
          )}
          {pipelineInfo && (
            <View style={styles.pipelineLockRow}>
              <Text style={styles.pipelineLockText}>
                🔒 {resolvePipelineLabel(pipelineInfo.blueprint_id)}
              </Text>
            </View>
          )}
        </>
      )}

      {needsConfirm && (
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
  statusInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
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
  badgeRow: {
    marginTop: theme.spacing.xs,
  },
  pipelineLockRow: {
    marginTop: theme.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  pipelineLockText: {
    ...theme.typography.caption,
    color: "#f59e0b",
  },
  confirmRow: {
    marginTop: theme.spacing.element,
  },
  phaseStripContainer: {
    height: PHASE_STRIP_HEIGHT,
    marginBottom: theme.spacing.element,
    marginHorizontal: -theme.spacing.tight,
  },
}));
