/**
 * MicPermissionDialog — Inline mic permission denial prompt (D2).
 *
 * Shown when startVoiceSession() catches a permission denial. Two actions:
 *   - "Åpne innstillinger" → Linking.openSettings() (device settings deep-link)
 *   - "Skriv i stedet" → switches to text mode via setMode callback
 *
 * Strings: Norwegian with TODO tags — wire via t() when i18n keys land.
 * Colors: theme tokens only — no hardcoded values (ADR-0366).
 * a11y: accessibilityLiveRegion="polite" announces the dialog to screen readers.
 */

import React from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { createStyles, useTheme } from "@/theme";

type MicPermissionDialogProps = {
  /** Called when the user taps "Skriv i stedet". Switches to text mode. */
  onSwitchToText: () => void;
  /** Called when the user taps "Åpne innstillinger". Default: Linking.openSettings(). */
  onOpenSettings?: () => void;
};

/**
 * Inline permission-denial dialog. Always shown when mounted — parent controls
 * visibility by conditional rendering.
 */
export function MicPermissionDialog({ onSwitchToText, onOpenSettings }: MicPermissionDialogProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleOpenSettings = React.useCallback(() => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      // Deep-link to device app settings page.
      void Linking.openSettings();
    }
  }, [onOpenSettings]);

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel="Mikrofontilgang er avvist. Åpne innstillinger for å aktivere."
    >
      <Text style={styles.title}>
        {/* TODO(i18n): mic_permission_denied_title */}
        Mikrofon er blokkert
      </Text>
      <Text style={styles.body}>
        {/* TODO(i18n): mic_permission_denied_body */}
        Gi Smartout tilgang til mikrofonen i innstillingene, eller skriv meldingen din i stedet.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={handleOpenSettings}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Åpne innstillinger"
          // TODO(i18n): mic_permission_open_settings
          hitSlop={theme.spacing.tight}
        >
          <Text style={styles.primaryButtonText}>
            {/* TODO(i18n): mic_permission_open_settings_label */}
            Åpne innstillinger
          </Text>
        </Pressable>
        <Pressable
          onPress={onSwitchToText}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Skriv i stedet for å snakke"
          // TODO(i18n): mic_permission_switch_to_text
          hitSlop={theme.spacing.tight}
        >
          <Text style={styles.secondaryButtonText}>
            {/* TODO(i18n): mic_permission_switch_label */}
            Skriv i stedet
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    marginHorizontal: theme.spacing.card,
    marginBottom: theme.spacing.element,
    padding: theme.spacing.element,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
    gap: theme.spacing.tight,
  },
  title: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
  body: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.tight,
    marginTop: theme.spacing.tight,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
  },
  primaryButtonText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: "600",
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  secondaryButtonText: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
  },
  buttonPressed: {
    opacity: 0.7,
  },
}));
