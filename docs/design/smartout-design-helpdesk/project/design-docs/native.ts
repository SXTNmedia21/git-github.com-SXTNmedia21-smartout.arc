// packages/design-tokens/src/native.ts
// React Native theme — hex conversions of Nordic Split OKLCH tokens.
// Update these when tokens.ts changes.

export const nativeTheme = {
  light: {
    background: "#fdfcfa", // oklch(0.99 0.004 60) — warm cream
    foreground: "#1c1814", // oklch(0.145 0.01 50) — warm black
    card: "#fdfcfa",
    cardForeground: "#1c1814",
    primary: "#2a241e", // oklch(0.205 0.01 50)
    primaryForeground: "#fafafa",
    secondary: "#f5f3f0", // oklch(0.965 0.005 58)
    secondaryForeground: "#2a241e",
    muted: "#f5f3f0",
    mutedForeground: "#7a756e", // oklch(0.52 0.01 52)
    border: "#e8e5e1", // oklch(0.91 0.006 55)
    destructive: "#de3b3d", // oklch(0.60 0.20 25) — warm coral
    destructiveForeground: "#fff6f5", // oklch(0.98 0.01 25)
    success: "#54b05a", // oklch(0.68 0.15 145)
    successForeground: "#051606", // oklch(0.18 0.04 145)
    warning: "#e49e22", // oklch(0.75 0.15 75)
    warningForeground: "#201301", // oklch(0.20 0.04 75)
    info: "#009eca", // oklch(0.65 0.13 225)
    infoForeground: "#00151f", // oklch(0.18 0.04 225)
    brandOrange: "#f97316",
    brandPurple: "#8b5cf6",
    brandCyan: "#06b6d4",
  },
  dark: {
    background: "#151210", // oklch(0.12 0.015 50) — warm dark
    foreground: "#f0eeeb", // oklch(0.95 0.005 55)
    card: "#1e1a15", // oklch(0.16 0.02 50)
    cardForeground: "#f0eeeb",
    primary: "#e5e5e5",
    primaryForeground: "#2a241e",
    secondary: "#262626",
    secondaryForeground: "#f0eeeb",
    muted: "#262626",
    mutedForeground: "#908a82", // oklch(0.6 0.01 52)
    border: "rgba(255,255,255,0.08)",
    destructive: "#ed5350", // oklch(0.65 0.19 25) — warm coral dark
    destructiveForeground: "#fff6f5", // oklch(0.98 0.01 25)
    success: "#67bb6b", // oklch(0.72 0.14 145)
    successForeground: "#eaf6ea", // oklch(0.96 0.02 145)
    warning: "#eba941", // oklch(0.78 0.14 75)
    warningForeground: "#faf0e3", // oklch(0.96 0.02 75)
    info: "#30add6", // oklch(0.70 0.12 225)
    infoForeground: "#e4f5fc", // oklch(0.96 0.02 225)
    brandOrange: "#f97316",
    brandPurple: "#a78bfa",
    brandCyan: "#22d3ee",
  },
  panel: {
    surface: "#1a1510", // oklch(0.18 0.03 50)
    deep: "#0d0a06", // oklch(0.06 0.015 50)
    glowWarm: "#7a3e14", // oklch(0.45 0.18 40)
    glowDeep: "#5c2a10", // oklch(0.35 0.14 35)
  },
  department: {
    kitchen: "#ee560c",
    floor: "#00ab93",
    bar: "#864ad2",
    event: "#c18200",
    storage: "#008388",
  },
  status: {
    trainee: "#2784d5",
    active: "#11ad32",
    inactive: "#717171",
    offboarding: "#c18200",
  },
  radius: { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 },
  spacing: { page: 32, section: 24, card: 20, element: 12, tight: 8 },
  /**
   * Nordic Split motion tokens — shared between RN shift timeline surfaces.
   *
   * Two spring vocabularies (Council 6.4 2026-04-15):
   *
   * - `springAmbient` — slow lava-lamp drift used by the orb between phase
   *   anchors. Low stiffness + high damping + high mass produces an
   *   unhurried, ambient motion that never competes with the UI.
   * - `springReactive` — snappy touch feedback and phase-transition impulses
   *   triggered by the user or by lifecycle events. Tuned for a confident
   *   "it heard me" response without overshoot that would feel twitchy.
   *
   * All durations are milliseconds. Consumers import via `nativeTheme.motion`
   * (or the destructured subset) so no inline constants leak into components.
   */
  motion: {
    /** Ambient drift spring — orb breathing between phases. */
    springAmbient: { stiffness: 35, damping: 22, mass: 2.2 },
    /** Reactive spring — touch feedback and phase transitions. */
    springReactive: { stiffness: 180, damping: 20, mass: 1 },
    /** Full orb drift-loop period (ms). */
    orbDriftMs: 40_000,
    /** Migration duration when active phase changes (ms). */
    orbMigrationMs: 800,
    /** Phase-to-phase visual transition duration (ms). */
    phaseTransitionMs: 450,
  },
  /**
   * Helpdesk Phase 1 UI tokens per Spec §3.7.
   *
   * Scoped under `helpdesk` so the root surface stays stable. Consumers
   * import via `nativeTheme.helpdesk.orb.*` etc. — no inline OKLCH literals
   * inside component files.
   *
   * SLA phase 2 token is declared but unused in Phase 1 (Spec §4.1).
   * Wiring in Phase 2 becomes: lerp `orb.neutral → orb.slaPhase2MaxCenter`
   * driven by `slaProgress`.
   */
  helpdesk: {
    orb: {
      /** Center tint for `waiting` + `active` base state. */
      neutral: "oklch(0.68 0.06 50)",
      /** Mid-radius tint feathering the orb out. */
      neutralMid: "oklch(0.60 0.04 50 / 0.65)",
      /** Edge tint — fades the orb to near-transparent. */
      neutralEdge: "oklch(0.55 0.03 50 / 0.25)",
      /** Center tint for `active` status (chroma bumped). */
      activeCenter: "oklch(0.70 0.10 50)",
      /** Center tint for `complete` status (chroma dampened). */
      completeCenter: "oklch(0.72 0.04 50)",
      /** Phase 2 max breach center — hue 40, chroma 0.18. Unused Phase 1. */
      slaPhase2MaxCenter: "oklch(0.68 0.18 40)",
    },
    radii: {
      /** Bottom-sheet grab handle radius. */
      sheetHandle: 2,
      /** ResolveFAB circular radius (56pt diameter → 28 radius). */
      fab: 28,
      /** Queue row + card radius on mobile. */
      card: 16,
    },
    spacing: {
      /** Offset from the trailing edge for the floating FAB. */
      fabOffsetRight: 16,
      /** Offset from the bottom safe-area inset for the FAB. */
      fabOffsetBottom: 24,
    },
    typography: {
      /** Screen title (Instrument Serif). */
      headingXl: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, lineHeight: 36 },
      /** Ticket summary in headers. */
      headingLg: { fontFamily: "InstrumentSerif-Regular", fontSize: 22, lineHeight: 26 },
      /** Body copy (Geist). */
      bodyMd: { fontFamily: "Geist-Regular", fontSize: 15, lineHeight: 20 },
      /** Mono meta / status labels. */
      meta: { fontFamily: "GeistMono-Regular", fontSize: 11, letterSpacing: 0.8 },
    },
  },
} as const;
