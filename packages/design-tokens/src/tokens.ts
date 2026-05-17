// packages/design-tokens/src/tokens.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NORDIC SPLIT DESIGN SYSTEM — Single source of truth.
// Elegant Nordic cleanness. Warm glowing tones.
// White space. Spring motion. Impact.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Brand Colors ──────────────────────────────────────
export const brand = {
  orange: "oklch(0.65 0.22 40)",
  orangeLight: "oklch(0.75 0.18 40)",
  orangeDark: "oklch(0.55 0.22 40)",
  purple: "oklch(0.55 0.25 300)", // Secondary accent for feature sections
  purpleLight: "oklch(0.65 0.20 300)",
  purpleDark: "oklch(0.45 0.25 300)",
} as const;

// ─── Semantic Colors ───────────────────────────────────
export const semantic = {
  success: "oklch(0.68 0.15 145)",
  successForeground: "oklch(0.18 0.04 145)",
  warning: "oklch(0.75 0.15 75)",
  warningForeground: "oklch(0.20 0.04 75)",
  error: "oklch(0.60 0.20 25)", // maps to --destructive / warm coral (hue 25)
  errorForeground: "oklch(0.98 0.01 25)",
  info: "oklch(0.65 0.13 225)",
  infoForeground: "oklch(0.18 0.04 225)",
  // M2 clockout-wizard tokens (Council 1, Phase A) — warm amber soft + muted destructive
  warnSoft: "oklch(0.96 0.04 60)", // light-mode soft amber surface
  warnSoftForeground: "oklch(0.35 0.08 60)", // light-mode foreground for warn-soft
  dataEstimate: "oklch(0.68 0.08 60)", // warm amber slightly more saturated than warn-soft
  destructiveMuted: "oklch(0.60 0.10 25)", // reduced-chroma destructive for secondary CTAs
} as const;

// ─── Semantic Colors — Dark Mode Overrides ───────────────
// Only variants that differ from light-mode. Consumers pick via `.dark` class.
export const semanticDark = {
  warnSoft: "oklch(0.28 0.05 60)",
  warnSoftForeground: "oklch(0.85 0.06 60)",
  dataEstimate: "oklch(0.72 0.09 60)",
  destructiveMuted: "oklch(0.65 0.10 25)",
} as const;

// ─── Surface Colors (Light Mode) ──────────────────────
export const light = {
  background: "oklch(0.99 0.004 60)",
  foreground: "oklch(0.145 0.01 50)",
  card: "oklch(0.99 0.004 60)",
  cardForeground: "oklch(0.145 0.01 50)",
  popover: "oklch(0.99 0.004 60)",
  popoverForeground: "oklch(0.145 0.01 50)",
  primary: "oklch(0.205 0.01 50)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.965 0.005 58)",
  secondaryForeground: "oklch(0.205 0.01 50)",
  muted: "oklch(0.965 0.005 58)",
  mutedForeground: "oklch(0.52 0.01 52)",
  accent: "oklch(0.965 0.005 58)",
  accentForeground: "oklch(0.205 0.01 50)",
  destructive: "oklch(0.60 0.20 25)",
  border: "oklch(0.91 0.006 55)",
  input: "oklch(0.91 0.006 55)",
  ring: "oklch(0.65 0.22 40)",
  // Sidebar
  sidebar: "oklch(0.975 0.006 57)",
  sidebarForeground: "oklch(0.145 0.01 50)",
  sidebarPrimary: "oklch(0.205 0.01 50)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.955 0.008 56)",
  sidebarAccentForeground: "oklch(0.205 0.01 50)",
  sidebarBorder: "oklch(0.905 0.007 54)",
  sidebarRing: "oklch(0.708 0 0)",
  // Charts
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;

// ─── Surface Colors (Dark Mode) ───────────────────────
export const dark = {
  background: "oklch(0.12 0.015 50)",
  foreground: "oklch(0.95 0.005 55)",
  card: "oklch(0.16 0.02 50)",
  cardForeground: "oklch(0.95 0.005 55)",
  popover: "oklch(0.16 0.02 50)",
  popoverForeground: "oklch(0.95 0.005 55)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0.01 50)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.95 0.005 55)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.6 0.01 52)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.95 0.005 55)",
  destructive: "oklch(0.65 0.19 25)",
  border: "oklch(1 0 0 / 8%)",
  input: "oklch(1 0 0 / 10%)",
  ring: "oklch(0.556 0 0)",
  // Sidebar
  sidebar: "oklch(0.16 0.02 50)",
  sidebarForeground: "oklch(0.95 0.005 55)",
  sidebarPrimary: "oklch(0.488 0.243 264.376)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.269 0 0)",
  sidebarAccentForeground: "oklch(0.95 0.005 55)",
  sidebarBorder: "oklch(1 0 0 / 8%)",
  sidebarRing: "oklch(0.556 0 0)",
  // Charts
  chart1: "oklch(0.488 0.243 264.376)",
  chart2: "oklch(0.696 0.17 162.48)",
  chart3: "oklch(0.769 0.188 70.08)",
  chart4: "oklch(0.627 0.265 303.9)",
  chart5: "oklch(0.645 0.246 16.439)",
} as const;

// ─── Domain Colors (Smartout-specific) ─────────────────
export const department = {
  kitchen: "oklch(0.65 0.2 40)",
  floor: "oklch(0.65 0.15 180)",
  bar: "oklch(0.55 0.2 300)",
  event: "oklch(0.65 0.18 85)",
  storage: "oklch(0.55 0.1 200)",
  // Norwegian aliases — calendar handoff §5 (parity with native.ts)
  kjokken: "oklch(0.65 0.2 40)", // = kitchen
  sal: "oklch(0.65 0.15 180)", // = floor
} as const;

export const status = {
  trainee: "oklch(0.6 0.15 250)",
  active: "oklch(0.65 0.2 145)",
  inactive: "oklch(0.55 0 0)",
  offboarding: "oklch(0.65 0.18 85)",
} as const;

export const priority = {
  urgent: "oklch(0.577 0.245 27.325)",
  high: "oklch(0.65 0.22 40)",
  normal: "oklch(0.6 0.15 250)",
  low: "oklch(0.55 0 0)",
} as const;

// ─── Tidslinjen Phase Tinting ─────────────────────────────────────────────────
// Three OKLCH surfaces for the D6 phase bands rendered on DayTimelineStrip.
// Warm hue range 30-80, low chroma — subtle tint, not a design element.
// CSS vars: --color-phase-prep, --color-phase-service, --color-phase-winddown
export const phase = {
  /** Prep phase band — warm amber, first 30 min of session. */
  phasePrep: "oklch(0.95 0.04 60)",
  /** Service phase band — warm yellow, middle of session. */
  phaseService: "oklch(0.97 0.02 80)",
  /** Wind-down phase band — warm red-orange, last 30 min. */
  phaseWindDown: "oklch(0.93 0.05 30)",
} as const;

// ─── Spacing ──────────────────────────────────────────
export const spacing = {
  page: "2rem",
  section: "1.5rem",
  card: "1.25rem",
  element: "0.75rem",
  tight: "0.5rem",
} as const;

// ─── Radius ───────────────────────────────────────────
export const radius = {
  base: "0.625rem",
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
  xl: "calc(0.625rem + 4px)",
  full: "9999px",
} as const;

// ─── Shadows ──────────────────────────────────────────
export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  glow: {
    orange: "0 0 15px -3px rgba(249, 115, 22, 0.3)",
    blue: "0 0 15px -3px rgba(59, 130, 246, 0.3)",
  },
} as const;

