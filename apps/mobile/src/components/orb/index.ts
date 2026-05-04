/**
 * Mobile orb primitives — twins of apps/web/src/components/helpdesk-orb.
 *
 * API mirrors the web exports so the same import shape works in both
 * codebases: `import { Orb, LighthouseAvatar, StatusLabel, Pill } from '@/components/orb'`.
 */
export { Orb } from "./Orb";
export type { OrbProps } from "./Orb";

export { LighthouseAvatar } from "./LighthouseAvatar";
export type { LighthouseAvatarProps } from "./LighthouseAvatar";

export { StatusLabel } from "./StatusLabel";
export type { StatusLabelProps } from "./StatusLabel";

export { Pill } from "./Pill";
export type { PillProps } from "./Pill";

export type { OrbStatus, HaloIntensity, PillTone } from "./types";
