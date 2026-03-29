/**
 * Channel list screen — Nordic Split design.
 *
 * Header: avatar (left) → "Kanaler" title (italic serif, orange) → settings icon
 *
 * Three sections:
 * - "Aktive vakter" — session channel (during shift), highlighted card with glow dot
 * - "Avdelinger" — department + team group channels with icon tiles
 * - "Direktemeldinger" — DM cards with avatars, online indicators, typing state
 *
 * Data: useGroupedConversations() provides sections with ConversationWithMeta items.
 */

import { useCallback, useRef, useState } from "react";
import { View, SectionList, Text, Pressable } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Menu, Hash, UtensilsCrossed, Wine, BellRing, Settings, Plus } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";
import { EmptyState } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { ActionBar } from "@/components/navigation/ActionBar";
import {
  useGroupedConversations,
  type ConversationWithMeta,
  type ConversationSection,
} from "@/hooks/queries/use-conversations";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { NewConversationSheet } from "@/components/chat/NewConversationSheet";
import { ActiveNowRow } from "@/components/chat/ActiveNowRow";
import { ConversationContextMenu } from "@/components/chat/ConversationContextMenu";
import { useOnlineProfiles } from "@/hooks/realtime/use-online-profiles";
import { usePinnedConversations } from "@/hooks/stores/use-pinned-conversations";
import { supabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react-native";

/* ── Helpers ── */

/** Formats a timestamp into a short relative or absolute string */
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

/** Pick an icon for department/team channels based on name heuristics */
function getChannelIcon(conversation: ConversationWithMeta): LucideIcon {
  const name = (conversation.name ?? "").toLowerCase();
  if (name.includes("kjøkken") || name.includes("kokk")) return UtensilsCrossed;
  if (name.includes("bar")) return Wine;
  if (name.includes("service") || name.includes("servitør")) return BellRing;
  return Hash;
}

/* ── Active Session Card ── */

function ActiveSessionCard({
  conversation,
  onPress,
}: {
  conversation: ConversationWithMeta;
  onPress: () => void;
}) {
  const styles = useSessionStyles();
  const theme = useTheme();
  const IconComponent = getChannelIcon(conversation);
  const hasUnread = conversation.unreadCount > 0;

  const lastMessageText = conversation.lastMessage
    ? `${conversation.lastMessageSenderName ?? ""}: ${truncate(conversation.lastMessage.content, 40)}`
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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={getChannelName(conversation)}
    >
      <View style={styles.iconCircle}>
        <IconComponent size={18} color={theme.colors.brandOrange} strokeWidth={1.6} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{getChannelName(conversation)}</Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {lastMessageText}
        </Text>
      </View>
      {hasUnread && (
        <View style={styles.unreadCol}>
          <View style={styles.glowDot} />
          <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useSessionStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    padding: theme.spacing.element,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.8) : theme.colors.muted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    ...theme.shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.1),
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
  unreadCol: {
    alignItems: "center",
    gap: 4,
  },
  glowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
  },
  unreadCount: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.brandOrange,
  },
}));

/* ── Channel Row (departments/teams) ── */

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

/* ── DM Row ── */

function DMItem({
  conversation,
  onPress,
}: {
  conversation: ConversationWithMeta;
  onPress: () => void;
}) {
  const styles = useDMStyles();
  const _theme = useTheme();
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
        {/* Online indicator — placeholder, always shows for the first DM */}
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

/* ── Main Screen ── */

export default function ChatIndex() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phase } = useShiftPhase();
  const isDuringShift = phase === "during_shift";
  const { data: profile } = useMyProfile();
  const newConvSheetRef = useRef<GorhomBottomSheet>(null);
  const onlineProfiles = useOnlineProfiles();
  const { pinnedIds, isPinned, togglePin } = usePinnedConversations();

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    conversationId: string;
    isMuted: boolean;
  }>({ visible: false, conversationId: "", isMuted: false });

  const {
    sections,
    isLoading,
    isError: _isError,
    refetch,
  } = useGroupedConversations(isDuringShift, pinnedIds);

  const handleChannelPress = useCallback(
    (conversation: ConversationWithMeta) => {
      router.push(`/(app)/(chat)/${conversation.id}`);
    },
    [router],
  );

  /** Find or create a DM channel with the target profile, then navigate to it.
   *  Uses create_channel RPC which is idempotent for direct channels (pair hash). */
  const handleNewConversation = useCallback(
    async (targetProfileId: string, _displayName: string) => {
      if (!profile) return;
      newConvSheetRef.current?.close();

      // create_channel with type 'direct' is idempotent — returns existing DM if pair hash matches
      const { data: result, error: rpcError } = await supabase.rpc("create_channel", {
        p_workspace_id: profile.workspace_id,
        p_channel_type: "direct",
        p_created_by: profile.profile_id,
        p_member_profile_ids: [profile.profile_id, targetProfileId],
      });

      if (rpcError || !result) return;

      const channelId = (result as { channel_id: string }).channel_id;
      router.push(`/(app)/(chat)/${channelId}`);
    },
    [profile, router],
  );

  const handleLongPress = useCallback((conversation: ConversationWithMeta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setContextMenu({
      visible: true,
      conversationId: conversation.id,
      isMuted: conversation.participant?.is_muted ?? false,
    });
  }, []);

  const renderItem = useCallback(
    ({ item, section: _section }: { item: ConversationWithMeta; section: ConversationSection }) => {
      const longPressHandler = () => handleLongPress(item);

      if (item.type === "session") {
        return (
          <Pressable onLongPress={longPressHandler} delayLongPress={400}>
            <ActiveSessionCard conversation={item} onPress={() => handleChannelPress(item)} />
          </Pressable>
        );
      }
      if (item.type === "direct") {
        return (
          <Pressable onLongPress={longPressHandler} delayLongPress={400}>
            <DMItem conversation={item} onPress={() => handleChannelPress(item)} />
          </Pressable>
        );
      }
      return (
        <Pressable onLongPress={longPressHandler} delayLongPress={400}>
          <ChannelItem conversation={item} onPress={() => handleChannelPress(item)} />
        </Pressable>
      );
    },
    [handleChannelPress, handleLongPress],
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar — consistent topbar pattern */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/settings");
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.headerTitle}>Kanaler</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              newConvSheetRef.current?.snapToIndex(0);
            }}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Ny samtale"
          >
            <Plus size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(app)/(chat)/settings");
            }}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Innstillinger"
          >
            <Settings
              size={22}
              color={withOpacity(theme.colors.foreground, 0.45)}
              strokeWidth={1.6}
            />
          </Pressable>
        </View>
      </Animated.View>

      <ActionBar />

      {/* Active Now — online colleagues */}
      <ActiveNowRow profiles={onlineProfiles} onPress={handleNewConversation} />

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
          contentOffset={{ x: 0, y: 0 }}
          refreshing={isLoading}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Long-press context menu */}
      <ConversationContextMenu
        visible={contextMenu.visible}
        isPinned={isPinned(contextMenu.conversationId)}
        isMuted={contextMenu.isMuted}
        onTogglePin={() => togglePin(contextMenu.conversationId)}
        onToggleMute={() => {
          // TODO: update chat_participant.is_muted in DB
        }}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
      />

      {/* New conversation sheet */}
      <NewConversationSheet ref={newConvSheetRef} onSelectProfile={handleNewConversation} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* Header */
  headerBar: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },

  /* Section headers */
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

  /* List */
  listContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 160,
  },
}));
