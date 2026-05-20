/**
 * ShiftChatUnavailableBanner
 *
 * WHY: useShiftChat.sendMessage throws a Zod error at enqueue because
 * sendMessageSchema requires `channel_id` (new ADR-0132 schema) but the hook
 * reads chat_conversation/chat_message (legacy schema) which has no channel_id.
 * Rendering the input row would let users tap Send and receive a raw error toast.
 *
 * This banner replaces the input row unconditionally while the hook is broken.
 * The message LIST stays visible — Realtime read path is unaffected.
 *
 * Full migration: mobile-shift-chat-bff-migration follow-up sortie.
 * Remove this component + wire real ShiftChatInput once that lands.
 */

import React from "react";
import { View, Text } from "react-native";
import { Info } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { strings } from "@/constants/strings";

/**
 * Passive informational banner rendered in place of the shift chat input row.
 * No tap target — the user cannot accidentally trigger a broken send.
 *
 * Sizing mirrors a typical input row (minHeight 52) so the surrounding layout
 * does not shift when the banner is shown.
 */
export function ShiftChatUnavailableBanner() {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={strings.shift.chatUnavailableBanner}
    >
      <Info size={15} color={theme.colors.mutedForeground} strokeWidth={1.5} />
      <Text style={styles.label}>{strings.shift.chatUnavailableBanner}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    minHeight: 52,
    paddingHorizontal: theme.spacing.section,
    paddingVertical: theme.spacing.element,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.4) : theme.colors.secondary,
    borderTopWidth: 1,
    borderTopColor: withOpacity(theme.colors.border, 0.15),
  },
  label: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.mutedForeground,
    fontWeight: "400",
  },
}));
