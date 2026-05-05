/**
 * ItemCard — Generic calendar item row card.
 *
 * Shows a 36px icon frame (dept-color at 14% opacity), title (14.5px semibold),
 * and a subtitle row with mono time + muted detail text. Overdue items
 * (status='overdue') receive a 3px error-red left border and red title color.
 *
 * Tapping fires onPress (optional). Icons are Lucide-RN; mapped per item type.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  Clock,
  FileText,
  CheckSquare,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
} from "lucide-react-native";
import { nativeTheme } from "@smartout/design-tokens/native";
import { useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import type { CalendarItem } from "./types";

const DEPT_COLORS = nativeTheme.department;

function getDeptColor(dept: CalendarItem["dept"]): string {
  return DEPT_COLORS[dept] ?? DEPT_COLORS.kjokken;
}

function getItemIcon(item: CalendarItem, color: string, size = 14) {
  const props = { size, color, strokeWidth: 2 };
  if (item.status === "overdue") return <AlertTriangle {...props} strokeWidth={2.2} />;
  if (item.type === "shift") return <Clock {...props} />;
  if (item.type === "booking") return <FileText {...props} />;
  if (item.type === "task") return <CheckSquare {...props} />;
  if (item.type === "note") return <MessageSquare {...props} />;
  return <Clock {...props} />;
}

type ItemCardProps = {
  item: CalendarItem;
  onPress?: () => void;
};

export function ItemCard({ item, onPress }: ItemCardProps) {
  const theme = useTheme();
  const isOverdue = item.status === "overdue";

  // Icon frame accent: error for overdue, dept-color otherwise
  const accentColor = isOverdue ? theme.colors.destructive : getDeptColor(item.dept);

  const titleColor = isOverdue ? theme.colors.destructive : theme.colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: isOverdue ? theme.colors.destructive : theme.colors.border,
          borderLeftWidth: isOverdue ? 3 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {/* Icon frame */}
      <View style={[styles.iconFrame, { backgroundColor: withOpacity(accentColor, 0.14) }]}>
        {getItemIcon(item, accentColor)}
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <View style={styles.subtitleRow}>
          {item.time != null && (
            <Text style={[styles.time, { color: theme.colors.mutedForeground }]} numberOfLines={1}>
              {item.time}
            </Text>
          )}
          {item.time != null && item.sub != null && (
            <Text style={[styles.dot, { color: theme.colors.mutedForeground }]}>·</Text>
          )}
          {item.sub != null && (
            <Text
              style={[styles.sub, { color: theme.colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.sub}
            </Text>
          )}
        </View>
      </View>

      {/* Chevron */}
      <ChevronRight size={12} color={theme.colors.mutedForeground} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "600",
    marginBottom: 3,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "nowrap",
  },
  time: {
    fontSize: 12,
    fontFamily: "GeistMono-Regular",
  },
  dot: {
    fontSize: 12,
    opacity: 0.5,
  },
  sub: {
    fontSize: 12,
    flex: 1,
  },
});
