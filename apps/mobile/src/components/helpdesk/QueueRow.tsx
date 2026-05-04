/**
 * QueueRow — single row in the "Min kø" list.
 *
 * Phase 4 visual redesign per Claude Design prototype
 *   docs/design/smartout-design-helpdesk/project/prototype/mobile-screens.jsx:322-354
 *
 * Spec:
 *   - Padding 14 / 20, borderTop 1px var(--border)
 *   - Opt-in `highlighted` → bg oklch(0.65 0.22 40 / 0.03) (brand-orange 3%)
 *   - Opt-in `dim` → opacity 0.55 (resolved rows in "Løst i dag")
 *   - Avatar 40pt on the left
 *   - Name: Geist 15 weight 500
 *   - Summary: 2-line clamped, 13.5pt muted
 *   - Time: Geist Mono 11pt muted
 *   - Right side: Orb size 14 (pulse waiting, withCheck complete)
 *
 * Haptic: `Haptics.selectionAsync()` on press for tactile queue feedback.
 *
 * Compatibility: `LighthouseAvatar` from `@smartout/ui` is kept (not the
 * Phase 1 `@/components/orb` variant) because real avatar URL rendering is
 * required in production; the Phase 1 primitive only renders initials. Noted
 * in HANDOFF.
 */

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LighthouseAvatar } from "@smartout/ui";
import { Orb } from "@/components/orb";
import { createStyles, withOpacity } from "@/theme";
import type { QueueTicket } from "@/hooks/queries/use-my-queue";

/**
 * Alias exported for the `QueueScreen` assembler which builds placeholder
 * rows with a `complete` status for the "Løst i dag" group. Runtime-only
 * shape — the `QueueRow` component still takes a `QueueTicket` and checks
 * status with a string comparison (see `resolvedStatus` below).
 */
export type QueueRowTicket = Omit<QueueTicket, "status"> & {
  status: "waiting" | "active" | "complete";
};

export type QueueRowProps = {
  ticket: QueueRowTicket;
  /** Callback receives the narrower `QueueTicket` — in practice the
   *  component is fed rows from `useMyQueue` which only emits waiting
   *  or active statuses. Complete rows (Løst i dag) are non-interactive
   *  display-only; we still forward the press but callers may ignore
   *  the complete case by narrowing on `ticket.status`. */
  onPress: (ticket: QueueTicket) => void;
  /** Subtle warm-orange tint on the row (e.g. first waiting row). */
  highlighted?: boolean;
  /** Fade the row to 55 % (e.g. "Løst i dag" group). */
  dim?: boolean;
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

export function QueueRow({ ticket, onPress, highlighted, dim }: QueueRowProps) {
  const styles = useStyles();
  const requesterName = ticket.requester?.display_name ?? "ukjent";
  // Widen status for the `complete` check — the prototype's "Løst i dag"
  // group feeds rows with a `complete` status through a widened alias.
  // See `QueueRowTicket` above.
  const resolvedStatus: string = ticket.status;

  const handlePress = () => {
    void Haptics.selectionAsync();
    // Cast: onPress signature is the narrow status union; runtime
    // callers only invoke for waiting/active tickets (QueueScreen
    // gates the `complete` group visually only).
    onPress(ticket as QueueTicket);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${requesterName}, ${ticket.status === "waiting" ? "venter" : "aktiv"}, ${relative(ticket.opened_at)}. ${ticket.summary}`}
      accessibilityHint="Åpne saken"
      style={({ pressed }) => [
        styles.row,
        highlighted && styles.rowHighlighted,
        dim && styles.rowDim,
        pressed && styles.rowPressed,
      ]}
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
      {resolvedStatus === "waiting" ? (
        <View style={styles.orbSlot} aria-hidden>
          <Orb size={14} status="waiting" pulse />
        </View>
      ) : resolvedStatus === "complete" ? (
        <View style={styles.orbSlot} aria-hidden>
          <Orb size={14} status="complete" withCheck />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    // Prototype values: padding 14 vertical / 20 horizontal.
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  rowHighlighted: {
    // oklch(0.65 0.22 40 / 0.03) ≈ #f97316 at 3 % alpha (brand-orange).
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.03),
  },
  rowDim: {
    opacity: 0.55,
  },
  rowPressed: {
    backgroundColor: theme.colors.muted,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.border,
  },
  middle: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  name: {
    fontFamily: "Geist-Medium",
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.foreground,
    marginBottom: 2,
  },
  summary: {
    fontFamily: "Geist-Regular",
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.mutedForeground,
  },
  time: {
    fontFamily: "GeistMono-Regular",
    fontSize: 11,
    color: theme.colors.mutedForeground,
    marginTop: 6,
  },
  orbSlot: {
    paddingTop: 4,
  },
}));
