/**
 * NotificationList — FlatList of notifications with filter chips and infinite scroll.
 *
 * Uses local mobile hooks (not @smartout/notifications) because the shared
 * hooks rely on browser APIs that are unavailable in React Native.
 *
 * Features:
 * - Filter chips: Alle / Uleste / Vakter / Oppgaver
 * - Infinite scroll via onEndReached + fetchNextPage
 * - Pull-to-refresh via RefreshControl
 * - Empty state when no notifications match the active filter
 * - Loading skeleton (ActivityIndicator) on first load
 */

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { Bell } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationRow } from "./NotificationRow";
import { useNotifications, useMarkAsRead } from "@/hooks/queries/use-notifications";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

type FilterOption = {
  key: string;
  label: string;
  /** If set, filters by icon_type. If undefined, shows all. */
  iconType?: string;
  /** If true, filters to unread only */
  unreadOnly?: boolean;
};

const FILTERS: FilterOption[] = [
  { key: "all", label: "Alle" },
  { key: "unread", label: "Uleste", unreadOnly: true },
  { key: "shift", label: "Vakter", iconType: "shift" },
  { key: "task", label: "Oppgaver", iconType: "task" },
];

type NotificationListProps = {
  profileId: string | undefined;
  /** Called when a row is tapped — parent handles navigation + mark-as-read */
  onNotificationPress: (notification: Notification) => void;
};

export function NotificationList({ profileId, onNotificationPress }: NotificationListProps) {
  const styles = useStyles();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Resolve the query filter from the active chip
  const filter = useMemo(() => {
    const active = FILTERS.find((f) => f.key === activeFilter);
    return {
      unreadOnly: active?.unreadOnly,
      iconType: active?.iconType,
    };
  }, [activeFilter]);

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } =
    useNotifications(profileId, filter);

  const { mutate: markAsRead } = useMarkAsRead();

  // Flatten all pages into a single list for FlatList
  const notifications = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  const handlePress = useCallback(
    (notification: Notification) => {
      // Mark as read immediately on tap — parent handles navigation
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
      onNotificationPress(notification);
    },
    [markAsRead, onNotificationPress],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleFilterPress = useCallback((key: string) => {
    Haptics.selectionAsync();
    setActiveFilter(key);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationRow notification={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  // Footer: spinner while fetching the next page
  const ListFooterComponent = useMemo(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={styles.spinnerColor.color} />
        </View>
      ) : null,
    [isFetchingNextPage, styles],
  );

  const ListEmptyComponent = useMemo(
    () =>
      isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={styles.spinnerColor.color} />
        </View>
      ) : (
        <EmptyState
          icon={<Bell size={32} color={styles.emptyIconColor.color} strokeWidth={1.5} />}
          title="Ingen varsler"
          subtitle={
            activeFilter === "unread" ? "Du har ingen uleste varsler." : "Du er helt à jour!"
          }
        />
      ),
    [isLoading, activeFilter, styles],
  );

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => handleFilterPress(f.key)}
            style={[styles.chip, activeFilter === f.key && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === f.key }}
          >
            <Text style={[styles.chipLabel, activeFilter === f.key && styles.chipLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor={styles.spinnerColor.color}
          />
        }
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: theme.spacing.tight,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    backgroundColor: theme.colors.brandOrange,
    borderColor: theme.colors.brandOrange,
  },
  chipLabel: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  chipLabelActive: {
    color: "#ffffff",
    fontWeight: theme.fontWeights.semibold,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl,
  },
  footer: {
    alignItems: "center",
    paddingVertical: theme.spacing.section,
  },
  // Color-only styles for passing values to non-RN components
  spinnerColor: {
    color: theme.colors.brandOrange,
  },
  emptyIconColor: {
    color: theme.colors.mutedForeground,
  },
}));
