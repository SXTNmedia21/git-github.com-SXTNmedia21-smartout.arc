/**
 * Channel list screen — entry point for the Kanaler tab.
 *
 * Uses the new channel schema via get_my_channels() RPC.
 * Groups channels by type: Aktiv vakt, Avdelinger, Team, Kanaler, Direktemeldinger, etc.
 */
import { useCallback } from "react";
import { View, SectionList, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "@/theme";
import { EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ChannelRow } from "@/components/channels/ChannelRow";
import {
  useGroupedChannels,
  type ChannelWithPreview,
  type ChannelSection,
} from "@/hooks/queries/use-channels";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export default function ChannelsIndex() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phase } = useShiftPhase();
  const { user } = useAuth();
  const isDuringShift = phase === "during_shift";

  // Get workspace_id from current profile
  const { data: profile } = useQuery({
    queryKey: ["my-profile-workspace", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      return data;
    },
  });

  const workspaceId = profile?.workspace_id ?? null;
  const { sections, isLoading, isError, refetch } = useGroupedChannels(workspaceId, isDuringShift);

  const handleChannelPress = useCallback(
    (channel: ChannelWithPreview) => {
      router.push(`/(app)/(channels)/${channel.channel_id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChannelWithPreview }) => (
      <ChannelRow channel={item} onPress={() => handleChannelPress(item)} />
    ),
    [handleChannelPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ChannelSection }) => (
      <SectionHeader title={section.title} style={styles.sectionHeader} />
    ),
    [styles.sectionHeader],
  );

  const keyExtractor = useCallback((item: ChannelWithPreview) => item.channel_id, []);

  const isEmpty = !isLoading && sections.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Kanaler</Text>

      {isEmpty ? (
        <EmptyState
          title="Ingen kanaler enna"
          subtitle="Kanaler opprettes automatisk for din avdeling og ditt team."
        />
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.tight,
  },
  listContent: {
    paddingHorizontal: theme.spacing.page,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.xs,
  },
}));
