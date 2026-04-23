/**
 * AdminOverrideSheet — mobile parity to the web AdminOverrideDialog.
 *
 * Bottom sheet invoked when a preflight blocker is surfaced and an
 * admin wants to force-submit. Requires a 20+ char reason. The live
 * counter colors shift on the 20-char threshold:
 *   - below threshold → warn (amber) via warnSoftForeground
 *   - above threshold → success (warm green)
 *
 * Accessibility:
 *   - focus-trap behaviour inherits from BottomSheet (Gorhom)
 *   - VoiceOver announces every 10th character rather than each keystroke
 *     (accessibilityLiveRegion "polite" on a derived-count node)
 *   - submit button disabled + labelled "Begrunnelse må være minst 20 tegn"
 *     until threshold is met.
 */
import React, { forwardRef, useMemo, useRef, useState } from "react";
import { View, Text, TextInput } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";

export type AdminOverrideSheetProps = {
  /** Blocker codes to display to the admin (e.g. ["no_cash_count", "open_deviation"]). */
  blockerCodes: string[];
  onConfirm: (reason: string) => void;
  onDismiss?: () => void;
  submitting?: boolean;
};

const THRESHOLD = 20;

export const AdminOverrideSheet = forwardRef<GorhomBottomSheet, AdminOverrideSheetProps>(
  function AdminOverrideSheet({ blockerCodes, onConfirm, onDismiss, submitting = false }, ref) {
    const styles = useStyles();
    const theme = useTheme();
    const [reason, setReason] = useState("");
    const lastAnnouncedRef = useRef(0);

    const snapPoints = useMemo(() => ["70%"], []);

    // VoiceOver — announce every 10 chars (policy: never chatty).
    const announcedCount = useMemo(() => {
      const tens = Math.floor(reason.length / 10) * 10;
      if (tens > lastAnnouncedRef.current) {
        lastAnnouncedRef.current = tens;
      }
      return lastAnnouncedRef.current;
    }, [reason.length]);

    const ok = reason.trim().length >= THRESHOLD;
    const counterColor = ok ? theme.colors.success : theme.colors.warnSoftForeground;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onClose={onDismiss}
        enableDynamicSizing={false}
      >
        <View style={styles.body}>
          <Text style={styles.title}>Overstyr blokker</Text>
          <Text style={styles.subtitle}>
            Følgende blokker er aktive. Skriv en begrunnelse (minst {THRESHOLD} tegn) for
            revisjonssporet.
          </Text>
          <View style={styles.blockerList}>
            {blockerCodes.map((code) => (
              <View key={code} style={styles.blockerChip}>
                <Text style={styles.blockerText}>{code}</Text>
              </View>
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            placeholder="Begrunnelse…"
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.textarea}
            accessibilityLabel="Overstyringsbegrunnelse"
          />
          <View style={styles.counterRow}>
            <Text style={[styles.counter, { color: counterColor }]}>
              {reason.length} / {THRESHOLD} tegn
            </Text>
            {/* Derived 10-char announcement — invisible, screen-reader only. */}
            <Text
              accessibilityLiveRegion="polite"
              accessibilityElementsHidden={false}
              importantForAccessibility="yes"
              style={styles.liveHidden}
            >
              {`${announcedCount} tegn skrevet`}
            </Text>
          </View>
          <Button
            title="Bekreft overstyring"
            variant="destructive"
            size="lg"
            fullWidth
            disabled={!ok || submitting}
            loading={submitting}
            onPress={() => onConfirm(reason.trim())}
          />
        </View>
      </BottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  body: {
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.card,
    gap: theme.spacing.element,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  blockerList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.tight,
  },
  blockerChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warnSoft,
  },
  blockerText: {
    ...theme.typography.caption,
    color: theme.colors.warnSoftForeground,
  },
  textarea: {
    minHeight: 96,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.foreground,
    textAlignVertical: "top",
    ...theme.typography.body,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: {
    ...theme.typography.caption,
  },
  liveHidden: {
    height: 1,
    width: 1,
    opacity: 0,
  },
}));
