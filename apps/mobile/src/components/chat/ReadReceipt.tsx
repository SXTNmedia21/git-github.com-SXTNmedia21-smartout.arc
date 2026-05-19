/**
 * ReadReceipt — WhatsApp-style message delivery/read status indicator.
 *
 * Four states:
 *   pending   — Clock icon (message queued, not yet sent)
 *   sent      — single Check (delivered to server)
 *   delivered — double Check in muted color (delivered to device)
 *   read      — double Check in primary/brand color (seen by recipient)
 */

import React from "react";
import { Clock, Check, CheckCheck } from "lucide-react-native";
import { useTheme } from "@/theme";

export type ReadReceiptState = "pending" | "sent" | "delivered" | "read";

type Props = {
  state: ReadReceiptState;
  /** Icon size in pt. Defaults to 12. */
  size?: number;
};

export function ReadReceipt({ state, size = 12 }: Props) {
  const theme = useTheme();

  if (state === "pending") {
    return <Clock size={size} color={theme.colors.mutedForeground} strokeWidth={1.8} />;
  }

  if (state === "sent") {
    return <Check size={size} color={theme.colors.mutedForeground} strokeWidth={2} />;
  }

  if (state === "delivered") {
    return <CheckCheck size={size} color={theme.colors.mutedForeground} strokeWidth={2} />;
  }

  // read — double check in brand color (token-driven, no raw hex)
  return <CheckCheck size={size} color={theme.colors.brandOrange} strokeWidth={2} />;
}
