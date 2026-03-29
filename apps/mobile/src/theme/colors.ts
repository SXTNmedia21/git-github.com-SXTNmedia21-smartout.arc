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
  return scheme === "dark" ? darkColors : lightColors;
}

/**
 * Applies opacity to a hex color string.
 * Useful for pressed states, overlays, and disabled elements.
 */
export function withOpacity(color: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));

  // Handle rgba(...) strings — replace/add alpha component
  if (color.startsWith("rgba(")) {
    const inner = color.slice(5, -1);
    const parts = inner.split(",").map((s) => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clamped})`;
  }

  if (color.startsWith("rgb(")) {
    const inner = color.slice(4, -1);
    const parts = inner.split(",").map((s) => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clamped})`;
  }

  // Handle oklch(...) — append / alpha
  if (color.startsWith("oklch(")) {
    const base = color.replace(/\s*\/\s*[\d.]+%?\s*\)$/, ")");
    return base.replace(")", ` / ${Math.round(clamped * 100)}%)`);
  }

  // Handle hex colors (#rgb, #rrggbb, #rrggbbaa)
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  // Strip existing alpha if present (8-char hex)
  const base = color.length === 9 ? color.slice(0, 7) : color;
  return `${base}${alpha}`;
}
