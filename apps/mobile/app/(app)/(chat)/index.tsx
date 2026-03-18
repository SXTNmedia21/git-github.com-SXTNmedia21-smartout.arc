/**
 * Channel list screen — entry point for the Chat tab.
 *
 * Displays conversations in three sections:
 * - "Aktiv vakt" — session channel (only visible during shift)
 * - "Kanaler" — department + team group channels
 * - "Direktmeldinger" — DM conversations
 *
 * Each row shows channel name, last message preview, timestamp, and unread badge.
 * Unread count on the overall tab is derived from the sum of unread counts here.
 */
import { useCallback } from "react";
import { View, SectionList, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ChannelRow } from "@/components/chat/ChannelRow";
import {
  useGroupedConversations,
  type ConversationWithMeta,
  type ConversationSection,
} from "@/hooks/queries/use-conversations";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";

export default function ChatIndex() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phase } = useShiftPhase();
  const isDuringShift = phase === "during_shift";

  const { sections, isLoading, isError, refetch } =
    useGroupedConversations(isDuringShift);

  const handleChannelPress = useCallback(
    (conversation: ConversationWithMeta) => {
      router.push(`/(app)/(chat)/${conversation.id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationWithMeta }) => (
      <ChannelRow conversation={item} onPress={() => handleChannelPress(item)} />
    ),
    [handleChannelPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ConversationSection }) => (
      <SectionHeader title={section.title} style={styles.sectionHeader} />
    ),
    [styles.sectionHeader],
  );

  const keyExtractor = useCallback((item: ConversationWithMeta) => item.id, []);

  const isEmpty = !isLoading && sections.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{strings.tabs.chat}</Text>

      {isEmpty ? (
        <EmptyState
          title={strings.chat.noMessages}
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
