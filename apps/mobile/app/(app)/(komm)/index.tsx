/**
 * Komm index — "Min kø" + "Kanaler" segment-tabbed inbox (Spec §Mobile).
 *
 * Min kø: FlatList of helpdesk tickets assigned to the rep via
 *   `useMyQueue`. Row tap navigates to `/(app)/(komm)/[channelId]`.
 * Kanaler: SectionList of channels (session, departments, DMs) via
 *   `useGroupedConversations`. Row tap navigates to the chat detail
 *   screen `/(app)/(chat)/[id]` (the existing chat experience remains
 *   canonical for general conversations; helpdesk threads open inside
 *   the Komm ticket detail screen so the resolve FAB is available).
 *
 * Default segment: "Min kø" when the rep has open tickets; otherwise
 * "Kanaler" so the tab is useful for non-responders too.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@smartout/i18n";
import { AlertCircle } from "lucide-react-native";
import { ResponsibilityOrb } from "@smartout/ui";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { useMyQueue, type QueueTicket } from "@/hooks/queries/use-my-queue";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import {
  useGroupedConversations,
  type ConversationWithMeta,
} from "@/hooks/queries/use-conversations";
import { usePinnedConversations } from "@/hooks/stores/use-pinned-conversations";
import { QueueRow } from "@/components/helpdesk/QueueRow";
import { ChannelList } from "@/components/komm/ChannelList";

type Segment = "queue" | "channels";

export default function KommScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation("helpdesk");

  const { data: profile } = useMyProfile();
  const profileId = profile?.profile_id;
  const workspaceId = profile?.workspace_id ?? undefined;

  const queueQuery = useMyQueue(profileId, workspaceId);
  const { phase } = useShiftPhase();
  const isDuringShift = phase === "during_shift";
  const { pinnedIds } = usePinnedConversations();
  const {
    sections,
    isLoading: channelsLoading,
    refetch: refetchChannels,
  } = useGroupedConversations(isDuringShift, pinnedIds);

  const queueData = queueQuery.data;
  const openCount = queueData?.length ?? 0;
  const waitingCount = useMemo(
    () => (queueData ?? []).filter((ticket) => ticket.status === "waiting").length,
    [queueData],
  );

  // Default: Min kø when the rep has open tickets, otherwise Kanaler.
  // Locked in once on first non-loading queue result so it doesn't flip
  // under the rep while they're reading.
  const [segment, setSegment] = useState<Segment | null>(null);
  useEffect(() => {
    if (segment !== null) return;
    if (queueQuery.isLoading) return;
    setSegment(openCount > 0 ? "queue" : "channels");
  }, [segment, queueQuery.isLoading, openCount]);
  const activeSegment: Segment = segment ?? "queue";

  const goToTicket = useCallback(
    (ticket: QueueTicket) => {
      router.push({
        pathname: "/(app)/(komm)/[channelId]",
        params: { channelId: ticket.channel_id },
      });
    },
    [router],
  );

  const goToChannel = useCallback(
    (conversation: ConversationWithMeta) => {
      router.push(`/(app)/(chat)/${conversation.id}`);
    },
    [router],
  );

  const renderQueueItem = useCallback(
    ({ item }: { item: QueueTicket }) => <QueueRow ticket={item} onPress={goToTicket} />,
    [goToTicket],
  );

  const keyExtractor = useCallback((item: QueueTicket) => item.ticket_id, []);
  const separator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  const hasQueue = openCount > 0;
  const hasWaiting = waitingCount > 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("mobile_tab.queue")}</Text>
        {hasQueue ? (
          <Text style={styles.subcount}>
            {hasWaiting
              ? t("mobile_queue.subcount_with_waiting", {
                  open: openCount,
                  waiting: waitingCount,
                })
              : t("mobile_queue.subcount_no_waiting", { count: openCount })}
          </Text>
        ) : null}
      </View>

      {/* Segment tabs */}
      <View style={styles.segmentRow}>
        <SegmentButton
          active={activeSegment === "queue"}
          label={hasQueue ? `${t("mobile_tab.queue")} (${openCount})` : t("mobile_tab.queue")}
          onPress={() => setSegment("queue")}
        />
        <SegmentButton
          active={activeSegment === "channels"}
          label="Kanaler"
          onPress={() => setSegment("channels")}
        />
      </View>

      {activeSegment === "queue" ? (
        queueQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.foreground} />
          </View>
        ) : queueQuery.isError ? (
          <View style={styles.centered}>
            <AlertCircle size={48} color={theme.colors.mutedForeground} />
            <Text style={styles.errorTitle}>{t("mobile_queue.error_title")}</Text>
            <Pressable onPress={() => void queueQuery.refetch()} style={styles.retryButton}>
              <Text style={styles.retryLabel}>{t("mobile_queue.error_retry")}</Text>
            </Pressable>
          </View>
        ) : !hasQueue ? (
          <View style={styles.centered}>
            <View style={styles.emptyOrbWrap}>
              <ResponsibilityOrb status="complete" size={160} />
            </View>
            <Text style={styles.emptyTitle}>{t("mobile_queue.empty_title")}</Text>
            <Text style={styles.emptyBody}>{t("mobile_queue.empty_body")}</Text>
          </View>
        ) : (
          <FlatList
            data={queueData}
            renderItem={renderQueueItem}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={separator}
            refreshControl={
              <RefreshControl
                refreshing={queueQuery.isRefetching}
                onRefresh={() => void queueQuery.refetch()}
                tintColor={theme.colors.foreground}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        <ChannelList
          sections={sections}
          isLoading={channelsLoading}
          onChannelPress={goToChannel}
          onRefresh={refetchChannels}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Segment button ── */

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useSegmentStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, active && styles.buttonActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const useSegmentStyles = createStyles((theme) => ({
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  buttonActive: {
    borderBottomColor: theme.colors.brandOrange,
  },
  label: {
    fontFamily: "Geist-Medium",
    fontSize: 14,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },
  labelActive: {
    color: theme.colors.foreground,
  },
}));

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 32,
    lineHeight: 36,
    color: theme.colors.foreground,
  },
  subcount: {
    fontFamily: "Geist-Regular",
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(theme.colors.border, 0.3),
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontFamily: "Geist-Medium",
    fontSize: 16,
    color: theme.colors.foreground,
    marginTop: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retryLabel: {
    fontFamily: "Geist-Medium",
    fontSize: 14,
    color: theme.colors.foreground,
  },
  emptyOrbWrap: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 22,
    color: theme.colors.foreground,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: "Geist-Regular",
    fontSize: 15,
    color: theme.colors.mutedForeground,
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    opacity: 0.4,
  },
}));
