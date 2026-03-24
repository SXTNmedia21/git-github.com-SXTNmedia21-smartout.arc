/**
 * NotificationSheet — Bottom sheet for recent notifications.
 *
 * Triggered by the bell icon in HomeHeader. Shows a list of
 * recent notifications grouped by today/earlier. Placeholder
 * data for now — will connect to push notification system in V2.
 */

import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { Bell, CheckCircle2, AlertTriangle, Calendar, MessageCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles } from "@/theme";
import type { LucideIcon } from "lucide-react-native";

type NotificationType = "shift" | "message" | "deviation" | "task";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  time: string;
  read: boolean;
};

const ICON_MAP: Record<NotificationType, LucideIcon> = {
  shift: Calendar,
  message: MessageCircle,
  deviation: AlertTriangle,
  task: CheckCircle2,
};

const COLOR_MAP: Record<NotificationType, string> = {
  shift: "#3b82f6",
  message: "#06b6d4",
  deviation: "#f59e0b",
  task: "#22c55e",
};

/** Placeholder notifications — will be replaced with real data */
const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    type: "shift",
    title: "Ny vakt publisert",
    subtitle: "Torsdag 22. mars, 07:00–15:00",
    time: "2 min",
    read: false,
  },
  {
    id: "n2",
    type: "message",
    title: "Ny melding i Sal",
    subtitle: "Erik: Husk a bestille vin",
    time: "15 min",
    read: false,
  },
  {
    id: "n3",
    type: "deviation",
    title: "Avvik godkjent",
    subtitle: "Temperaturavvik — tiltak registrert",
    time: "1 t",
    read: true,
  },
  {
    id: "n4",
    type: "task",
    title: "Oppgave fullfort",
    subtitle: "HACCP-kontroll morgen",
    time: "3 t",
    read: true,
  },
];

export const NotificationSheet = forwardRef<GorhomBottomSheet>(
  function NotificationSheet(_props, ref) {
    const styles = useStyles();
    const snapPoints = useMemo(() => ["50%", "80%"], []);

    const renderItem = useCallback(
      ({ item }: { item: NotificationItem }) => {
        const Icon = ICON_MAP[item.type];
        const color = COLOR_MAP[item.type];

        return (
          <Pressable
            style={({ pressed }) => [
              styles.notificationRow,
              !item.read && styles.unread,
              pressed && styles.pressed,
            ]}
            onPress={() => Haptics.selectionAsync()}
            accessibilityRole="button"
          >
            <View style={[styles.iconCircle, { backgroundColor: color + "15" }]}>
              <Icon size={18} color={color} strokeWidth={2} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <Text style={styles.time}>{item.time}</Text>
          </Pressable>
        );
      },
      [styles],
    );

    return (
      <BottomSheet ref={ref} index={-1} snapPoints={snapPoints}>
        <View style={styles.header}>
          <Bell size={20} color={styles.headerIcon.color} strokeWidth={2} />
          <Text style={styles.headerTitle}>Varsler</Text>
        </View>
        <FlatList
          data={NOTIFICATIONS}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </BottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.element,
  },
  headerIcon: {
    color: theme.colors.foreground,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  unread: {
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  pressed: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
  titleUnread: {
    fontWeight: theme.fontWeights.semibold,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  time: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
