/**
 * DayDetailSheet — Bottom sheet for Layer 2 day-tap in "Min tilgjengelighet".
 *
 * Triggered when the employee taps a day in SwipeCalendar. Lets them set
 * the status for that single date:
 *   - Ikke tilgjengelig (unavailable)
 *   - Foretrekker å jobbe (preferred)
 *   - Time-range placeholder (disabled — wired in Task K)
 *   - Fjern (clear any override)
 *
 * Uses the existing @gorhom/bottom-sheet wrapper (BottomSheet) so handle +
 * backdrop + haptics stay consistent with the rest of the app.
 */
import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { Ban, Check, Clock, X } from "lucide-react-native";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { DailyStatus } from "@/hooks/queries/use-my-availability";
import type { PreferenceType } from "@/hooks/mutations/use-availability";

type DayDetailSheetProps = {
  day: DailyStatus | null;
  onSelect: (status: PreferenceType | null) => void;
  onClose: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

type Option = {
  key: PreferenceType | "clear" | "range";
  label: string;
  description: string;
  icon: typeof Ban;
  disabled?: boolean;
};

const OPTIONS: Option[] = [
  {
    key: "unavailable",
    label: "Ikke tilgjengelig",
    description: "Du kan ikke jobbe denne dagen.",
    icon: Ban,
  },
  {
    key: "preferred",
    label: "Foretrekker å jobbe",
    description: "Du vil gjerne ha vakt denne dagen.",
    icon: Check,
  },
  {
    key: "range",
    label: "Tidsrom",
    description: "Velg et bestemt klokkeslett (kommer snart).",
    icon: Clock,
    disabled: true,
  },
  {
    key: "clear",
    label: "Fjern",
    description: "Nullstill dagen til standard tilgjengelig.",
    icon: X,
  },
];

export const DayDetailSheet = forwardRef<GorhomBottomSheet, DayDetailSheetProps>(
  function DayDetailSheet({ day, onSelect, onClose }, ref) {
    const styles = useStyles();
    const theme = useTheme();

    const snapPoints = useMemo(() => ["58%"], []);

    const handleChoose = useCallback(
      (opt: Option) => {
        if (opt.disabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        Haptics.selectionAsync();
        if (opt.key === "clear") {
          onSelect(null);
        } else if (opt.key === "range") {
          // Disabled in Task J — wired when range picker lands.
        } else {
          onSelect(opt.key);
        }
      },
      [onSelect],
    );

    const heading = day ? dateFormatter.format(new Date(day.date)) : "Velg dag";

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onChange={(idx) => {
          if (idx === -1) onClose();
        }}
      >
        <BottomSheetView>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetHeading}>{heading}</Text>
            <Text style={styles.sheetSub}>Sett status for denne dagen</Text>
          </View>

          <View style={styles.optionsList}>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => handleChoose(opt)}
                  disabled={opt.disabled}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && !opt.disabled && styles.optionPressed,
                    opt.disabled && styles.optionDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityHint={opt.description}
                  accessibilityState={{ disabled: opt.disabled }}
                >
                  <View style={styles.optionIcon}>
                    <Icon size={22} color={theme.colors.brandOrange} strokeWidth={1.5} />
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  sheetHeader: {
    gap: 4,
    paddingHorizontal: theme.spacing.section,
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.md,
  },
  sheetHeading: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    textTransform: "capitalize",
  },
  sheetSub: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },

  optionsList: {
    gap: theme.spacing.element,
    paddingHorizontal: theme.spacing.section,
    paddingBottom: theme.spacing.page,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 64,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.secondary,
  },
  optionPressed: {
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
  },
  optionDisabled: { opacity: 0.45 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  optionBody: { flex: 1, gap: 2 },
  optionLabel: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  optionDesc: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
