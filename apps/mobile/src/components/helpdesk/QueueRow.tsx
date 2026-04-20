/**
 * QueueRow — single row in the "Min kø" list (Spec §3.2).
 *
 * 76pt tall. Requester avatar + name + 2-line summary + relative time.
 * Waiting dot (8pt ResponsibilityOrb at hue 50 chroma 0.10) on the right
 * when status === 'waiting'. No lighthouse orb on requester — the orb
 * is reserved for the assignee ("me") which is implicit in this view.
 */

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ResponsibilityOrb, LighthouseAvatar, type TicketStatus } from "@smartout/ui";
import { createStyles, useTheme } from "@/theme";
import type { QueueTicket } from "@/hooks/queries/use-my-queue";

export type QueueRowProps = {
  ticket: QueueTicket;
  onPress: (ticket: QueueTicket) => void;
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

export function QueueRow({ ticket, onPress }: QueueRowProps) {
  const styles = useStyles();
  const requesterName = ticket.requester?.display_name ?? "ukjent";

  return (
    <Pressable
      onPress={() => onPress(ticket)}
      accessibilityRole="button"
      accessibilityLabel={`${requesterName}, ${ticket.status === "waiting" ? "venter" : "aktiv"}, ${relative(ticket.opened_at)}. ${ticket.summary}`}
      accessibilityHint="Åpne saken"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {ticket.requester ? (
        <LighthouseAvatar
          avatarUrl={ticket.requester.avatar_url}
          name={ticket.requester.display_name}
          size={40}
          haloState="idle"
        />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {requesterName}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {ticket.summary}
        </Text>
        <Text style={styles.time}>{relative(ticket.opened_at)}</Text>
      </View>
      {ticket.status === "waiting" ? (
        <View style={styles.dot} aria-hidden>
          <ResponsibilityOrb status="waiting" size={10} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    minHeight: 76,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: theme.colors.muted,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.border,
  },
  middle: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontFamily: "Geist-Medium",
    fontSize: 15,
    color: theme.colors.foreground,
  },
  summary: {
    fontFamily: "Geist-Regular",
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  time: {
    fontFamily: "GeistMono-Regular",
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  dot: {
    marginTop: 6,
  },
}));
