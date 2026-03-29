/**
 * Team List Screen — Browse workspace members with search and status filtering.
 *
 * - FlatList with pull-to-refresh
 * - Client-side search by name, role, or department
 * - Status badges using nativeTheme.status colors
 * - Tap to navigate to team/[id] detail screen
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles, statusColors } from "@/theme";
import { supabase } from "@/lib/supabase";

type ProfileStatus = "trainee" | "active" | "inactive" | "offboarding";

type TeamMember = {
  profile_id: string;
  display_name: string | null;
  role: string | null;
  status: ProfileStatus | null;
  email: string | null;
  phone: string | null;
  department: { name: string } | null;
};

const STATUS_LABELS: Record<ProfileStatus, string> = {
  trainee: "Trainee",
  active: "Aktiv",
  inactive: "Inaktiv",
  offboarding: "Slutter",
};

function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, role, status, user_identity:user_id(email, phone), department:department_id(name)",
        )
        .order("display_name", { ascending: true });

      if (error) throw error;

      // Map user_identity relation back to flat fields for UI
      return (data ?? []).map(
        (row: { user_identity?: { email?: string | null; phone?: string | null } | null }) => ({
          ...row,
          email: row.user_identity?.email ?? null,
          phone: row.user_identity?.phone ?? null,
        }),
      ) as TeamMember[];
    },
  });
}

function getInitial(name: string | null): string {
  return (name ?? "?").charAt(0).toUpperCase();
}

function getStatusColor(status: ProfileStatus | null): string {
  if (!status || !(status in statusColors)) return statusColors.inactive;
  return statusColors[status];
}

export default function TeamListScreen() {
  const styles = useStyles();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: members = [], isLoading, refetch, isRefetching } = useTeamMembers();

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.display_name?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q) ||
        m.department?.name?.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handlePress = useCallback(
    (profileId: string) => {
      Haptics.selectionAsync();
      router.push(`/team/${profileId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TeamMember; index: number }) => {
      const statusColor = getStatusColor(item.status);
      const deptName = item.department?.name ?? "Ingen avdeling";

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 40)
            .duration(300)
            .springify()}
        >
          <Pressable
            onPress={() => handlePress(item.profile_id)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.display_name ?? "Ukjent"}, ${item.role ?? ""}`}
          >
            {/* Avatar placeholder */}
            <View style={[styles.avatar, { backgroundColor: statusColor }]}>
              <Text style={styles.avatarText}>{getInitial(item.display_name)}</Text>
            </View>

            {/* Info */}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.display_name ?? "Ukjent"}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.role ?? "—"} · {deptName}
              </Text>
            </View>

            {/* Status badge */}
            <View style={[styles.badge, { backgroundColor: statusColor + "1A" }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {STATUS_LABELS[item.status ?? "inactive"]}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [styles, handlePress],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <ChevronLeft size={28} color={styles.foregroundColor.color} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Team</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={styles.mutedColor.color} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Sok etter navn, rolle, avdeling..."
          placeholderTextColor={styles.mutedColor.color}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={styles.brandColor.color} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.profile_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>{search ? "Ingen treff" : "Ingen teammedlemmer"}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerRight: {
    width: 44,
  },
  foregroundColor: {
    color: theme.colors.foreground,
  },
  mutedColor: {
    color: theme.colors.mutedForeground,
  },
  brandColor: {
    color: theme.colors.brandOrange,
  },

  /* Search */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    height: 44,
    gap: theme.spacing.tight,
  },
  searchInput: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
    height: 44,
  },

  /* List */
  list: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
    marginBottom: theme.spacing.tight,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.element,
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...theme.typography.body,
    color: theme.colors.primaryForeground,
    fontWeight: theme.fontWeights.semibold,
    fontSize: 18,
  },
  info: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.semibold,
  },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },

  /* Badge */
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    gap: theme.spacing.xs,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.medium,
    fontSize: 11,
  },

  /* States */
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
