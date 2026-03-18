/**
 * Shift detail screen — shows ShiftCardRich with colleagues, leader notes,
 * day bookings and active deviations.
 *
 * Loads the specific shift from the my-shifts cache or falls back to a
 * direct Supabase query. Colleagues and day info are loaded via their hooks.
 */

import React, { useMemo, useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { ShiftCardRich } from "@/components/shift/ShiftCardRich";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { formatShiftDate } from "@/components/shift/ShiftCard";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";
import { useDayInfo } from "@/hooks/queries/use-day-info";
import { enqueue } from "@/lib/sync/queue";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

export default function ShiftDetailScreen() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shifts } = useMyShifts();
  const { data: profile } = useMyProfile();
  const [confirming, setConfirming] = useState(false);

  // Find the shift in cache
  const shift = useMemo(
    () => shifts?.find((s) => s.schedule_shift_id === id) ?? null,
    [shifts, id],
  );

  const { data: colleagues } = useShiftColleagues(
    shift?.shift_date ?? null,
    profile?.profile_id ?? null,
  );
  const { data: dayInfo } = useDayInfo();

  const handleConfirm = useCallback(
    async (shiftId: string) => {
      if (!profile) return;
      setConfirming(true);
      try {
        await enqueue("confirm_shift", {
          schedule_shift_id: shiftId,
          confirmed_at: new Date().toISOString(),
          confirmed_by: profile.profile_id,
        });
        // Optimistic update
        queryClient.setQueryData<ScheduleShift[]>(["my-shifts"], (old) =>
          old?.map((s) =>
            s.schedule_shift_id === shiftId
              ? { ...s, confirmed_at: new Date().toISOString(), confirmed_by: profile.profile_id }
              : s,
          ),
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setConfirming(false);
      }
    },
    [profile, queryClient],
  );

  if (!shift) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Vakt ikke funnet</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.backLink}>Tilbake</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      {/* Header with back arrow and date */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{formatShiftDate(shift.shift_date)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ShiftCardRich
          shift={shift}
          colleagues={colleagues ?? []}
          dayInfo={dayInfo}
          onConfirm={!shift.confirmed_at ? handleConfirm : undefined}
          confirming={confirming}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
  },
  backArrow: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  content: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
  },
  notFoundText: {
    ...theme.typography.headline,
    color: theme.colors.mutedForeground,
  },
  backLink: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.brandOrange,
  },
}));
