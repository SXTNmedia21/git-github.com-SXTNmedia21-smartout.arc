import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Coffee, Edit3, Coins, Phone } from "lucide-react-native";
import { createStyles, useTheme } from "@/theme";
import * as Haptics from "expo-haptics";

type ShiftClockActionsProps = {
  onToggleBreak: () => void;
  onAddNote: () => void;
  onAddSupplement: () => void;
  onCallLeader: () => void;
  isOnBreak: boolean;
};

export function ShiftClockActions({
  onToggleBreak,
  onAddNote,
  onAddSupplement,
  onCallLeader,
  isOnBreak,
}: ShiftClockActionsProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  return (
    <View style={styles.grid}>
      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        onPress={() => handlePress(onToggleBreak)}
      >
        <Coffee size={24} color={isOnBreak ? theme.colors.warning : theme.colors.primary} />
        <Text style={[styles.actionText, isOnBreak && { color: theme.colors.warning }]}>
          {isOnBreak ? "Avslutt pause" : "Ta pause"}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        onPress={() => handlePress(onAddNote)}
      >
        <Edit3 size={24} color={theme.colors.primary} />
        <Text style={styles.actionText}>Notat</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        onPress={() => handlePress(onAddSupplement)}
      >
        <Coins size={24} color={theme.colors.primary} />
        <Text style={styles.actionText}>Tillegg</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        onPress={() => handlePress(onCallLeader)}
      >
        <Phone size={24} color={theme.colors.primary} />
        <Text style={styles.actionText}>Ring leder</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    marginTop: theme.spacing.section,
  },
  actionButton: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.tight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  actionPressed: {
    opacity: 0.7,
    backgroundColor: theme.colors.secondary,
  },
  actionText: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
    fontWeight: "500",
  },
}));
