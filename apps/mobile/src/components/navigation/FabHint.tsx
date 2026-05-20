/**
 * FabHint — first-run discoverability tooltip for the AIFab long-press gesture.
 *
 * Shown once per device, suppressed forever after the user either long-presses
 * the FAB or the auto-dismiss timer elapses. State lives in
 * `useBotssonSettingsStore.hasSeenFabHint` (MMKV-persisted).
 *
 * Render contract: renders `null` if the user has already seen the hint, so
 * it can be mounted unconditionally by the layout.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { createStyles } from "@/theme";
import { useBotssonSettingsStore } from "@/hooks/stores/use-botsson-settings-store";

const SHOW_DELAY_MS = 600;
const AUTO_DISMISS_MS = 5000;
const FADE_IN_MS = 240;
const FADE_OUT_MS = 200;

type FabHintProps = {
  /** Hint copy. Caller provides strings via i18n. */
  message: string;
};

export function FabHint({ message }: FabHintProps) {
  const styles = useStyles();
  const hasSeen = useBotssonSettingsStore((s) => s.hasSeenFabHint);
  const markSeen = useBotssonSettingsStore((s) => s.setHasSeenFabHint);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasSeen) return;

    const showTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start();
    }, SHOW_DELAY_MS);

    const dismissTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => {
        markSeen(true);
      });
    }, SHOW_DELAY_MS + AUTO_DISMISS_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [hasSeen, markSeen, opacity]);

  if (hasSeen) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
      <View style={styles.caret} />
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    position: "absolute",
    bottom: 88,
    alignSelf: "center",
    alignItems: "center",
  },
  bubble: {
    backgroundColor: theme.colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    maxWidth: 320,
    ...theme.shadows.md,
  },
  text: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.fontWeights.medium,
  },
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme.colors.foreground,
    marginTop: -1,
  },
}));
