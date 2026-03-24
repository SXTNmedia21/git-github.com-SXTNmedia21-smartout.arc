/**
 * Color palette for the mobile app.
 * Re-exports design tokens with RN-specific helpers for color manipulation.
 */
import { nativeTheme } from "@smartout/design-tokens/native";
import type { ColorSchemeName } from "react-native";

export const lightColors = nativeTheme.light;
export const darkColors = nativeTheme.dark;
export const departmentColors = nativeTheme.department;
export const statusColors = nativeTheme.status;

export type ThemeColors = typeof lightColors | typeof darkColors;

/**
 * Returns the correct color set based on the current color scheme.
 * Falls back to light theme if scheme is null/undefined.
 */
export function getColors(scheme: ColorSchemeName): ThemeColors {
  // FORCE LIGHT MODE FOR ENTIRE APP
  return lightColors;
}

/**
 * Applies opacity to a hex color string.
 * Useful for pressed states, overlays, and disabled elements.
 */
export function withOpacity(hex: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  // Strip existing alpha if present (8-char hex)
  const base = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${base}${alpha}`;
}
