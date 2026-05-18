/**
 * HomeShiftCard — Compact shift card with "neste 3" session-task preview.
 *
 * Designed for home screen placement. Shows shift meta (date, time, position)
 * plus up to 3 upcoming session_task items (scheduled_at >= now) pulled via
 * useDayLineItems from the shift_session for today.
 *
 * ADR-0367 §M5 (HomeShiftCard preview).
 * ADR-0133: read-only — no mutations from this component.
 * ADR-0134: no direct emit() in this component (view-only).
 *
 * testID: home-shift-card-preview (root), home-shift-card-item-{n} per item.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CalendarDays, Clock, CheckSquare } from "lucide-react-native";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftSession } from "@/hooks/queries/use-shift-session";
import { useDayLineItems } from "@/hooks/queries/use-day-line-items";
import { useTheme } from "@/theme";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type HomeShiftCardProps = {
  shift: ScheduleShift;
};

/** Format "HH:MM:SS" to "HH:MM" */
function fmt(t: string): string {
  return t.slice(0, 5);
}

/** YYYY-MM-DD → "Fre 23. mai" */
function fmtDate(d: string): string {
  const date = new Date(`${d}T00:00:00Z`);
  const days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
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
  return `${days[date.getUTCDay()]} ${date.getUTCDate()}. ${months[date.getUTCMonth()]}`;
}

/**
 * HomeShiftCard with upcoming session task preview (ADR-0367 §M5).
 *
 * Renders a compact shift card with the next 3 session_task items whose
 * scheduled_at is >= now. Slots into BeforeShiftView / DuringShiftView
 * replacement without altering those components.
 */
export function HomeShiftCard({ shift }: HomeShiftCardProps) {
  const { colors } = useTheme();

  const { data: profile } = useMyProfile();
  const profileId = profile?.profile_id ?? "";

  // Shift date for session lookup (business_date = shift_date)
  const dateISO = shift.shift_date ?? "";

  const { data: session } = useShiftSession(profileId, dateISO);

  const dayLineIds = (session?.day_lines ?? []).map((dl) => dl.day_line_id);

  const { data: items = [] } = useDayLineItems(
    dayLineIds,
    dayLineIds,
    session?.shift_session_id ?? "",
  );

  // "neste 3": items with scheduled_at >= now(), sorted ascending, slice 3
  const now = new Date().toISOString();
  const upcoming = items
    .filter((item) => item.scheduled_at && item.scheduled_at >= now)
    .slice(0, 3);

  return (
    <View
      testID="home-shift-card-preview"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Shift meta */}
      <View style={styles.metaRow}>
        <CalendarDays size={14} color={colors.mutedForeground} strokeWidth={2} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {fmtDate(shift.shift_date ?? "")}
        </Text>
        <Clock size={14} color={colors.mutedForeground} strokeWidth={2} style={styles.metaIcon} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {fmt(shift.start_time ?? "")}–{fmt(shift.end_time ?? "")}
        </Text>
      </View>

      {shift.role && (
        <Text style={[styles.position, { color: colors.foreground }]} numberOfLines={1}>
          {shift.role}
        </Text>
      )}

      {/* "neste 3" task preview */}
      {upcoming.length > 0 && (
        <View style={[styles.previewSection, { borderTopColor: colors.border }]}>
          <View style={styles.previewLabel}>
            <CheckSquare size={11} color={colors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.previewLabelText, { color: colors.mutedForeground }]}>
              NESTE OPPGAVER
            </Text>
          </View>
          {upcoming.map((item, idx) => (
            <View key={item.id} testID={`home-shift-card-item-${idx}`} style={styles.previewItem}>
              <View
                style={[
                  styles.previewDot,
                  {
                    backgroundColor:
                      item.status === "overdue" ? colors.destructive : colors.brandOrange,
                  },
                ]}
              />
              <Text
                style={[styles.previewItemTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.scheduled_at && (
                <Text style={[styles.previewItemTime, { color: colors.mutedForeground }]}>
                  {new Date(item.scheduled_at).toLocaleTimeString("nb-NO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaIcon: {
    marginLeft: 8,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "GeistMono-Regular",
  },
  position: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginTop: 2,
  },
  previewSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  previewLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  previewLabelText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    flexShrink: 0,
  },
  previewItemTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  previewItemTime: {
    fontSize: 11,
    fontFamily: "GeistMono-Regular",
  },
});
