/**
 * Shifts list — FlatList of upcoming shifts for the current employee.
 *
 * Each row is a compact ShiftCard. Unconfirmed shifts show an inline
 * confirm button. Tapping a card navigates to the shift detail view.
 */

import React, { useCallback, useState } from "react";
import { FlatList, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
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
        // Optimistically update the cache
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
    ({ item }: { item: ScheduleShift }) => (
      <View style={styles.cardWrapper}>
        <ShiftCard
          shift={item}
          onPress={() => router.push(`/(app)/(shifts)/${item.schedule_shift_id}`)}
          onConfirm={!item.confirmed_at ? handleConfirm : undefined}
          confirming={confirmingId === item.schedule_shift_id}
        />
      </View>
    ),
    [router, handleConfirm, confirmingId, styles.cardWrapper],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />
      <Text style={styles.title}>{strings.tabs.shifts}</Text>
      <FlatList
        data={shifts ?? []}
        renderItem={renderShift}
        keyExtractor={(item) => item.schedule_shift_id}
        contentContainerStyle={styles.list}
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
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.element,
  },
  list: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.xl,
  },
  cardWrapper: {
    marginBottom: theme.spacing.element,
  },
}));