// ─── Panel & Glow (Nordic Split dark surfaces) ──────
export const panel = {
  surface: "oklch(0.18 0.03 50)",
  deep: "oklch(0.06 0.015 50)",
  glowWarm: "oklch(0.45 0.18 40)",
  glowDeep: "oklch(0.35 0.14 35)",
} as const;

// ─── Motion (spring physics) ─────────────────────────
export const motion = {
  spring: { stiffness: 35, damping: 22, mass: 2.2 },
  springSnappy: { stiffness: 45, damping: 24, mass: 2 },
  springGentle: { stiffness: 30, damping: 20, mass: 2.5 },
  enterMs: 500,
  exitMs: 250,
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  easingExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Framer Motion array equivalents */
  easingArray: [0.25, 0.1, 0.25, 1] as const,
  easingExpoArray: [0.16, 1, 0.3, 1] as const,
  /**
   * Calendar redesign motion tokens — parity with native.ts.
   * Web consumers: use as CSS transition-duration values (ms).
   */
  /** ScopeChips dropdown chevron rotation (ms) — calendar handoff. */
  chevronMs: 150,
  /** AddSheet / DetailSheet bottom-sheet slide-up enter/exit (ms) — calendar handoff. */
  sheetSlideMs: 200,
} as const;

// ─── Typography ──────────────────────────────────────
export const typography = {
  heading: "'Instrument Serif', Georgia, serif",
  body: "'Geist Sans', system-ui, sans-serif",
  mono: "'Geist Mono', monospace",
} as const;

// -- Wizard Shell Theme Colors -----------------
export const wizard = {
  dark: {
    bg: "oklch(0.12 0.02 50)",
    sidebar: "oklch(0.08 0.01 50)",
    text: "oklch(0.85 0 0)",
    textMuted: "oklch(0.55 0 0)",
    border: "oklch(0.2 0.01 50)",
    stepPending: "oklch(0.35 0 0)",
  },
  warm: {
    bg: "oklch(0.97 0.008 60)",
    sidebar: "oklch(0.94 0.01 60)",
    text: "oklch(0.2 0.02 50)",
    textMuted: "oklch(0.5 0.02 50)",
    border: "oklch(0.88 0.01 60)",
    stepPending: "oklch(0.7 0.01 60)",
  },
} as const;
