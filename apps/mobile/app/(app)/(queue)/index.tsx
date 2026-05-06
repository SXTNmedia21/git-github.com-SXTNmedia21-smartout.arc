/**
 * Queue screen — "Min kø" (Spec §3.2).
 *
 * FlatList of helpdesk tickets assigned to the current user. Pull-to-
 * refresh reloads the queue. Rows navigate to the ticket detail screen.
 *
 * Spec deviation: Spec §3.2 recommends FlashList; mobile doesn't yet
 * depend on @shopify/flash-list so we use FlatList. Revisit when the
 * queue grows past ~40 rows.
 */

import { useCallback, useMemo } from "react";
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
import { createStyles, useTheme } from "@/theme";
import { useMyQueue, type QueueTicket } from "@/hooks/queries/use-my-queue";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { QueueRow } from "@/components/helpdesk/QueueRow";
import { ResponsibilityOrb } from "@smartout/ui";
import { AlertCircle } from "lucide-react-native";

export default function QueueScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation("helpdesk");

  const { data: profile } = useMyProfile();
  const profileId = profile?.profile_id;
  const workspaceId = profile?.workspace_id ?? undefined;

  const { data, isLoading, isError, refetch, isRefetching } = useMyQueue(profileId, workspaceId);

  const waitingCount = useMemo(
    () => (data ?? []).filter((t) => t.status === "waiting").length,
    [data],
  );
  const openCount = data?.length ?? 0;
  const hasAny = openCount > 0;
  const hasWaiting = waitingCount > 0;

  const goToTicket = useCallback(
    (ticket: QueueTicket) => {
      router.push({
        pathname: "/(app)/(queue)/[ticketId]",
        params: { ticketId: ticket.channel_id },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: QueueTicket }) => <QueueRow ticket={item} onPress={goToTicket} />,
    [goToTicket],
  );

  const keyExtractor = useCallback((item: QueueTicket) => item.ticket_id, []);
  const separator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("mobile_tab.queue")}</Text>
        {hasAny ? (
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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.foreground} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <AlertCircle size={48} color={theme.colors.mutedForeground} />
          <Text style={styles.errorTitle}>{t("mobile_queue.error_title")}</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryButton}>
            <Text style={styles.retryLabel}>{t("mobile_queue.error_retry")}</Text>
          </Pressable>
        </View>
      ) : !hasAny ? (
        <View style={styles.centered}>
          <View style={styles.emptyOrbWrap}>
            <ResponsibilityOrb status="complete" size={160} />
          </View>
          <Text style={styles.emptyTitle}>{t("mobile_queue.empty_title")}</Text>
          <Text style={styles.emptyBody}>{t("mobile_queue.empty_body")}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={separator}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.foreground}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

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
