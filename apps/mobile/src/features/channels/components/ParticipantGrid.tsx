/**
 * ParticipantGrid — Adaptive layout that switches between four modes based on
 * participant count and video availability.
 *
 * Modes:
 *   Waiting    (0-1 participants)  — own tile centred + "waiting" message
 *   Audio-only (no video tracks)   — wrapping avatar grid
 *   Video grid (1-2 with video)    — equal-split flex row
 *   Focus mode (3+ with video)     — active speaker large, strip of others below
 *
 * Speaking intensity is driven by a Reanimated shared value so the glow
 * in ParticipantTile follows the same spring curve as the rest of the UI.
 */
import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import Animated, { useSharedValue, withSpring } from "react-native-reanimated";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { ParticipantTile } from "./ParticipantTile";
import type { ParticipantTrackInfo } from "@/hooks/use-call-tracks";

// Nordic Split spring values — slow, organic motion
const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 };

type Props = {
  participants: ParticipantTrackInfo[];
  activeSpeakerIdentity: string | null;
  hasAnyVideo: boolean;
};

export function ParticipantGrid({ participants, activeSpeakerIdentity, hasAnyVideo }: Props) {
  const styles = useStyles();

  // Shared value that tracks speaking intensity (0 = silent, 1 = speaking).
  // Passed through to drive tile glow without triggering React re-renders.
  const speakingIntensity = useSharedValue(0);
  speakingIntensity.value = withSpring(activeSpeakerIdentity ? 1 : 0, SPRING_CONFIG);

  // Separate the active speaker from the rest so focus mode can position them.
  const { activeSpeaker, otherParticipants } = useMemo(() => {
    if (!activeSpeakerIdentity) {
      return { activeSpeaker: participants[0] ?? null, otherParticipants: participants.slice(1) };
    }
    const active =
      participants.find((p) => p.identity === activeSpeakerIdentity) ?? participants[0] ?? null;
    const others = participants.filter((p) => p.identity !== active?.identity);
    return { activeSpeaker: active, otherParticipants: others };
  }, [participants, activeSpeakerIdentity]);

  // --- Waiting mode: solo or empty ---
  if (participants.length <= 1) {
    return (
      <View style={styles.waitingContainer}>
        {activeSpeaker && (
          <View style={styles.soloTileWrapper}>
            <ParticipantTile participant={activeSpeaker} size="large" />
          </View>
        )}
        <Text style={styles.waitingText}>{strings.call.waitingForParticipants}</Text>
      </View>
    );
  }

  // --- Audio-only mode: no video tracks at all ---
  if (!hasAnyVideo) {
    return (
      <View style={styles.audioGrid}>
        {participants.map((p) => (
          <View key={p.identity} style={styles.audioTileWrapper}>
            <ParticipantTile participant={p} size={participants.length > 4 ? "small" : "large"} />
          </View>
        ))}
      </View>
    );
  }

  // --- Video grid: 1-2 participants with video (equal split) ---
  if (participants.length <= 2) {
    return (
      <View style={styles.videoGrid}>
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} size="large" />
        ))}
      </View>
    );
  }

  // --- Focus mode: 3+ participants with video ---
  // Active speaker takes the upper region (flex: 3), others scroll horizontally (flex: 1).
  return (
    <View style={styles.focusContainer}>
      {/* Large active speaker tile */}
      <Animated.View style={styles.focusMain}>
        {activeSpeaker && <ParticipantTile participant={activeSpeaker} size="large" />}
      </Animated.View>

      {/* Horizontal strip of remaining participants */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.focusStripContent}
        style={styles.focusStrip}
        accessibilityLabel={`${otherParticipants.length} ${strings.call.participants}`}
      >
        {otherParticipants.map((p) => (
          <View key={p.identity} style={styles.focusStripTile}>
            <ParticipantTile participant={p} size="small" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  // --- Waiting ---
  waitingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
  },
  soloTileWrapper: {
    width: 160,
    height: 200,
  },
  waitingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },

  // --- Audio-only grid ---
  audioGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[4],
    padding: theme.spacing[4],
  },
  audioTileWrapper: {
    // Each avatar tile gets a fixed slot so the wrap is predictable
    minWidth: 80,
    alignItems: "center",
  },

  // --- Video grid (equal split) ---
  videoGrid: {
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing[2],
    padding: theme.spacing[2],
  },

  // --- Focus mode ---
  focusContainer: {
    flex: 1,
  },
  focusMain: {
    // Active speaker occupies ~75 % of vertical space
    flex: 3,
    padding: theme.spacing[2],
  },
  focusStrip: {
    // Strip takes ~25 % of vertical space
    flex: 1,
  },
  focusStripContent: {
    alignItems: "center",
    paddingHorizontal: theme.spacing[2],
    gap: theme.spacing[2],
  },
  focusStripTile: {
    width: 100,
    height: 80,
  },
}));
