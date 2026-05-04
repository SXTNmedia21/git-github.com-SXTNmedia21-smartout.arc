/**
 * LighthouseAvatar — avatar with soft radial halo.
 *
 * Design source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:107-134
 * Halo container: size * 1.5
 * Halo chroma: idle=0.06, waiting=0.10, active=0.12 (hue 50 warm)
 * Halo blur: blur(2px)
 * Avatar fallback bg: linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))
 * Initials: first letter of up to 2 space-separated words, uppercase, weight 500, size*0.36
 */
import type { CSSProperties } from "react";
import type { HaloIntensity } from "./types";

const CHROMA: Record<HaloIntensity, number> = {
  idle: 0.06,
  waiting: 0.1,
  active: 0.12,
};

export interface LighthouseAvatarProps {
  name?: string;
  size?: number;
  src?: string;
  halo?: HaloIntensity;
  className?: string;
  style?: CSSProperties;
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

export function LighthouseAvatar({
  name,
  size = 56,
  src,
  halo = "idle",
  className,
  style,
}: LighthouseAvatarProps) {
  const haloSize = size * 1.5;
  const chroma = CHROMA[halo];
  const initials = getInitials(name);

  const haloGradient = `radial-gradient(circle at 45% 40%, oklch(0.80 ${chroma} 50 / 0.55) 0%, oklch(0.70 ${chroma * 0.6} 50 / 0.25) 45%, transparent 70%)`;
  const avatarFallback = "linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: haloSize,
        height: haloSize,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        data-halo
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: haloGradient,
          filter: "blur(2px)",
        }}
      />
      <div
        data-avatar
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          background: src ? `#d6cfc2 url(${src}) center/cover` : avatarFallback,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: size * 0.36,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.2)",
        }}
      >
        {!src && initials}
      </div>
    </div>
  );
}
