/**
 * Typography scale for the mobile app.
 * Uses system fonts — no custom font loading needed in V1.
 * Sizes follow iOS HIG / Material Design recommendations for readability.
 */
import { TextStyle, Platform } from "react-native";

const fontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

/** Font weight map — named weights for consistency */
export const fontWeights = {
  regular: "400" as TextStyle["fontWeight"],
  medium: "500" as TextStyle["fontWeight"],
  semibold: "600" as TextStyle["fontWeight"],
  bold: "700" as TextStyle["fontWeight"],
};

/** Typography presets — each is a complete TextStyle */
export const typography = {
  /** Page titles, hero text */
  largeTitle: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeights.bold,
  },
  /** Section headers */
  title: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: fontWeights.semibold,
  },
  /** Card titles, prominent labels */
  headline: {
    fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeights.semibold,
  },
  /** Default body text */
  body: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
  },
  /** Emphasized body text */
  bodyBold: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
  },
  /** Secondary text, descriptions */
  subheadline: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
  },
  /** Timestamps, metadata */
  caption: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
  },
  /** Badge text, tiny labels */
  micro: {
    fontFamily,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: fontWeights.medium,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
