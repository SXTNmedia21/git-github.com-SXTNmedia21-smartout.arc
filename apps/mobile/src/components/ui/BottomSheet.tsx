/**
 * BottomSheet — Wrapper around @gorhom/bottom-sheet with consistent styling.
 * Provides themed handle, backdrop, and content padding.
 */
import React, { forwardRef, useCallback, useMemo, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetProps as GorhomProps,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";

type BottomSheetProps = Omit<GorhomProps, "style" | "backgroundStyle" | "handleIndicatorStyle"> & {
  children: ReactNode;
  /** Custom container style */
  style?: ViewStyle;
};

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(function BottomSheet(
  { children, style, onChange, ...rest },
  ref,
) {
  const styles = useStyles();
  const theme = useTheme();

  const handleChange = useCallback(
    (...args: Parameters<NonNullable<GorhomProps["onChange"]>>) => {
      // Haptic when sheet snaps to a new position
      if (args[0] >= 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onChange?.(...args);
    },
    [onChange],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={ref}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      enablePanDownToClose
      {...rest}
    >
      <View style={[styles.content, style]}>{children}</View>
    </GorhomBottomSheet>
  );
});

const useStyles = createStyles((theme) => ({
  background: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  handle: {
    backgroundColor: theme.colors.muted,
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.card,
  },
}));
