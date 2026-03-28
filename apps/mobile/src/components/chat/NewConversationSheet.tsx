/**
 * NewConversationSheet — Bottom sheet for starting a new DM conversation.
 *
 * Shows a search field + list of workspace colleagues. Tapping a profile
 * creates (or navigates to) an existing DM conversation with that person.
 *
 * Uses @gorhom/bottom-sheet with BottomSheetTextInput for keyboard-aware search.
 */

import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

// BottomSheetTextInput crashes on web (null _scrollRef). Use plain TextInput on web.
const SearchInput = Platform.OS === "web" ? TextInput : BottomSheetTextInput;
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Search, MessageCircle } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import type { Database } from "@smartout/supabase/database.types";

type Profile = Database["public"]["Tables"]["profile"]["Row"];

type NewConversationSheetProps = {
  onSelectProfile: (profileId: string, displayName: string) => void;
};

/** Fetches all active profiles in the same workspace, excluding the current user */
function useWorkspaceProfiles() {
  const { data: myProfile } = useMyProfile();

  return useQuery<Profile[]>({
    queryKey: ["workspace-profiles", myProfile?.workspace_id],
    queryFn: async () => {
      if (!myProfile?.workspace_id) return [];

      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("workspace_id", myProfile.workspace_id)
        .in("status", ["active", "trainee"])
        .neq("profile_id", myProfile.profile_id)
        .order("display_name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!myProfile?.workspace_id,
    staleTime: 5 * 60 * 1000,
  });
}

export const NewConversationSheet = forwardRef<GorhomBottomSheet, NewConversationSheetProps>(
  function NewConversationSheet({ onSelectProfile }, ref) {
    const styles = useStyles();
    const theme = useTheme();
    const [search, setSearch] = useState("");
    const { data: profiles, isLoading } = useWorkspaceProfiles();

    const snapPoints = useMemo(() => ["60%", "90%"], []);

    const filtered = useMemo(() => {
      if (!profiles) return [];
      if (!search.trim()) return profiles;
      const q = search.toLowerCase();
      return profiles.filter((p) => (p.display_name ?? "").toLowerCase().includes(q));
    }, [profiles, search]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      [],
    );

    const handleSelect = useCallback(
      (profile: Profile) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectProfile(profile.profile_id, profile.display_name ?? "Ukjent");
      },
      [onSelectProfile],
    );

    const renderItem = useCallback(
      ({ item }: { item: Profile }) => {
        const role = item.job_title ?? item.role ?? "";
        return (
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => [styles.profileRow, pressed && styles.profileRowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Start samtale med ${item.display_name}`}
          >
            <Avatar name={item.display_name ?? "?"} imageUrl={item.avatar_url} size="md" />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{item.display_name}</Text>
              {role ? <Text style={styles.profileRole}>{role}</Text> : null}
            </View>
            <MessageCircle
              size={18}
              color={withOpacity(theme.colors.mutedForeground, 0.4)}
              strokeWidth={1.5}
            />
          </Pressable>
        );
      },
      [handleSelect, styles, theme],
    );

    const keyExtractor = useCallback((item: Profile) => item.profile_id, []);

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ny samtale</Text>
          <Text style={styles.headerSubtitle}>Velg en person å chatte med</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search
            size={18}
            color={withOpacity(theme.colors.mutedForeground, 0.5)}
            strokeWidth={1.6}
          />
          <SearchInput
            placeholder="Søk etter kollegaer..."
            placeholderTextColor={withOpacity(theme.colors.mutedForeground, 0.4)}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Profile list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.colors.brandOrange} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search ? "Ingen treff" : "Ingen kollegaer funnet"}
            </Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </GorhomBottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  sheetBackground: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  handle: {
    backgroundColor: theme.colors.muted,
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
  },
  header: {
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.md,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "300",
    fontStyle: "italic",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    marginHorizontal: theme.spacing.section,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    borderRadius: theme.radius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.foreground,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 40,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: withOpacity(theme.colors.border, 0.08),
  },
  profileRowPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  profileRole: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
}));
