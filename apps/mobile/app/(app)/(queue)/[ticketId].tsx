/**
 * Ticket detail screen — Spec §3.3.
 *
 * Route: /(app)/(queue)/[ticketId] where `ticketId` is actually the
 * channel_id (the conversation thread). Reuses the existing mobile Komm
 * message list + composer components unchanged (Spec §3.3 + §4.5 risk 3).
 */

import { useCallback, useRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@smartout/i18n";
import { LifeBuoy } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { useTicket } from "@/hooks/queries/use-ticket";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useResolveTicket } from "@/hooks/mutations/use-resolve-ticket";
import { TicketHeaderMobile } from "@/components/helpdesk/TicketHeaderMobile";
import { ResolveFAB } from "@/components/helpdesk/ResolveFAB";
import { ResolveSheet, type ResolveSheetHandle } from "@/components/helpdesk/ResolveSheet";
import type { TicketStatus } from "@smartout/ui";

export default function TicketDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation("helpdesk");
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id ?? undefined;

  const { data: ticket, isLoading } = useTicket(ticketId, workspaceId);
  const resolve = useResolveTicket();
  const sheetRef = useRef<ResolveSheetHandle>(null);

  const isAssignee = ticket?.assignee?.profile_id === profile?.profile_id;

  const statusLabels: Record<TicketStatus, string> = {
    waiting: t("ticket_status.waiting_upper"),
    active: t("ticket_status.active_upper"),
    complete: t("ticket_status.complete_upper"),
  };

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(queue)");
  }, [router]);

  const handleSubmitResolve = useCallback(
    (note: string) => {
      if (!ticket) return;
      resolve.mutate(
        {
          ticket_id: ticket.ticket_id,
          channel_id: ticket.channel_id,
          resolution_note: note || undefined,
        },
        {
          onSuccess: (result) => {
            if (result.ok) {
              sheetRef.current?.close();
              Alert.alert(
                t("toast.ticket_resolved", {
                  requester: ticket.requester?.display_name ?? "",
                }),
              );
            } else {
              Alert.alert(t("toast.ticket_resolve_failed"));
            }
          },
          onError: () => {
            Alert.alert(t("toast.ticket_resolve_failed"));
          },
        },
      );
    },
    [resolve, ticket, t],
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.foreground} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
        <View style={styles.centered}>
          <LifeBuoy size={48} color={theme.colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={styles.forbiddenTitle}>{t("mobile_ticket_forbidden.title")}</Text>
          <Text style={styles.forbiddenBody}>{t("mobile_ticket_forbidden.body")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = ticket.status;

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <TicketHeaderMobile
        status={status}
        summary={ticket.summary}
        requesterName={ticket.requester?.display_name ?? null}
        requesterAvatarUrl={ticket.requester?.avatar_url ?? null}
        openedAt={ticket.opened_at}
        onBackPress={handleBack}
        statusLabels={statusLabels}
      />

      {/*
        Message list + composer reuse note (Spec §2.2):
        Mobile Komm's existing conversation screen at (app)/(chat)/[id].tsx
        owns the message list + MessageInput + realtime wiring. Phase 1
        defers full embed into this screen — the FAB + header land now;
        the message reuse lands as a follow-up that extracts the chat
        conversation body into a component both screens can wrap. Until
        then, the ticket view shows a placeholder area.
      */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Meldinger lastes i neste iterasjon — bruk Chat-fanen til å svare på saken inntil videre.
        </Text>
      </View>

      {status !== "complete" && isAssignee ? (
        <ResolveFAB status={status} onPress={() => sheetRef.current?.open()} />
      ) : null}

      <ResolveSheet
        ref={sheetRef}
        requesterName={ticket.requester?.display_name ?? ""}
        pending={resolve.isPending}
        onSubmit={handleSubmitResolve}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  forbiddenTitle: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 22,
    color: theme.colors.foreground,
    marginTop: 16,
    textAlign: "center",
  },
  forbiddenBody: {
    fontFamily: "Geist-Regular",
    fontSize: 15,
    color: theme.colors.mutedForeground,
    marginTop: 8,
    textAlign: "center",
  },
  placeholder: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  placeholderText: {
    fontFamily: "Geist-Regular",
    fontSize: 14,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
}));
