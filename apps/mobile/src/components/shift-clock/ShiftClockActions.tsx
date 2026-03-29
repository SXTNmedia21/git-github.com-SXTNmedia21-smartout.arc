/**
 * ShiftClockActions — 2x2 grid of quick-action buttons during an active shift.
 *
 * Contains: Break toggle, Note, Supplements, Call leader.
 * All icons use lucide-react-native. Layout adapts to break state.
 * Mirrors the web ShiftClockActions component.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Coffee, Play, FileText, Coins, Phone } from "lucide-react-native";

import { createStyles, withOpacity } from "@/theme";

type ShiftClockActionsProps = {
  isOnBreak: boolean;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onOpenNotes: () => void;
  onOpenSupplements: () => void;
  onCallLeader: () => void;
  claimedSupplementCount?: number;
  breakElapsed?: string;
  isLoading?: boolean;
};

export function ShiftClockActions({
  isOnBreak,
  onStartBreak,
  onEndBreak,
  onOpenNotes,
  onOpenSupplements,
  onCallLeader,
  claimedSupplementCount = 0,
  breakElapsed,
  isLoading = false,
}: ShiftClockActionsProps) {
  const styles = useStyles();

  return (
    <View style={styles.grid}>
      {/* Break toggle */}
      {isOnBreak ? (
        <ActionButton
          icon={<Play size={20} color={styles.brandOrangeColor.color} strokeWidth={2} />}
          label={breakElapsed ?? "Tilbake"}
          sublabel="Tilbake fra pause"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onEndBreak();
          }}
          variant="break"
          disabled={isLoading}
        />
      ) : (
        <ActionButton
          icon={<Coffee size={20} color={styles.warningColor.color} strokeWidth={2} />}
          label="Pause"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStartBreak();
          }}
          iconBg={styles.warningBg.backgroundColor}
          disabled={isLoading}
        />
      )}

      {/* Notes */}
      <ActionButton
        icon={<FileText size={20} color={styles.brandPurpleColor.color} strokeWidth={2} />}
        label="Notat"
        onPress={() => {
          Haptics.selectionAsync();
          onOpenNotes();
        }}
        iconBg={styles.brandPurpleBg.backgroundColor}
      />

      {/* Supplements */}
      <ActionButton
        icon={<Coins size={20} color={styles.successColor.color} strokeWidth={2} />}
        label="Tillegg"
        onPress={() => {
          Haptics.selectionAsync();
          onOpenSupplements();
        }}
        iconBg={styles.successBg.backgroundColor}
        badge={claimedSupplementCount > 0 ? claimedSupplementCount : undefined}
      />

      {/* Call leader */}
      <ActionButton
        icon={<Phone size={20} color={styles.successColor.color} strokeWidth={2} />}
        label="Ring leder"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onCallLeader();
        }}
        variant="voice"
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ActionButton helper                                                       */
/* -------------------------------------------------------------------------- */

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  variant?: "default" | "break" | "voice";
  iconBg?: string;
  badge?: number;
  disabled?: boolean;
};

function ActionButton({
  icon,
  label,
  sublabel,
  onPress,
  variant = "default",
  iconBg,
  badge,
  disabled = false,
}: ActionButtonProps) {
  const styles = useStyles();

  const containerStyle =
    variant === "break"
      ? styles.actionBreak
      : variant === "voice"
        ? styles.actionVoice
        : styles.actionDefault;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBase,
        containerStyle,
        pressed && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconContainer, iconBg ? { backgroundColor: iconBg } : null]}>
        {icon}
      </View>
      {sublabel ? (
        <>
          <Text style={variant === "break" ? styles.breakTimerLabel : styles.actionLabel}>
            {label}
          </Text>
          <Text style={styles.actionSublabel}>{sublabel}</Text>
        </>
      ) : (
        <Text
          style={variant === "voice" ? styles.voiceLabel : styles.actionLabel}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}

      {/* Badge for supplement count */}
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const useStyles = createStyles((theme) => ({
  grid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 10,
    paddingHorizontal: 20,
    marginVertical: theme.spacing.tight,
  },

  actionBase: {
    flex: 1,
    minWidth: "45%" as unknown as number,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center" as const,
    borderWidth: 1,
    position: "relative" as const,
  },

  actionDefault: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },

  actionBreak: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    borderColor: withOpacity(theme.colors.brandOrange, 0.25),
  },

  actionVoice: {
    backgroundColor: withOpacity(theme.colors.success, 0.06),
    borderColor: withOpacity(theme.colors.success, 0.2),
  },

  actionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  actionDisabled: {
    opacity: 0.5,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },

  actionLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },

  voiceLabel: {
    fontSize: 12,
    color: theme.colors.success,
    marginTop: 2,
  },

  breakTimerLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.brandOrange,
    fontVariant: ["tabular-nums" as const],
  },

  actionSublabel: {
    fontSize: 10,
    color: withOpacity(theme.colors.brandOrange, 0.7),
    marginTop: 2,
  },

  badge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: theme.colors.primaryForeground,
  },

  brandOrangeColor: {
    color: theme.colors.brandOrange,
  },

  warningColor: {
    color: theme.colors.warning,
  },

  warningBg: {
    backgroundColor: withOpacity(theme.colors.warning, 0.1),
  },

  brandPurpleColor: {
    color: theme.colors.brandPurple,
  },

  brandPurpleBg: {
    backgroundColor: withOpacity(theme.colors.brandPurple, 0.1),
  },

  successColor: {
    color: theme.colors.success,
  },

  successBg: {
    backgroundColor: withOpacity(theme.colors.success, 0.1),
  },
}));
