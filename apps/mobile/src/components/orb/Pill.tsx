/**
 * Pill (native) — mono 11px rounded badge with 3 tones.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:242-259
 * Web twin: apps/web/src/components/helpdesk-orb/Pill.tsx
 *
 * Web uses CSS custom properties (oklch + var(--muted)); native resolves the
 * same values to sRGB equivalents. The #f5f3f0 muted surface and the warm
 * brand / success colors match the Nordic Split light-theme palette.
 */
import type { ReactNode } from "react";
import { View, Text } from "react-native";

import type { PillTone } from "./types";

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  muted: { bg: "#f5f3f0", fg: "#1c1814" },
  brand: { bg: "rgba(249, 115, 22, 0.10)", fg: "#c2410c" },
  success: { bg: "rgba(17, 173, 50, 0.10)", fg: "#0e7d26" },
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

export function Pill({ tone = "muted", children }: PillProps) {
  const t = TONES[tone];
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
        backgroundColor: t.bg,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: "GeistMono",
          fontSize: 11,
          color: t.fg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
