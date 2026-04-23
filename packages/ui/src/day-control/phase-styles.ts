// Shared Phase label + style metadata consumed by BOTH PhaseBadge.tsx (web)
// and PhaseBadge.native.tsx. Pure TS — no DOM, no RN. Platform variants use
// the same label / dotClass semantics but map them to CSS classes (web) or
// StyleSheet tokens (native).
//
// ADR-0158 §Concrete plan step 3: "Logic primitives in shared files" — this
// file is the first application of that rule for the day-control folder.

import type { UiPhase } from "./types";

export interface PhaseStyle {
  /** Human-facing label (Norwegian). Kept identical across platforms. */
  label: string;
  /** Tailwind class for badge background (web only). */
  bgClass: string;
  /** Tailwind class for badge text colour (web only). */
  textClass: string;
  /** Tailwind class for the pulse-dot colour (web only). */
  dotClass: string;
  /** Pulse on — only `active` today. Both platforms respect this flag. */
  pulse?: boolean;
  /**
   * Semantic colour key — used by `.native.tsx` to look up a hex value from
   * `nativeTheme.colors.*`. Stable across platforms. Values correspond to
   * the semantic design-token names (see `packages/design-tokens/src/native.ts`).
   */
  tone: "muted" | "success" | "warning" | "destructive" | "brandOrange";
}

export const PHASE_STYLES: Record<UiPhase, PhaseStyle> = {
  upcoming: {
    label: "Starter snart",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    tone: "muted",
  },
  active: {
    label: "Pågår",
    bgClass: "bg-[color:color-mix(in_oklch,var(--success)_12%,transparent)]",
    textClass: "text-[color:var(--success)]",
    dotClass: "bg-[color:var(--success)]",
    pulse: true,
    tone: "success",
  },
  pending_signoff: {
    label: "Venter på oppgjør",
    bgClass: "bg-[color:color-mix(in_oklch,var(--warning)_14%,transparent)]",
    textClass: "text-[color:var(--warning)]",
    dotClass: "bg-[color:var(--warning)]",
    tone: "warning",
  },
  closed: {
    label: "Stengt",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    tone: "muted",
  },
  missed: {
    label: "Ikke åpnet",
    bgClass: "bg-[color:color-mix(in_oklch,var(--destructive)_12%,transparent)]",
    textClass: "text-[color:var(--destructive)]",
    dotClass: "bg-[color:var(--destructive)]",
    tone: "destructive",
  },
  locked: {
    label: "Låst",
    bgClass: "bg-[color:color-mix(in_oklch,var(--brand-orange)_12%,transparent)]",
    textClass: "text-[color:var(--brand-orange)]",
    dotClass: "bg-[color:var(--brand-orange)]",
    tone: "brandOrange",
  },
};
