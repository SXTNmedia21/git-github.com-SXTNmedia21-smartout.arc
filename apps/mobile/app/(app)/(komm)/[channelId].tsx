/**
 * Komm ticket detail — helpdesk ticket with embedded conversation (Spec §Mobile).
 *
 * Route: /(app)/(komm)/[channelId] — the route param is the channel_id
 * (the conversation thread). Renders:
 *   - TicketHeaderMobile (status, summary, requester, opened-at)
 *   - ConversationBody (message list + realtime + composer)
 *   - ResolveFAB + ResolveSheet (assignee, non-complete tickets only)
 *
 * Phase 1A.2 replaces the Phase 1 "bruk Chat-fanen" placeholder: reps
 * can now reply and resolve without leaving the ticket screen.
 *
 * ADR-0133 boundary: authoring verbs (upgrade to desk, reassign rep,
 * downgrade) stay web-only. This screen only surfaces execution verbs.
 */

import { useCallback, useRef } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@smartout/i18n";
import { LifeBuoy } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { useTicket } from "@/hooks/queries/use-ticket";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useResolveTicket } from "@/hooks/mutations/use-resolve-ticket";
import { TicketHeaderMobile } from "@/components/helpdesk/TicketHeaderMobile";
import { ResolveFAB } from "@/components/helpdesk/ResolveFAB";
import { ResolveSheet, type ResolveSheetHandle } from "@/components/helpdesk/ResolveSheet";
import { ConversationBody } from "@/components/komm/ConversationBody";
import type { TicketStatus } from "@smartout/ui";

export default function KommTicketDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("helpdesk");
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id ?? undefined;

  const { data: ticket, isLoading } = useTicket(channelId, workspaceId);
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
    else router.replace("/(app)/(komm)");
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
  // Give the FAB room at the bottom when the rep can resolve; otherwise
  // keep the composer flush with the safe-area inset.
  const composerBottom = status !== "complete" && isAssignee ? 88 : insets.bottom || 8;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
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

        <ConversationBody
          channelId={ticket.channel_id}
          profileId={profile?.profile_id ?? null}
          profileName={profile?.display_name ?? "Meg"}
          profileAvatarUrl={profile?.avatar_url ?? null}
          workspaceId={profile?.workspace_id ?? null}
          composerStyle={{ paddingBottom: composerBottom }}
        />

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
    </KeyboardAvoidingView>
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
}));
