/**
 * Spacing scale for the mobile app.
 * Based on design tokens with additional fine-grained values for RN layouts.
 */
import { nativeTheme } from "@smartout/design-tokens/native";

/** Semantic spacing from design tokens */
export const spacing = {
  /** Extra-extra-small: 2px — hairline gaps */
  xxs: 2,
  /** Extra-small: 4px — icon-to-text gaps */
  xs: 4,
  /** Tight: 8px — compact element spacing */
  tight: nativeTheme.spacing.tight,
  /** Element: 12px — default gap between related elements */
  element: nativeTheme.spacing.element,
  /** Medium: 16px — standard padding */
  md: 16,
  /** Card: 20px — internal card padding */
  card: nativeTheme.spacing.card,
  /** Section: 24px — gap between sections */
  section: nativeTheme.spacing.section,
  /** Page: 32px — horizontal page margin */
  page: nativeTheme.spacing.page,
  /** Large: 40px — large vertical gaps */
  lg: 40,
  /** Extra-large: 48px — hero spacing */
  xl: 48,
} as const;

export type Spacing = typeof spacing;
