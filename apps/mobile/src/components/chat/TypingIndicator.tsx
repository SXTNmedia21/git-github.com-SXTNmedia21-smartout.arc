/**
 * TypingIndicator — Shows who is typing above the composer.
 *
 * Renders nothing when nobody is typing. Shows a pill with:
 *   1 typer  → "Anna skriver…"
 *   2 typers → "Anna og Bob skriver…"
 *   3+ typers → "3 personer skriver…"
 *
 * Profile IDs → display names resolved via a direct Supabase query
 * whenever the typing set changes (max 2 names needed; tiny payload).
 *
 * Animation:
 *   Entering: FadeIn with nativeTheme.motion.enterMs duration.
 *   Exiting:  FadeOut with nativeTheme.motion.exitMs duration.
 *
 * Tokens only — no hex colors, no magic numbers for duration.
 * Uses `nativeTheme` from @smartout/design-tokens/native for entering/exiting durations.
 * (The web-only `motion` export from @smartout/design-tokens is not available in RN.)
 */

import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { nativeTheme } from "@smartout/design-tokens/native";
import { createStyles } from "@/theme";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { supabase } from "@/lib/supabase";

type Props = {
  /** Channel to monitor for typing presence. */
  channelId: string;
  /** Current user's profile_id — filtered from the indicator. */
  selfProfileId: string | null;
};

/**
 * Resolve a Set of profile_ids to display names via a single Supabase query.
 * Returns at most 2 names (enough to render "Anna og Bob skriver…").
 */
async function resolveDisplayNames(profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const ids = profileIds.slice(0, 2);
  const { data } = await supabase.from("profile").select("display_name").in("profile_id", ids);
  return (data ?? []).map((p) => p.display_name ?? "Ukjent");
}

export function TypingIndicator({ channelId, selfProfileId }: Props) {
  const styles = useStyles();
  const typingSet = useTypingIndicator(channelId, selfProfileId);
  const [displayNames, setDisplayNames] = useState<string[]>([]);

  const typingCount = typingSet.size;
  const typingIds = Array.from(typingSet);

  // Re-resolve names whenever the typing set changes.
  useEffect(() => {
    if (typingCount === 0) {
      setDisplayNames([]);
      return;
    }

    let cancelled = false;
    void resolveDisplayNames(typingIds).then((names) => {
      if (!cancelled) setDisplayNames(names);
    });

    return () => {
      cancelled = true;
    };
  }, [typingCount, typingIds.join(",")]);

  if (typingCount === 0) return null;

  let label: string;
  if (typingCount === 1) {
    label = `${displayNames[0] ?? "Noen"} skriver…`;
  } else if (typingCount === 2) {
    const a = displayNames[0] ?? "Noen";
    const b = displayNames[1] ?? "Noen";
    label = `${a} og ${b} skriver…`;
  } else {
    label = `${typingCount} personer skriver…`;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(nativeTheme.motion.enterMs)}
      exiting={FadeOut.duration(nativeTheme.motion.exitMs)}
      style={styles.container}
    >
      <View style={styles.pill}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: theme.colors.muted,
    opacity: 0.8,
  },
  label: {
    fontSize: 11,
    fontFamily: "GeistMono",
    color: theme.colors.mutedForeground,
    letterSpacing: 0.1,
  },
}));
