/**
 * ChannelList — Shared channel list renderer for Komm surfaces.
 *
 * Presents grouped channels (session + departments + DMs) as a
 * SectionList. The caller owns the header, action bar, new-conversation
 * sheet, and long-press context menu; ChannelList only renders the list
 * and routes taps through `onChannelPress`.
 *
 * Extracted from `(chat)/index.tsx` so the Komm tab's "Kanaler" segment
 * can reuse it alongside the helpdesk queue (Spec §Mobile, Phase 1A.2).
 */

import React, { useCallback } from "react";
import { View, SectionList, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Hash, UtensilsCrossed, Wine, BellRing } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { EmptyState } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import type { ConversationWithMeta, ConversationSection } from "@/hooks/queries/use-conversations";
import type { LucideIcon } from "lucide-react-native";

/* ── Helpers (kept local to keep the chat index in lockstep) ── */

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "N\u00c5";
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
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

function getChannelName(conversation: ConversationWithMeta): string {
  if (conversation.type === "session") return "#dagvakt-sesjon";
  if (
    conversation.type === "department" ||
    conversation.type === "team" ||
    conversation.type === "custom"
  ) {
    return conversation.name ?? "kanal";
  }
  if (conversation.type === "direct") {
    return conversation.other_member_name ?? conversation.name ?? "Samtale";
  }
  return conversation.name ?? "Samtale";
}

function getChannelIcon(conversation: ConversationWithMeta): LucideIcon {
  const name = (conversation.name ?? "").toLowerCase();
  if (name.includes("kjøkken") || name.includes("kokk")) return UtensilsCrossed;
  if (name.includes("bar")) return Wine;
  if (name.includes("service") || name.includes("servitør")) return BellRing;
  return Hash;
}

/* ── Row components ── */

function ChannelItem({
  conversation,
  onPress,
}: {
  conversation: ConversationWithMeta;
  onPress: () => void;
}) {
  const styles = useChannelStyles();
  const theme = useTheme();
  const IconComponent = getChannelIcon(conversation);
  const hasUnread = conversation.unreadCount > 0;

  const lastMessageText = conversation.lastMessage
    ? truncate(conversation.lastMessage.content, 45)
    : "Ingen meldinger ennå";

  const timestamp = conversation.lastMessage
    ? formatTimestamp(conversation.lastMessage.created_at)
    : "";

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        !hasUnread && styles.rowRead,
      ]}
      accessibilityRole="button"
      accessibilityLabel={getChannelName(conversation)}
    >
      <View style={styles.iconTile}>
        <IconComponent
          size={16}
          color={withOpacity(theme.colors.mutedForeground, 0.6)}
          strokeWidth={1.6}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]}>
            {(conversation.name ?? "kanal").toLowerCase()}
          </Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {lastMessageText}
        </Text>
      </View>
      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

function DMItem({
  conversation,
  onPress,
}: {
  conversation: ConversationWithMeta;
  onPress: () => void;
}) {
  const styles = useDMStyles();
  const hasUnread = conversation.unreadCount > 0;
  const name = conversation.name ?? "Samtale";

  const lastMessageText = conversation.lastMessage
    ? truncate(conversation.lastMessage.content, 50)
    : "Ingen meldinger ennå";

  const timestamp = conversation.lastMessage
    ? formatTimestamp(conversation.lastMessage.created_at)
    : "";

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        hasUnread ? styles.cardUnread : styles.cardRead,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={name} imageUrl={conversation.avatar_url} size="md" />
        {hasUnread && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, !hasUnread && styles.nameRead]}>{name}</Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
        <Text style={[styles.preview, hasUnread && styles.previewActive]} numberOfLines={1}>
          {lastMessageText}
        </Text>
      </View>
    </Pressable>
  );
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

      if (item.type === "direct") {
        return (
          <Pressable onLongPress={longPressHandler} delayLongPress={400}>
            <DMItem conversation={item} onPress={() => onChannelPress(item)} />
          </Pressable>
        );
      }
      return (
        <Pressable onLongPress={longPressHandler} delayLongPress={400}>
          <ChannelItem conversation={item} onPress={() => onChannelPress(item)} />
        </Pressable>
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
  },
  listContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 160,
  },
}));

const useChannelStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
  },
  rowPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  rowRead: {
    opacity: 0.7,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  name: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.foreground,
  },
  nameUnread: {
    fontWeight: theme.fontWeights.bold,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
  },
  preview: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  badge: {
    backgroundColor: theme.colors.brandOrange,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff",
  },
}));

const useDMStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.xs,
  },
  cardUnread: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.background,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    ...theme.shadows.sm,
  },
  cardRead: {
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.3)
      : withOpacity(theme.colors.background, 0.5),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.05),
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  name: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.foreground,
  },
  nameRead: {
    color: theme.colors.mutedForeground,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
  },
  preview: {
    ...theme.typography.subheadline,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  previewActive: {
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.medium,
  },
}));
