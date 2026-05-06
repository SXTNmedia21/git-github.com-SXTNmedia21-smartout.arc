/**
 * StatusLabel — uppercase mono tag for ticket/mission state.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:165-177
 * Typography: Geist Mono 11px, weight 500, uppercase, letter-spacing 0.12em,
 *             color var(--muted-foreground)
 * Norwegian copy: waiting → VENTER, active → AKTIV, complete → LØST
 */
import type { OrbStatus } from "./types";

const LABEL: Record<OrbStatus, string> = {
  waiting: "VENTER",
  active: "AKTIV",
  complete: "LØST",
};

export interface StatusLabelProps {
  status: OrbStatus;
  className?: string;
}

export function StatusLabel({ status, className }: StatusLabelProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--muted-foreground)",
      }}
    >
      {LABEL[status]}
    </span>
  );
}
