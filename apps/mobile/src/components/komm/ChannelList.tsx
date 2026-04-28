/**
 * ChannelList — Shared channel list renderer for Komm surfaces.
 *
 * Renders a SectionList of grouped conversations using the Phase 5 chat
 * primitives so the visual language is identical to (chat)/index.tsx:
 *   - Session channels (type=session) render as ActiveSessionCards with a
 *     department glyph.
 *   - Regular channels (department/team/custom) use the prototype
 *     ChannelItem row pattern via `chat/ChannelRow`.
 *   - Direct messages use the prototype DMItem pattern via `chat/DMItem`.
 *
 * Section headers use the 11pt uppercase letter-spaced muted label from
 * the prototype (chat-screens.jsx:136-142).
 *
 * The caller owns the header, action bar, new-conversation sheet, and
 * long-press context menu; ChannelList only renders the list and routes
 * taps/long-press through its props. See ADR-0165 for the shared chat
 * surface contract.
 */

import React, { useCallback } from "react";
import { View, SectionList, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Hash, UtensilsCrossed, Wine, BellRing, type LucideIcon } from "lucide-react-native";
import { createStyles, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { EmptyState } from "@/components/ui";
import { ChannelRow } from "@/components/chat/ChannelRow";
import { ActiveSessionCard } from "@/components/chat/ActiveSessionCard";
import type { ConversationWithMeta, ConversationSection } from "@/hooks/queries/use-conversations";

/* ── Helpers ── */

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "NÅ";
  if (diffMins < 60) return `${diffMins}M`;
  if (diffHours < 24) return `${diffHours}T`;

  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAI",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OKT",
    "NOV",
    "DES",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function getSessionChannelName(conversation: ConversationWithMeta): string {
  return conversation.name ?? "#dagvakt-sesjon";
}

function getChannelIcon(conversation: ConversationWithMeta): LucideIcon {
  const name = (conversation.name ?? "").toLowerCase();
  if (name.includes("kjøkken") || name.includes("kokk")) return UtensilsCrossed;
  if (name.includes("bar")) return Wine;
  if (name.includes("service") || name.includes("servitør")) return BellRing;
  return Hash;
}

/* ── Public ChannelList ── */

export type ChannelListProps = {
  sections: ConversationSection[];
  isLoading: boolean;
  onChannelPress: (conversation: ConversationWithMeta) => void;
  onRefresh?: () => void;
  /** Optional long-press hook (e.g. context menu) — parent owns behavior. */
  onLongPress?: (conversation: ConversationWithMeta) => void;
  /** Content appended to top of list (e.g. ActiveNowRow). */
  ListHeaderComponent?: React.ReactElement;
};

export function ChannelList({
  sections,
  isLoading,
  onChannelPress,
  onRefresh,
  onLongPress,
  ListHeaderComponent,
}: ChannelListProps) {
  const styles = useStyles();

  const renderItem = useCallback(
    ({ item }: { item: ConversationWithMeta; section: ConversationSection }) => {
      const longPressHandler = onLongPress
        ? () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onLongPress(item);
          }
        : undefined;

      // Session channels get the prominent ActiveSessionCard.
      if (item.type === "session") {
        const preview = item.lastMessage
          ? truncate(item.lastMessage.content, 40)
          : "Ingen meldinger ennå";
        const time = item.lastMessage ? formatTimestamp(item.lastMessage.created_at) : "NÅ";
        const sender = item.lastMessageSenderName ?? "";
        return (
          <Pressable onLongPress={longPressHandler} delayLongPress={400}>
            <ActiveSessionCard
              icon={getChannelIcon(item)}
              channel={getSessionChannelName(item)}
              time={time}
              sender={sender}
              preview={preview}
              unread={item.unreadCount}
              onPress={() => onChannelPress(item)}
            />
          </Pressable>
        );
      }

      // Everything else — DMs + regular channels — uses ChannelRow which
      // routes internally to DMItem for type==="direct".
      return (
        <ChannelRow
          conversation={item}
          onPress={() => onChannelPress(item)}
          onLongPress={longPressHandler}
        />
      );
    },
    [onChannelPress, onLongPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ConversationSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [styles],
  );

  const keyExtractor = useCallback((item: ConversationWithMeta) => item.id, []);
  const isEmpty = !isLoading && sections.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        title={strings.chat.noMessages}
        subtitle="Kanaler opprettes automatisk for din avdeling og ditt team."
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.listContent}
      refreshing={isLoading}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
}

const useStyles = createStyles((theme) => ({
  sectionHeader: {
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
  listContent: {
    paddingBottom: 160,
  },
}));
