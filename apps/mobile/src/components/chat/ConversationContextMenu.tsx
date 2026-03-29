/**
 * ConversationContextMenu — Long-press overlay for channel/DM actions.
 *
 * Shows pin/unpin + mute options. Positioned near the pressed item.
 * Dismissed by tapping outside.
 */

import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { Pin, PinOff, BellOff, Bell } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

type ConversationContextMenuProps = {
  visible: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onClose: () => void;
};

export function ConversationContextMenu({
  visible,
  isPinned,
  isMuted,
  onTogglePin,
  onToggleMute,
  onClose,
}: ConversationContextMenuProps) {
  const styles = useStyles();
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menu}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onTogglePin();
              onClose();
            }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            {isPinned ? (
              <PinOff size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
            ) : (
              <Pin size={18} color={theme.colors.brandOrange} strokeWidth={1.6} />
            )}
            <Text style={styles.menuLabel}>{isPinned ? "Løsne samtale" : "Fest samtale"}</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onToggleMute();
              onClose();
            }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            {isMuted ? (
              <Bell size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
            ) : (
              <BellOff size={18} color={theme.colors.mutedForeground} strokeWidth={1.6} />
            )}
            <Text style={styles.menuLabel}>{isMuted ? "Slå på varsler" : "Demp varsler"}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  menu: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.section,
    minWidth: 220,
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 14,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuLabel: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
  },
  divider: {
    height: 0.5,
    backgroundColor: withOpacity(theme.colors.border, 0.1),
  },
}));
