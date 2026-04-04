/**
 * Feature flags for gating unfinished features.
 * Remove the flag and gate when the feature ships.
 */
export const FEATURE_FLAGS = {
  MY_CV: process.env.NEXT_PUBLIC_FF_MY_CV === "true",
  SHIFT_CLOCK_LEADER: process.env.NEXT_PUBLIC_FF_SHIFT_CLOCK_LEADER === "true",
  AI_CHAT: process.env.NEXT_PUBLIC_FF_AI_CHAT === "true",
} as const;
