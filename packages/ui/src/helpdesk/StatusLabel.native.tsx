/**
 * StatusLabel (React Native) — mirrors the web primitive but uses the
 * native theme + font tokens instead of Tailwind classes. Font resolution
 * assumes `GeistMono-Regular` is registered at app boot (expo-font).
 */

import * as React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { nativeTheme } from "@smartout/design-tokens/native";
import type { TicketStatus } from "./types";

export type StatusLabelSize = "sm" | "md";

export type StatusLabelNativeProps = {
  status: TicketStatus;
  labels?: Record<TicketStatus, string>;
  size?: StatusLabelSize;
  style?: StyleProp<TextStyle>;
  colorScheme?: "light" | "dark";
};

const DEFAULT_LABELS: Record<TicketStatus, string> = {
  waiting: "VENTER",
  active: "AKTIV",
  complete: "LØST",
};

const SIZE_PX: Record<StatusLabelSize, number> = { sm: 10, md: 11 };

export function StatusLabel({
  status,
  labels = DEFAULT_LABELS,
  size = "md",
  style,
  colorScheme = "dark",
}: StatusLabelNativeProps) {
  const theme = colorScheme === "light" ? nativeTheme.light : nativeTheme.dark;
  return (
    <Text
      style={[
        {
          fontFamily: "GeistMono-Regular",
          fontSize: SIZE_PX[size],
          letterSpacing: 0.8,
          color: theme.mutedForeground,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {labels[status]}
    </Text>
  );
}
