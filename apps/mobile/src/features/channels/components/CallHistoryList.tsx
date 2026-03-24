/**
 * CallHistoryList — FlatList of past calls in a channel.
 * Shows call type, duration, participant count, and timestamp.
 */
import React, { useCallback } from "react";
import { View, Text, FlatList, type ListRenderItemInfo } from "react-native";
import { Phone, Users, Radio } from "lucide-react-native";
import { createStyles } from "@/theme";
import type { CallLogEntry } from "@smartout/walkie-talkie";

type Props = {
  entries: CallLogEntry[];
  isLoading?: boolean;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}t ${mins % 60}m`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Akkurat n\u00e5";
  if (diffMins < 60) return `${diffMins}m siden`;
  if (diffHours < 24) return `${diffHours}t siden`;
  if (diffDays < 7) return `${diffDays}d siden`;
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

const CALL_TYPE_ICON = {
  direct: Phone,
  group: Users,
  ptt: Radio,
} as const;

function CallLogRow({ item }: { item: CallLogEntry }) {
  const styles = useStyles();

  // Determine call type from participant count heuristic
  const callType = item.totalParticipants <= 2 ? "direct" : "group";
  const Icon = CALL_TYPE_ICON[callType];

  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <Icon size={16} color={styles.iconColor.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label} numberOfLines={1}>
            {callType === "direct" ? "Samtale" : `Gruppesamtale (${item.totalParticipants})`}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(item.startedAt)}</Text>
        </View>
        <Text style={styles.duration}>
          {formatDuration(item.durationSeconds)}
          {item.maxParticipants > 0 ? ` \u00b7 maks ${item.maxParticipants} deltakere` : ""}
        </Text>
      </View>
    </View>
  );
}

export function CallHistoryList({ entries, isLoading }: Props) {
  const styles = useStyles();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CallLogEntry>) => <CallLogRow item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: CallLogEntry) => item.id, []);

  if (entries.length === 0 && !isLoading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Ingen samtalehistorikk</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.list}
    />
  );
}

const useStyles = createStyles((theme) => ({
  list: {
    paddingHorizontal: theme.spacing.card,
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.element,
    gap: theme.spacing.element,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconColor: {
    color: theme.colors.foreground,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  duration: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  empty: {
    padding: theme.spacing.section,
    alignItems: "center",
  },
  emptyText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
}));
