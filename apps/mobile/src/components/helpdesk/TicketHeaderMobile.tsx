/**
 * TicketHeaderMobile — Spec §3.3 header (88pt custom).
 *
 * Back chevron, 40pt ResponsibilityOrb, status label, summary, and
 * "[requester] · [relative time]" meta line. No reassign affordance on
 * mobile per Spec §3.3 + ADR-0133.
 */

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, Check } from "lucide-react-native";
import { ResponsibilityOrb, LighthouseAvatar, StatusLabel, type TicketStatus } from "@smartout/ui";
import { createStyles } from "@/theme";

export type TicketHeaderMobileProps = {
  status: TicketStatus;
  summary: string;
  requesterName: string | null;
  requesterAvatarUrl: string | null;
  openedAt: string;
  onBackPress: () => void;
  statusLabels: Record<TicketStatus, string>;
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "nå";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t`;
  return `${Math.floor(h / 24)} d`;
}

export function TicketHeaderMobile({
  status,
  summary,
  requesterName,
  requesterAvatarUrl,
  openedAt,
  onBackPress,
  statusLabels,
}: TicketHeaderMobileProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBackPress}
        accessibilityRole="button"
        accessibilityLabel="Tilbake"
        style={styles.backButton}
        hitSlop={8}
      >
        <ChevronLeft size={24} color={styles.backIcon.color} />
      </Pressable>

      <View style={styles.orbWrap}>
        <ResponsibilityOrb status={status} size={40} />
        {status === "complete" ? (
          <View style={styles.checkOverlay} pointerEvents="none">
            <Check size={20} color={styles.checkColor.color} />
          </View>
        ) : null}
      </View>

      <View style={styles.statusLabel}>
        <StatusLabel status={status} labels={statusLabels} />
      </View>
      <Text numberOfLines={2} style={styles.summary}>
        {summary}
      </Text>
      <View style={styles.metaRow}>
        {requesterName ? (
          <>
            <LighthouseAvatar
              avatarUrl={requesterAvatarUrl}
              name={requesterName}
              size={16}
              haloState="idle"
            />
            <Text style={styles.meta}>
              {requesterName} · {relative(openedAt)}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>{relative(openedAt)}</Text>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backIcon: {
    color: theme.colors.foreground,
  },
  orbWrap: {
    marginTop: 4,
    width: 40,
    height: 40,
    position: "relative",
  },
  checkOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkColor: {
    color: theme.colors.foreground,
  },
  statusLabel: {
    marginTop: 10,
  },
  summary: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 22,
    lineHeight: 26,
    color: theme.colors.foreground,
    marginTop: 4,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    fontFamily: "Geist-Regular",
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },
}));
