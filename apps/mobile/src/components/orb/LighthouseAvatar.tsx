/**
 * LighthouseAvatar (native) — avatar with soft halo.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:107-134
 * Web twin: apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx
 *
 * Halo on native is a simple opaque disc because RN does not expose
 * backdrop-filter. The HALO_COLOR constants were resolved offline from the
 * prototype's halo gradient at chroma 0.06 / 0.10 / 0.12 (idle / waiting /
 * active) and lightness 0.80. Documented as known limitation in
 * HANDOFF-helpdesk-primitives.md.
 */
import { View, Text, type ViewStyle } from "react-native";

import type { HaloIntensity } from "./types";

const HALO_COLOR: Record<HaloIntensity, string> = {
  idle: "rgba(180, 150, 120, 0.28)",
  waiting: "rgba(210, 155, 95, 0.35)",
  active: "rgba(224, 150, 70, 0.40)",
};

export interface LighthouseAvatarProps {
  name?: string;
  size?: number;
  halo?: HaloIntensity;
  style?: ViewStyle;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

export function LighthouseAvatar({ name, size = 56, halo = "idle", style }: LighthouseAvatarProps) {
  const haloSize = size * 1.5;
  const initials = getInitials(name);

  return (
    <View
      style={[
        {
          width: haloSize,
          height: haloSize,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: HALO_COLOR[halo],
          opacity: 0.55,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#8a6f50",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: size * 0.36,
            fontWeight: "500",
          }}
        >
          {initials}
        </Text>
      </View>
    </View>
  );
}
