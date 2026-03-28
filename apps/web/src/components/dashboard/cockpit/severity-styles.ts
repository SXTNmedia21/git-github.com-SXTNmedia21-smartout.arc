// ============================================
// severity-styles.ts
// Centralizes cockpit V1 severity style tokens.
// Exists to keep urgency semantics visually
// consistent across all first-screen slices.
// ============================================

export type CockpitSeverityTone = "critical" | "warning" | "info" | "good" | "neutral";

type SeverityToneStyles = {
  badge: string;
  text: string;
  icon: string;
};

const SEVERITY_TONE_STYLE_MAP: Record<CockpitSeverityTone, SeverityToneStyles> = {
  critical: {
    badge: "border-red-500/30 bg-red-500/10 text-red-500",
    text: "text-red-500",
    icon: "text-red-500",
  },
  warning: {
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-500",
    text: "text-orange-500",
    icon: "text-orange-500",
  },
  info: {
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-500",
    text: "text-blue-500",
    icon: "text-blue-500",
  },
  good: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    text: "text-emerald-500",
    icon: "text-emerald-500",
  },
  neutral: {
    badge: "border-border bg-muted/50 text-muted-foreground",
    text: "text-foreground",
    icon: "text-muted-foreground",
  },
};

/**
 * Returns token-aligned cockpit style classes for one severity tone.
 *
 * Why: All V1 slices should use the same urgency color language.
 *
 * @param tone - Semantic severity tone used by cockpit UI elements.
 * @returns Badge, text, and icon classes for consistent severity rendering.
 */
export function getSeverityToneStyles(tone: CockpitSeverityTone): SeverityToneStyles {
  return SEVERITY_TONE_STYLE_MAP[tone];
}
