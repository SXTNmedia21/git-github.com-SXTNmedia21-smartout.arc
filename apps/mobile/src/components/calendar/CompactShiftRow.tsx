/**
 * CompactShiftRow — Single-line shift row for DayCrewCluster and ShiftList.
 *
 * Layout: [avatar or dept-stripe] · name · role-pill (dept color) · LEDER badge
 * (if isShiftLead) · time (mono, right-aligned).
 *
 * When isOwn=true (Pontus' own row): orange bg at 10%, orange text, ringed avatar.
 * When showing crew (showCrew=true): avatar with initials; otherwise a 3px
 * vertical dept-color stripe replaces the avatar slot.
 *
 * No spring needed — row is inside a FlatList/ScrollView, keep it lightweight.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { Avatar } from "./Avatar";
import type { CalendarItem, Department } from "./types";

const DEPT_COLORS = nativeTheme.department;
const DEPT_LABELS: Record<Department, string> = {
  kjokken: "Kjøkken",
  sal: "Sal",
  bar: "Bar",
  event: "Event",
};

type CompactShiftRowProps = {
  shift: CalendarItem;
  /** When true, shows avatar + owner name instead of dept stripe + shift title. */
  showCrew?: boolean;
  /** Whether this row belongs to the current user (Pontus' own row). */
  isOwn?: boolean;
  /** Initials of the shift owner (used when showCrew=true). */
  ownerInitials?: string;
  /** Display name (first + last initial) of the shift owner. */
  ownerName?: string;
  /** Owner's color string (for Avatar). */
  ownerColor?: string;
  onPress?: () => void;
};

export function CompactShiftRow({
  shift,
  showCrew = false,
  isOwn = false,
  ownerInitials,
  ownerName,
  ownerColor,
  onPress,
}: CompactShiftRowProps) {
  const theme = useTheme();
  const deptColor = DEPT_COLORS[shift.dept as Department] ?? theme.colors.brandOrange;

  const rowBg = isOwn ? withOpacity(theme.colors.brandOrange, 0.1) : "transparent";

  // Role pill label: shift.role or dept label fallback
  const rolePillLabel = shift.role ?? DEPT_LABELS[shift.dept as Department] ?? shift.dept;

  // Time display — strip :00 for cleaner read (e.g. "15:00–23:00" → "15–23")
  // Keep as-is for now; formatting can be tightened at integration.
  const timeDisplay = shift.time ?? "";

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: rowBg }]}
      accessibilityRole="button"
      accessibilityLabel={`${ownerName ?? shift.title} ${shift.role ?? ""} ${timeDisplay}`}
    >
      {/* Avatar or dept stripe */}
      {showCrew && ownerInitials && ownerColor ? (
        <Avatar initials={ownerInitials} color={ownerColor} ring={isOwn} size={28} />
      ) : (
        <View style={[styles.deptStripe, { backgroundColor: deptColor }]} />
      )}

      {/* Name + role pill */}
      <View style={styles.nameRow}>
        <Text
          style={[
            styles.name,
            {
              color: isOwn ? theme.colors.brandOrange : theme.colors.foreground,
              fontWeight: isOwn ? "700" : "500",
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {showCrew && ownerName ? ownerName : shift.title}
        </Text>

        <View style={[styles.rolePill, { backgroundColor: withOpacity(deptColor, 0.14) }]}>
          <Text style={[styles.rolePillLabel, { color: deptColor }]}>{rolePillLabel}</Text>
        </View>

        {shift.isShiftLead === true && (
          <View style={[styles.lederBadge, { backgroundColor: theme.colors.brandOrange }]}>
            <Text style={styles.lederLabel}>LEDER</Text>
          </View>
        )}
      </View>

      {/* Time (right-aligned, mono) */}
      <Text style={[styles.time, { color: theme.colors.mutedForeground }]} numberOfLines={1}>
        {timeDisplay}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  deptStripe: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 99,
    minHeight: 28,
    flexShrink: 0,
  },
  nameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  name: {
    fontSize: 12.5,
    flexShrink: 1,
    minWidth: 0,
  },
  rolePill: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
    flexShrink: 0,
  },
  rolePillLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  lederBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3,
    flexShrink: 0,
  },
  lederLabel: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "#ffffff",
  },
  time: {
    fontSize: 10.5,
    fontFamily: "GeistMono-Regular",
    flexShrink: 0,
  },
});
