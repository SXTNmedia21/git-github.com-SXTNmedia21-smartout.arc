/**
 * Pill — mono 11px rounded-full badge with 3 tones.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:242-259
 * Shape: padding 2px 8px, border-radius 9999, Geist Mono 11px, whiteSpace nowrap
 * Tones (shared.jsx:243-247):
 *   - muted   → bg var(--muted),               fg var(--foreground)
 *   - brand   → bg oklch(0.65 0.22 40 / 0.10), fg var(--brand-orange-dark)
 *   - success → bg oklch(0.68 0.15 145 / 0.10), fg oklch(0.45 0.15 145)
 */
import type { ReactNode } from "react";
import type { PillTone } from "./types";

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  muted: { bg: "var(--muted)", fg: "var(--foreground)" },
  brand: {
    bg: "oklch(0.65 0.22 40 / 0.10)",
    fg: "var(--brand-orange-dark)",
  },
  success: {
    bg: "oklch(0.68 0.15 145 / 0.10)",
    fg: "oklch(0.45 0.15 145)",
  },
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = "muted", children, className }: PillProps) {
  const t = TONES[tone];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 9999,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
