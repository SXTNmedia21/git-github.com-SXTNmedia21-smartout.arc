/**
 * Motion constants for onboarding animations.
 *
 * Re-exports from design tokens for Framer Motion usage.
 * Use these instead of inline [0.16, 1, 0.3, 1] arrays.
 */

import { motion as motionTokens } from "@smartout/design-tokens";

/** Smooth expo-out easing — primary animation curve */
export const EASE_EXPO = motionTokens.easingExpoArray;

/** Standard easing — subtle UI transitions */
export const EASE_STANDARD = motionTokens.easingArray;
