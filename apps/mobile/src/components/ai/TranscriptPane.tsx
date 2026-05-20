/**
 * TranscriptPane — Scrollable list of voice/chat transcript entries.
 *
 * Extracted from BotssonSheet so it can be tested in isolation and
 * potentially reused by future surfaces (e.g. a session-history drawer).
 *
 * Props:
 *   transcripts — ordered array of TranscriptEntry from BotssonProvider.
 *
 * Auto-scrolls to the latest entry whenever transcripts.length changes.
 * Respects useReducedMotion() — uses instant scroll when reduce-motion is on.
 *
 * Accessibility:
 *   - Outer ScrollView gets accessibilityRole="list" and a descriptive label.
 *   - Each bubble has accessibilityRole="text" and an accessibilityLabel
 *     combining role + content so screen readers announce "Botsson: text" or
 *     "Du: text".
 *
 * Nordic Split / ADR-0366 compliance:
 *   - ZERO hardcoded hex/rgb/rgba/oklch literals.
 *   - All colours, spacing, radii, and typography via theme tokens.
 */

import React, { useEffect, useRef } from "react";
import { ScrollView, View, Text } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { createStyles } from "@/theme";
import type { TranscriptEntry } from "@/providers/botsson-provider";

type TranscriptPaneProps = {
  transcripts: TranscriptEntry[];
};

export function TranscriptPane({ transcripts }: TranscriptPaneProps) {
  const styles = useStyles();
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();

  // Auto-scroll to bottom whenever a new entry arrives.
  // Small timeout lets ScrollView finish layout before scrolling.
  useEffect(() => {
    if (transcripts.length === 0) return;
    const timer = setTimeout(
      () => {
        scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
      },
      // Give layout a tick to settle. When reduce-motion is on the instant
      // scroll still needs one frame, but we can cut the delay in half.
      reduceMotion ? 16 : 50,
    );
    return () => clearTimeout(timer);
  }, [transcripts.length, reduceMotion]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel="Samtalelogg"
    >
      {transcripts.length === 0 && (
        // TODO(i18n): replace with t("botsson.transcript_empty") when i18n key is added
        <Text style={styles.emptyText}>Snakk eller skriv for å starte</Text>
      )}
      {transcripts.map((entry) => (
        <View
          key={entry.id}
          style={[styles.entry, entry.role === "user" ? styles.userEntry : styles.agentEntry]}
          accessibilityRole="text"
          accessibilityLabel={`${entry.role === "agent" ? "Botsson" : "Du"}: ${entry.text}`}
        >
          <Text style={styles.role}>{entry.role === "agent" ? "Botsson" : "Du"}</Text>
          <Text style={styles.bubble}>{entry.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    gap: theme.spacing.element,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: theme.spacing.section,
  },
  entry: {
    gap: 2,
  },
  userEntry: {
    alignItems: "flex-end",
  },
  agentEntry: {
    alignItems: "flex-start",
  },
  role: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
  bubble: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.lg,
    maxWidth: "85%",
    overflow: "hidden",
  },
}));
