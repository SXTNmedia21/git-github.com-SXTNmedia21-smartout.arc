/**
 * Orb — radial-gradient responsibility indicator.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:82-105
 * Chroma mapping: waiting=0.08, active=0.12, complete=0.04
 * Gradient: radial circle at 45% 35%, 4 stops in OKLCH hue 50 (warm orange)
 * Softness: blur(1px)
 * Pulse (optional): 2.8s ease-in-out infinite scale 1→1.06 opacity 1→0.82
 *
 * Nordic Split: semantic tokens only, Lucide icon (Check), reduced-motion respected.
 */
import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import type { OrbStatus } from "./types";
import styles from "./Orb.module.css";

const CHROMA: Record<OrbStatus, number> = {
  waiting: 0.08,
  active: 0.12,
  complete: 0.04,
};

export interface OrbProps {
  size?: number;
  status?: OrbStatus;
  pulse?: boolean;
  withCheck?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Orb({
  size = 48,
  status = "waiting",
  pulse = false,
  withCheck = false,
  className,
  style,
  "aria-label": ariaLabel,
}: OrbProps) {
  const chroma = CHROMA[status];
  // Gradient defined in globals.css via [data-orb-gradient] selector (ADR-0366).
  // --orb-chroma drives all colour stops via CSS calc().

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        data-orb-gradient
        className={pulse ? styles.orbPulse : undefined}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          // background provided by [data-orb-gradient] in globals.css — no inline literal (ADR-0366)
          filter: "blur(1px)",
          ["--orb-chroma" as string]: chroma,
        }}
      />
      {withCheck && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            color: "var(--foreground)",
            opacity: 0.85,
          }}
        >
          <Check size={size * 0.42} strokeWidth={2.25} />
        </div>
      )}
    </div>
  );
}
