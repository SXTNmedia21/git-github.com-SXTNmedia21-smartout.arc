// packages/ui/src/helpdesk/index.ts
// Helpdesk Phase 1 shared primitives (ADR-0161 + Nordic Split).
// Dual-platform: web re-exports from `.tsx`, RN resolves `.native.tsx`
// automatically through Metro's platform extension resolution.

export { ResponsibilityOrb } from "./ResponsibilityOrb";
export { LighthouseAvatar, type LighthouseAvatarProps } from "./LighthouseAvatar";
export { OrphanBadge, type OrphanBadgeProps } from "./OrphanBadge";
export { StatusLabel, type StatusLabelProps, type StatusLabelSize } from "./StatusLabel";
export type { TicketStatus, OrbHaloState, ResponsibilityOrbProps } from "./types";
