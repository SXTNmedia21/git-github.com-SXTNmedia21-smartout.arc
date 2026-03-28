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
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    text: "text-destructive",
    icon: "text-destructive",
  },
  warning: {
    badge: "border-warning/30 bg-warning/10 text-warning",
    text: "text-warning",
    icon: "text-warning",
  },
  info: {
    badge: "border-primary/30 bg-primary/10 text-primary",
    text: "text-primary",
    icon: "text-primary",
  },
  good: {
    badge: "border-success/30 bg-success/10 text-success",
    text: "text-success",
    icon: "text-success",
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
