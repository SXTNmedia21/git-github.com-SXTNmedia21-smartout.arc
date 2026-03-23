/**
 * Shifts list — FlatList of upcoming shifts with animated card entrances.
 *
 * Each row is a compact ShiftCard. Unconfirmed shifts show an inline
 * confirm button. Tapping a card navigates to the shift detail view.
 * Cards enter with a staggered slide-up + fade animation.
 */

import React, { useCallback, useState } from "react";
import { FlatList, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { CalendarDays } from "lucide-react-native";
import { createStyles } from "@/theme";
import { ShiftCard } from "@/components/shift/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { strings } from "@/constants/strings";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { enqueue } from "@/lib/sync/queue";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

export default function ShiftsListScreen() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: shifts, isLoading } = useMyShifts();
  const { data: profile } = useMyProfile();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleConfirm = useCallback(
    async (shiftId: string) => {
      if (!profile) return;
      setConfirmingId(shiftId);
      try {
        await enqueue("confirm_shift", {
          schedule_shift_id: shiftId,
          confirmed_at: new Date().toISOString(),
          confirmed_by: profile.profile_id,
        });
        queryClient.setQueryData<ScheduleShift[]>(["my-shifts"], (old) =>
          old?.map((s) =>
            s.schedule_shift_id === shiftId
              ? { ...s, confirmed_at: new Date().toISOString(), confirmed_by: profile.profile_id }
              : s,
          ),
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setConfirmingId(null);
      }
    },
    [profile, queryClient],
  );

  const renderShift = useCallback(
    ({ item, index }: { item: ScheduleShift; index: number }) => (
      <Animated.View
        entering={FadeInUp.delay(100 + index * 80)
          .duration(400)
          .springify()
          .damping(14)}
        style={styles.cardWrapper}
      >
        <ShiftCard
          shift={item}
          onPress={() => router.push(`/(app)/(shifts)/${item.schedule_shift_id}`)}
          onConfirm={!item.confirmed_at ? handleConfirm : undefined}
          confirming={confirmingId === item.schedule_shift_id}
        />
      </Animated.View>
    ),
    [router, handleConfirm, confirmingId, styles.cardWrapper],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.headerRow}>
        <CalendarDays size={24} color={styles.headerIcon.color} strokeWidth={2} />
        <Text style={styles.title}>{strings.tabs.shifts}</Text>
      </Animated.View>

      <FlatList
        data={shifts ?? []}
        renderItem={renderShift}
        keyExtractor={(item) => item.schedule_shift_id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={strings.home.noShift}
              subtitle="Ingen vakter de neste 7 dagene. Nye vakter vises her nar lederen publiserer dem."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.element,
  },
  headerIcon: {
    color: theme.colors.brandOrange,
  },
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
  },
  list: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },
  cardWrapper: {
    marginBottom: theme.spacing.element,
  },
}));
