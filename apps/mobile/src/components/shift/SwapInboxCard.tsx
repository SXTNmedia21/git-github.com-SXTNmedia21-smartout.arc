/**
 * SwapInboxCard — Card showing an incoming/outgoing swap request.
 *
 * Displays swap details with contextual action buttons:
 * - Target user sees accept/reject
 * - Requester sees cancel
 * Shows loading state per action to prevent double-taps.
 */

import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { ArrowLeftRight, Check, X } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { SwapStatusBadge } from "./SwapStatusBadge";
import type { SwapRequest } from "@/hooks/queries/use-swap-requests";

type SwapInboxCardProps = {
  swap: SwapRequest;
  isTarget: boolean;
  isRequester: boolean;
  requesterName: string;
  targetName: string;
  onAccept: (engineStateId: string) => Promise<void>;
  onReject: (engineStateId: string) => Promise<void>;
  onCancel: (engineStateId: string) => Promise<void>;
};

export function SwapInboxCard({
  swap,
  isTarget,
  isRequester,
  requesterName,
  targetName,
  onAccept,
  onReject,
  onCancel,
}: SwapInboxCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [loadingAction, setLoadingAction] = useState<"accept" | "reject" | "cancel" | null>(null);

  const handleAction = async (action: "accept" | "reject" | "cancel") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingAction(action);
    try {
      if (action === "accept") await onAccept(swap.engine_state_id);
      else if (action === "reject") await onReject(swap.engine_state_id);
      else await onCancel(swap.engine_state_id);
    } finally {
      setLoadingAction(null);
    }
  };

  const ctx = swap.context;
  const statusLabel = isTarget
    ? `${requesterName} vil bytte vakt med deg`
    : `Du forespurte bytte med ${targetName}`;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <ArrowLeftRight size={16} color={theme.colors.brandOrange} strokeWidth={1.8} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {statusLabel}
          </Text>
          <SwapStatusBadge status={ctx.status} />
        </View>
      </View>

      {/* Reason */}
      {ctx.reason ? (
        <Text style={styles.reason} numberOfLines={2}>
          &ldquo;{ctx.reason}&rdquo;
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {isTarget && ctx.status === "pending_recipient" && (
          <>
            <Pressable
              onPress={() => handleAction("accept")}
              disabled={loadingAction !== null}
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.btnPressed]}
            >
              {loadingAction === "accept" ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={14} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.acceptText}>Godta</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => handleAction("reject")}
              disabled={loadingAction !== null}
              style={({ pressed }) => [styles.rejectBtn, pressed && styles.btnPressed]}
            >
              {loadingAction === "reject" ? (
                <ActivityIndicator size="small" color={theme.colors.destructive} />
              ) : (
                <>
                  <X size={14} color={theme.colors.destructive} strokeWidth={2.5} />
                  <Text style={styles.rejectText}>Avslå</Text>
                </>
              )}
            </Pressable>
          </>
        )}

        {isRequester && (ctx.status === "pending_recipient" || ctx.status === "pending_manager") && (
          <Pressable
            onPress={() => handleAction("cancel")}
            disabled={loadingAction !== null}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
          >
            {loadingAction === "cancel" ? (
              <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            ) : (
              <>
                <X size={14} color={theme.colors.mutedForeground} strokeWidth={2} />
                <Text style={styles.cancelText}>Kanseller</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor: withOpacity(theme.colors.card, 0.8),
    borderRadius: 14,
    padding: theme.spacing.card,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
    gap: 12,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...theme.typography.body,
    fontWeight: "600" as const,
    color: theme.colors.foreground,
    fontSize: 13,
  },
  reason: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontStyle: "italic" as const,
    paddingLeft: 46,
  },
  actions: {
    flexDirection: "row" as const,
    gap: 8,
    paddingLeft: 46,
  },
  acceptBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.brandOrange,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  rejectBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.destructive, 0.3),
    backgroundColor: withOpacity(theme.colors.destructive, 0.06),
  },
  rejectText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.destructive,
  },
  cancelBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
    backgroundColor: withOpacity(theme.colors.muted, 0.3),
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: theme.colors.mutedForeground,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
}));
