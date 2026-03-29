/**
 * Theme barrel export + utilities.
 * All components import theme values from here.
 */
import type { ViewStyle } from "react-native";
import { StyleSheet, useColorScheme } from "react-native";
import { useThemeStore } from "@/hooks/stores/use-theme-store";
import {
  getColors,
  lightColors,
  darkColors,
  departmentColors,
  statusColors,
  withOpacity,
  type ThemeColors,
} from "./colors";
import { spacing, type Spacing } from "./spacing";
import { typography, fontWeights, type TypographyVariant } from "./typography";
import { nativeTheme } from "@smartout/design-tokens/native";

// Re-export everything
export {
  getColors,
  lightColors,
  darkColors,
  departmentColors,
  statusColors,
  withOpacity,
  spacing,
  typography,
  fontWeights,
};
export type { ThemeColors, Spacing, TypographyVariant };

/** Border radius presets from design tokens */
export const radius = nativeTheme.radius;

/** Shadow presets for elevation on cards, sheets, FABs */
export const shadows = {
  /** Subtle lift — cards, list items */
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  } satisfies ViewStyle,

  /** Standard elevation — floating cards, active elements */
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  } satisfies ViewStyle,

  /** High elevation — bottom sheets, modals, FAB */
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  } satisfies ViewStyle,
} as const;

/** Theme object passed to createStyles callback */
export type Theme = {
  colors: ThemeColors;
  spacing: Spacing;
  typography: typeof typography;
  fontWeights: typeof fontWeights;
  radius: typeof radius;
  shadows: typeof shadows;
  isDark: boolean;
};

/**
 * Hook that returns a fully resolved Theme based on the current color scheme.
 */
export function useTheme(): Theme {
  const systemScheme = useColorScheme() ?? "light";
  const themePref = useThemeStore((s) => s.theme);
  const scheme = themePref === "system" ? systemScheme : themePref;
  const isDark = scheme === "dark";
  return {
    colors: getColors(scheme),
    spacing,
    typography,
    fontWeights,
    radius,
    shadows,
    isDark,
  };
}

/**
 * Typed StyleSheet.create wrapper with theme access.
 *
 * Usage:
 * ```ts
 * const useStyles = createStyles((theme) => ({
 *   container: { backgroundColor: theme.colors.background, padding: theme.spacing.card },
 * }));
 *
 * function MyComponent() {
 *   const styles = useStyles();
 *   return <View style={styles.container} />;
 * }
 * ```
 */
export function createStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  // Cache per color scheme to avoid recreating on every render
  let cachedLight: T | null = null;
  let cachedDark: T | null = null;

  return function useStyles(): T {
    const theme = useTheme();

    if (theme.isDark) {
      if (!cachedDark) {
        cachedDark = StyleSheet.create(factory(theme));
      }
      return cachedDark;
    }

    if (!cachedLight) {
      cachedLight = StyleSheet.create(factory(theme));
    }
    return cachedLight;
  };
}
