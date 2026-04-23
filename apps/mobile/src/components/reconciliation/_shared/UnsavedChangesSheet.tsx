/**
 * UnsavedChangesSheet — bottom sheet prompted when the user taps the
 * close X on the wizard header while dirty state exists.
 *
 * Primary action: "Fortsett senere" (framework = saved-for-later, the
 * wizard_state persists; non-destructive).
 * Secondary action: "Avbryt helt" rendered with destructive-muted to
 * keep it discoverable without weaponizing red.
 */
import React, { forwardRef, useMemo } from "react";
import { View, Text } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { createStyles } from "@/theme";

export type UnsavedChangesSheetProps = {
  onContinueLater: () => void;
  onCancelEntirely: () => void;
  onDismiss?: () => void;
};

export const UnsavedChangesSheet = forwardRef<GorhomBottomSheet, UnsavedChangesSheetProps>(
  function UnsavedChangesSheet({ onContinueLater, onCancelEntirely, onDismiss }, ref) {
    const styles = useStyles();
    const snapPoints = useMemo(() => ["40%"], []);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onClose={onDismiss}
        enableDynamicSizing={false}
      >
        <View style={styles.body}>
          <Text style={styles.title}>Avbryte avstemming?</Text>
          <Text style={styles.subtitle}>
            Framdriften lagres på denne enheten. Du kan fortsette der du sluttet når du er klar.
          </Text>
          <View style={styles.actions}>
            <Button
              title="Fortsett senere"
              variant="primary"
              size="lg"
              fullWidth
              onPress={onContinueLater}
            />
            <CancelButton onPress={onCancelEntirely} />
          </View>
        </View>
      </BottomSheet>
    );
  },
);

/**
 * Destructive-muted cancel. Uses the M2 Phase A token — deliberately
 * less saturated than primary destructive red to avoid weaponizing the
 * secondary action while still signalling its irreversibility.
 */
function CancelButton({ onPress }: { onPress: () => void }) {
  const styles = useCancelStyles();
  return (
    <Button
      title="Avbryt helt"
      variant="ghost"
      size="md"
      fullWidth
      onPress={onPress}
      style={styles.cancel}
    />
  );
}

const useCancelStyles = createStyles((theme) => ({
  cancel: {
    backgroundColor: "transparent",
    borderColor: theme.colors.destructiveMuted,
    borderWidth: 1,
  },
}));

const useStyles = createStyles((theme) => ({
  body: {
    paddingTop: theme.spacing.element,
    paddingBottom: theme.spacing.card,
    gap: theme.spacing.section,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  actions: {
    gap: theme.spacing.element,
  },
}));
