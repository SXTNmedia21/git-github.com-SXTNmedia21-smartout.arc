/**
 * Input — Text input with label, error state, and focus styling.
 * Provides haptic feedback on focus.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";

type InputProps = Omit<TextInputProps, "style"> & {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Custom container style */
  style?: ViewStyle;
};

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setIsFocused(true);
      Haptics.selectionAsync();
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
        placeholderTextColor={theme.colors.mutedForeground}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={label}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.subheadline,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    minHeight: 44,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.colors.destructive,
    borderWidth: 2,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.destructive,
  },
}));
