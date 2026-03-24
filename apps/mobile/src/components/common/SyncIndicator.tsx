/**
 * Animated sync status banner.
 *
 * Shows current write queue state:
 *   - Yellow: syncing pending writes (online)
 *   - Orange: pending writes but offline
 *   - Red: permanently failed writes with retry button
 *   - Green: all synced — fades out after 3 seconds
 *
 * Takes zero space when fully hidden (height animates to 0).
 * Uses react-native-reanimated for smooth 60fps animations.
 */
import { useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { retryFailed } from "@/lib/sync/queue";
import { syncWorker } from "@/lib/sync/worker";
import { useSyncStatus } from "@/hooks/stores/use-sync-status";
import { createStyles, useTheme, withOpacity, type ThemeColors } from "@/theme";

const BANNER_HEIGHT = 40;
const FADE_OUT_DELAY_MS = 3000;

type BannerState = "syncing" | "offline" | "failed" | "synced" | "hidden";

function deriveBannerState(
  pendingCount: number,
  failedCount: number,
  isOnline: boolean,
): BannerState {
  if (failedCount > 0) return "failed";
  if (pendingCount > 0 && !isOnline) return "offline";
  if (pendingCount > 0 && isOnline) return "syncing";
  return "synced";
}

function getBannerColors(colors: ThemeColors): Record<BannerState, string> {
  return {
    syncing: colors.warning,
    offline: colors.brandOrange,
    failed: colors.destructive,
    synced: colors.success,
    hidden: colors.success,
  };
}

export function SyncIndicator() {
  const { pendingCount, failedCount, isOnline } = useSyncStatus();
  const { colors } = useTheme();
  const styles = useStyles();
  const bannerColors = getBannerColors(colors);

  const bannerState = deriveBannerState(pendingCount, failedCount, isOnline);
  const isVisible = pendingCount > 0 || failedCount > 0;

  const heightValue = useSharedValue(0);
  const opacityValue = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      heightValue.value = withTiming(BANNER_HEIGHT, { duration: 200 });
      opacityValue.value = withTiming(1, { duration: 200 });
    } else if (bannerState === "synced") {
      /* Show "all synced" briefly then fade out */
      heightValue.value = withTiming(BANNER_HEIGHT, { duration: 200 });
      opacityValue.value = withTiming(1, { duration: 200 });
      opacityValue.value = withDelay(FADE_OUT_DELAY_MS, withTiming(0, { duration: 300 }));
      heightValue.value = withDelay(FADE_OUT_DELAY_MS + 300, withTiming(0, { duration: 200 }));
    } else {
      heightValue.value = withTiming(0, { duration: 200 });
      opacityValue.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible, bannerState, heightValue, opacityValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
    opacity: opacityValue.value,
  }));

  const handleRetry = useCallback(async () => {
    await retryFailed();
    await useSyncStatus.getState().refresh();
    void syncWorker.flush();
  }, []);

  const label = getBannerLabel(bannerState, pendingCount, failedCount);

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bannerColors[bannerState] }, animatedStyle]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{label}</Text>
        {bannerState === "failed" && (
          <Pressable onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Prøv igjen</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function getBannerLabel(state: BannerState, pendingCount: number, failedCount: number): string {
  switch (state) {
    case "syncing":
      return `Synkroniserer ${pendingCount} ${pendingCount === 1 ? "post" : "poster"}...`;
    case "offline":
      return `${pendingCount} ${pendingCount === 1 ? "post" : "poster"} venter — ingen tilkobling`;
    case "failed":
      return `${failedCount} ${failedCount === 1 ? "post" : "poster"} mislyktes`;
    case "synced":
    case "hidden":
      return "Alt synkronisert";
  }
}

const useStyles = createStyles((theme) => ({
  container: {
    overflow: "hidden",
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: BANNER_HEIGHT,
    paddingHorizontal: 16,
    gap: 12,
  },
  text: {
    color: theme.colors.primaryForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: withOpacity(theme.colors.primaryForeground, 0.25),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryText: {
    color: theme.colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700",
  },
}));
