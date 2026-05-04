/**
 * TicketHeaderMobile — custom screen header for the helpdesk ticket detail.
 *
 * Phase 4 visual redesign per Claude Design prototype
 *   docs/design/smartout-design-helpdesk/project/prototype/mobile-screens.jsx:358-404
 *
 * Spec:
 *   - Top row: circular back chevron (40 pt) + spacer + more-button (40 pt)
 *   - Body: Orb 44 pulse (waiting) / status-dependent + right-side content
 *       - StatusLabel (mono 11 uppercase)
 *       - Instrument Serif title 22, tracking-tight
 *       - Meta: inline Avatar 18 + "Linn · #lønn · 14 min siden" (13 muted)
 *   - Bottom border hairline divider.
 *
 * Kept to the existing prop contract (status / summary / requester* /
 * openedAt / onBackPress / statusLabels) so
 * `app/(app)/(komm)/[channelId].tsx` does not need to change.
 *
 * `deskTag` is an optional "#lønn" / "#hms" label — when omitted the meta
 * line falls back to "[name] · [relative time]". Spec §3.3 puts tags inline.
 */

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LighthouseAvatar, type TicketStatus } from "@smartout/ui";
import { Orb, StatusLabel } from "@/components/orb";
import { createStyles } from "@/theme";

export type TicketHeaderMobileProps = {
  status: TicketStatus;
  summary: string;
  requesterName: string | null;
  requesterAvatarUrl: string | null;
  openedAt: string;
  onBackPress: () => void;
  /** Unused by Phase 1 StatusLabel (hardcoded Norwegian labels), kept for
   *  backwards compatibility with the caller. */
  statusLabels?: Record<TicketStatus, string>;
  /** Optional desk hashtag (e.g. "#lønn") shown in the meta row. */
  deskTag?: string;
  /** Optional overflow-menu handler. When omitted, the button is hidden. */
  onMorePress?: () => void;
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "nå";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} d siden`;
}

export function TicketHeaderMobile({
  status,
  summary,
  requesterName,
  requesterAvatarUrl,
  openedAt,
  onBackPress,
  deskTag,
  onMorePress,
}: TicketHeaderMobileProps) {
  const styles = useStyles();

  const handleBack = () => {
    void Haptics.selectionAsync();
    onBackPress();
  };

  const handleMore = onMorePress
    ? () => {
        void Haptics.selectionAsync();
        onMorePress();
      }
    : undefined;

  const metaBits = [requesterName, deskTag, relative(openedAt)].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );

  return (
    <View style={styles.header}>
      {/* Row 1 — back chevron + more-button */}
      <View style={styles.topRow}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
          style={styles.iconButton}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={styles.iconColor.color} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {handleMore ? (
          <Pressable
            onPress={handleMore}
            accessibilityRole="button"
            accessibilityLabel="Mer"
            style={styles.iconButton}
            hitSlop={8}
          >
            <MoreHorizontal size={20} color={styles.iconMutedColor.color} />
          </Pressable>
        ) : null}
      </View>

      {/* Row 2 — Orb + body */}
      <View style={styles.bodyRow}>
        <View style={styles.orbWrap}>
          <Orb
            size={44}
            status={status}
            pulse={status === "waiting"}
            withCheck={status === "complete"}
          />
        </View>
        <View style={styles.body}>
          <StatusLabel status={status} />
          <Text numberOfLines={2} style={styles.summary}>
            {summary}
          </Text>
          <View style={styles.metaRow}>
            {requesterName ? (
              <LighthouseAvatar
                avatarUrl={requesterAvatarUrl}
                name={requesterName}
                size={18}
                haloState="idle"
              />
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {metaBits.join(" · ")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconColor: {
    color: theme.colors.foreground,
  },
  iconMutedColor: {
    color: theme.colors.mutedForeground,
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  orbWrap: {
    width: 44,
    height: 44,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  summary: {
    fontFamily: "InstrumentSerif-Regular",
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: theme.colors.foreground,
    marginTop: 2,
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
    flexShrink: 1,
  },
}));
