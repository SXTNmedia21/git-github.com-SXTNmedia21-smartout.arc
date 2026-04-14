/**
 * Swap screen — receives shiftId search param, loads shift data,
 * and renders SwapRequestSheet for selecting a target shift to swap with.
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { SwapRequestSheet } from "@/components/shift/SwapRequestSheet";

export default function SwapScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const { data: shifts, isLoading } = useMyShifts();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const shift = useMemo(
    () => shifts?.find((s) => s.schedule_shift_id === shiftId) ?? null,
    [shifts, shiftId],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.mutedForeground} />
        </View>
      </SafeAreaView>
    );
  }

  if (!shift || !selectedProfileId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Vakt ikke funnet</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backBtn}
          >
            <ChevronLeft size={18} color={theme.colors.brandOrange} strokeWidth={2} />
            <Text style={styles.backText}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <SwapRequestSheet shift={shift} profileId={selectedProfileId} />;
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 12,
  },
  errorText: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
  },
  backBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  backText: {
    ...theme.typography.body,
    fontWeight: "500" as const,
    color: theme.colors.brandOrange,
  },
}));
