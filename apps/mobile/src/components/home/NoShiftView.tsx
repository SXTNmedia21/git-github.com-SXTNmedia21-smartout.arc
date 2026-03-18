/**
 * NoShiftView — Home screen content when the employee has no upcoming shift
 * within the "before_shift" window.
 *
 * Shows: greeting, next shift card (if any within 7 days), unread message count,
 * and a locked V2 section (training & certifications placeholder).
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { createStyles, withOpacity } from "@/theme";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ShiftCard } from "@/components/shift/ShiftCard";
import { strings } from "@/constants/strings";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type NoShiftViewProps = {
  firstName: string;
  nextShift: ScheduleShift | null;
  unreadCount?: number;
};

export function NoShiftView({ firstName, nextShift, unreadCount = 0 }: NoShiftViewProps) {
  const styles = useStyles();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Greeting */}
      <Text style={styles.greeting}>
        {strings.home.greeting}, {firstName}
      </Text>

      {/* Next shift card or empty state */}
      {nextShift ? (
        <View style={styles.section}>
          <SectionHeader title={strings.home.nextShift} />
          <ShiftCard
            shift={nextShift}
            onPress={() => router.push(`/(app)/(shifts)/${nextShift.schedule_shift_id}`)}
          />
        </View>
      ) : (
        <EmptyState
          title={strings.home.noShift}
          subtitle="Sjekk vaktlisten for oppdateringer."
        />
      )}

      {/* Unread messages link */}
      {unreadCount > 0 && (
        <Pressable
          style={styles.unreadRow}
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(chat)");
          }}
          accessibilityRole="button"
        >
          <Text style={styles.unreadText}>
            {unreadCount} {strings.home.unreadMessages} →
          </Text>
        </Pressable>
      )}

      {/* V2 locked section — training & certifications placeholder */}
      <View style={styles.lockedSection}>
        <Card>
          <View style={styles.lockedContent}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <View>
              <Text style={styles.lockedTitle}>{strings.me.trainingLocked}</Text>
              <Text style={styles.lockedSubtitle}>{strings.me.comingSoon}</Text>
            </View>
          </View>
        </Card>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.section,
  },
  greeting: {
    ...theme.typography.largeTitle,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.section,
  },
  section: {
    marginBottom: theme.spacing.section,
  },
  unreadRow: {
    paddingVertical: theme.spacing.element,
    marginBottom: theme.spacing.element,
  },
  unreadText: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.brandOrange,
  },
  lockedSection: {
    marginTop: theme.spacing.element,
    opacity: 0.6,
  },
  lockedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  lockedIcon: {
    fontSize: 24,
  },
  lockedTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  lockedSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
