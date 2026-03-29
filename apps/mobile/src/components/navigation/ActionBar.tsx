/**
 * ActionBar — Shared quick-access row for all main tab screens.
 * Oppgaver, Opplæring, Sikkerhet, Lønn.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { CheckSquare, GraduationCap, Shield, Wallet } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";

const ACTION_BAR_ITEMS = [
  { key: "tasks", icon: CheckSquare, label: "Oppgaver", route: "/(app)/(home)/operations" },
  { key: "training", icon: GraduationCap, label: "Opplæring", route: "/(app)/(home)/training" },
  { key: "safety", icon: Shield, label: "Sikkerhet", route: "/(app)/(home)/hms" },
  { key: "payroll", icon: Wallet, label: "Lønn", route: "/(app)/(payroll)" },
] as const;

export function ActionBar() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {ACTION_BAR_ITEMS.map((item) => {
        const IconComponent = item.icon;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(item.route as Parameters<typeof router.push>[0]);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <IconComponent size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  bar: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.tight,
    marginBottom: theme.spacing.element,
  },
  item: {
    alignItems: "center" as const,
    gap: 4,
  },
  itemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  label: {
    ...theme.typography.micro,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
}));
