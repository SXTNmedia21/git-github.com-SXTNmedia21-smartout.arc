/**
 * Pill — mono 11px rounded-full badge with 3 tones.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:242-259
 * Shape: padding 2px 8px, border-radius 9999, Geist Mono 11px, whiteSpace nowrap
 * Tones (shared.jsx:243-247):
 *   - muted   → bg var(--muted),               fg var(--foreground)
 *   - brand   → bg color-mix(in oklch, var(--brand-orange) 10%, transparent), fg var(--brand-orange-dark)
 *   - success → bg color-mix(in oklch, var(--success) 10%, transparent), fg var(--status-active)
 */
import type { HTMLAttributes, ReactNode } from "react";
import type { PillTone } from "./types";

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  muted: { bg: "var(--muted)", fg: "var(--foreground)" },
  brand: {
    bg: "color-mix(in oklch, var(--brand-orange) 10%, transparent)",
    fg: "var(--brand-orange-dark)",
  },
  success: {
    bg: "color-mix(in oklch, var(--success) 10%, transparent)",
    fg: "var(--status-active)",
  },
};

export interface PillProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color" | "style"> {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = "muted", children, className, ...rest }: PillProps) {
  const t = TONES[tone];
  return (
    <span
      {...rest}
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
