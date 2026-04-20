"use client";

/**
 * LighthouseAvatar (web) — avatar ringed by a ResponsibilityOrb halo.
 *
 * Denotes "this person is responsible." The orb sits behind the avatar
 * and extends past its radius so the avatar reads as *inside* the halo,
 * not stuck-on. Pulse defaults to off; `haloState='waiting'` turns it on.
 *
 * Keeps the avatar rendering minimal — no Radix Avatar wrapper needed.
 * Consumers wanting a full avatar feature set can compose their own view
 * inside `children`.
 */

import * as React from "react";
import { cn } from "../lib/utils";
import { ResponsibilityOrb } from "./ResponsibilityOrb";
import type { OrbHaloState, TicketStatus } from "./types";

export type LighthouseAvatarProps = {
  /** URL to display. Falls back to `initials` if missing or fails to load. */
  avatarUrl?: string | null;
  /** Used for the accessible label AND for fallback initials rendering. */
  name: string;
  /** Avatar diameter in pixels. Orb extends 40% beyond. */
  size: number;
  /** Halo behavior: `waiting` → pulsing, `active` → static bright, `idle` → dim. */
  haloState?: OrbHaloState;
  className?: string;
};

const HALO_TO_STATUS: Record<OrbHaloState, TicketStatus> = {
  idle: "complete", // calmest chroma
  active: "active",
  waiting: "waiting",
};

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function LighthouseAvatar({
  avatarUrl,
  name,
  size,
  haloState = "idle",
  className,
}: LighthouseAvatarProps) {
  const [imageErrored, setImageErrored] = React.useState(false);
  const orbSize = Math.round(size * 1.4);
  const orbOffset = Math.round((orbSize - size) / 2);
  const initials = computeInitials(name);
  const showImage = avatarUrl && !imageErrored;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: orbSize, height: orbSize }}
    >
      <div className="pointer-events-none absolute inset-0">
        <ResponsibilityOrb status={HALO_TO_STATUS[haloState]} size={orbSize} decorative />
      </div>
      <div
        className="ring-border/60 bg-muted absolute flex items-center justify-center overflow-hidden rounded-full ring-1"
        style={{ width: size, height: size, top: orbOffset, left: orbOffset }}
        aria-label={name}
        role="img"
      >
        {showImage ? (
          <img
            src={avatarUrl!}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImageErrored(true)}
          />
        ) : (
          <span className="text-foreground/80 font-mono" style={{ fontSize: size * 0.38 }}>
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
