/**
 * StatusLabel (native) — uppercase mono status tag.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:165-177
 * Web twin: apps/web/src/components/helpdesk-orb/StatusLabel.tsx
 *
 * letter-spacing 0.12em at 11px ≈ 1.32pt. The RN `letterSpacing` prop is in
 * points, so we resolve it at compile time to 1.3 for pixel-stable kerning.
 */
import { Text } from "react-native";

import type { OrbStatus } from "./types";

const LABEL: Record<OrbStatus, string> = {
  waiting: "VENTER",
  active: "AKTIV",
  complete: "LØST",
};

export interface StatusLabelProps {
  status: OrbStatus;
}

export function StatusLabel({ status }: StatusLabelProps) {
  return (
    <Text
      style={{
        fontFamily: "GeistMono",
        fontSize: 11,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 1.3,
        color: "#7a756e",
      }}
    >
      {LABEL[status]}
    </Text>
  );
}
